
import logging
from pathlib import Path
from uuid import uuid4
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

import pymupdf
from contextlib import asynccontextmanager

from app.chat_database import (
    initialize_database,
    save_message,
    get_messages,
    delete_messages,
)

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.pdf_processor import extract_text_from_pdf
from app.text_chunker import chunk_pages
from app.vector_store import VectorStore
from app.llm_service import LLMService
from app.rag_pipeline import RAGPipeline
from app.persistent_hybrid_retriever import PersistentHybridRetriever


# Configure the logger.
logger = logging.getLogger(__name__)


# Locate the project directory.
BASE_DIR = Path(__file__).resolve().parent.parent

# Store uploaded PDFs in a dedicated folder.
UPLOAD_DIR = BASE_DIR / "data" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Maximum PDF size: 10 MB.
MAX_FILE_SIZE = 10 * 1024 * 1024


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


app = FastAPI(
    title="DocuMind AI",
    description="Document question-answering API using hybrid RAG.",
    version="1.0.0",
    lifespan=lifespan,
)
# Allow the Next.js frontend to communicate with FastAPI.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health_check():
    """Check whether the API server is running."""
    return {
        "status": "healthy",
        "service": "DocuMind AI",
        "version": "1.0.0"
    }


@app.post("/documents/upload", status_code=201)
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a PDF, extract text, create chunks,
    and store embeddings in ChromaDB.
    """

    # STEP 1: Validate the filename.
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="A filename is required."
        )

    if Path(file.filename).suffix.lower() != ".pdf":
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported."
        )

    # STEP 2: Read the file with a size limit.
    content = await file.read(MAX_FILE_SIZE + 1)

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="PDF exceeds the 10 MB size limit."
        )

    # STEP 3: Check the PDF file signature.
    if not content.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid PDF."
        )

    # STEP 4: Generate a unique document ID.
    document_id = uuid4().hex

    # Avoid trusting the user's filename as a path.
    saved_path = UPLOAD_DIR / f"{document_id}.pdf"

    # Track whether indexing completed successfully.
    upload_succeeded = False

    try:
        # STEP 5: Save the PDF.
        saved_path.write_bytes(content)

        # STEP 6: Extract text from PDF pages.
        pages = extract_text_from_pdf(str(saved_path))

        # STEP 7: Split extracted text into chunks.
        chunks = chunk_pages(
            pages,
            chunk_size=800,
            overlap=150
        )

        if not chunks:
            raise HTTPException(
                status_code=422,
                detail="No extractable text found in PDF."
            )

        # STEP 8: Store the chunks and embeddings.
        store = VectorStore(
            persist_directory=str(
                BASE_DIR / "data" / "chroma_db"
            )
        )

        
        store.add_chunks(
            chunks=chunks,
            document_id=document_id,
            filename=Path(file.filename).name,
            total_pages=len(pages)
        )


        # STEP 9: Return document metadata.
        upload_succeeded = True
        # STEP 10: Return document metadata.
        return {
            "message": "Document uploaded and indexed successfully.",
            "document_id": document_id,
            "filename": file.filename,
            "pages": len(pages),
            "chunks": len(chunks)
        }

    except HTTPException:
        raise

    except (pymupdf.FileDataError, pymupdf.EmptyFileError):
        raise HTTPException(
            status_code=400,
            detail="The PDF is corrupted or unreadable."
        )

    except Exception:
        # Avoid exposing internal errors to API clients.
        raise HTTPException(
            status_code=500,
            detail="Document processing failed."
        )

    finally:
    # Keep successfully indexed PDFs for the document viewer.
    # Remove the file only if processing did not succeed.
     if not upload_succeeded:
        saved_path.unlink(missing_ok=True)

    # Close the uploaded file handle.
    await file.close()



class QuestionRequest(BaseModel):
    question: str = Field(min_length=1)
    top_k: int = Field(default=3, ge=1, le=20)
    document_id: str | None = None


@app.post("/ask")
def ask_question(request: QuestionRequest):

    if not request.question.strip():
        raise HTTPException(
            status_code=422,
            detail="Question cannot be empty."
        )

    try:
        store = VectorStore(
            persist_directory=str(
                BASE_DIR / "data" / "chroma_db"
            )
        )

        retriever = PersistentHybridRetriever(
            vector_store=store
        )

        llm = LLMService(
            model_name="openai/gpt-oss-20b"
        )

        rag = RAGPipeline(
            vector_store=retriever,
            llm_service=llm
        )

        result = rag.ask(
            question=request.question,
            top_k=request.top_k,
            document_id=request.document_id
        )

        # Save conversations associated with a specific PDF.
        if request.document_id:
            save_message(
                document_id=request.document_id,
                role="user",
                content=request.question,
            )

            save_message(
                document_id=request.document_id,
                role="assistant",
                content=result["answer"],
                sources=result.get("sources", []),
            )

        return result

    except Exception:
        logger.exception("Question answering failed")

        raise HTTPException(
            status_code=500,
            detail="Question answering failed."
        )


@app.get("/documents")
def list_documents():
    """Return previously indexed documents from ChromaDB."""

    try:
        # STEP 1: Connect to the existing persistent vector database.
        store = VectorStore(
            persist_directory=str(
                BASE_DIR / "data" / "chroma_db"
            )
        )

        # STEP 2: Retrieve metadata for stored chunks.
        results = store.collection.get(
            include=["metadatas"]
        )

        # STEP 3: Group chunks by their document ID.
        documents = {}

        for metadata in results.get("metadatas", []):
            if not metadata:
                continue

            document_id = metadata.get("document_id")

            if not document_id:
                continue

            if document_id not in documents:
                documents[document_id] = {
                    "document_id": document_id,
                    "filename": metadata.get(
                        "filename", "Unknown PDF"
                    ),
                    "pages": metadata.get(
                        "total_pages", 0
                    ),
                    "chunks": 0
                }

            documents[document_id]["chunks"] += 1

        # STEP 4: Return the grouped document records.
        return {
            "documents": list(documents.values())
        }

    except Exception:
        logger.exception("Failed to list documents")

        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve documents."
        )

# -------------------------------------------------------
# VIEW ORIGINAL PDF
# -------------------------------------------------------

@app.get("/documents/{document_id}/pdf")
def view_document_pdf(document_id: str):
    """
    Return the original uploaded PDF for viewing
    in the DocuMind frontend.
    """

    # Document IDs are generated as 32-character hex strings.
    # Reject malformed IDs to avoid unsafe file paths.
    if len(document_id) != 32 or any(
        char not in "0123456789abcdef"
        for char in document_id
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid document ID."
        )

    # The stored filename is always based on the document ID.
    pdf_path = UPLOAD_DIR / f"{document_id}.pdf"

    if not pdf_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Original PDF not found."
        )

    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        headers={
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
        },
    )
@app.delete("/documents/{document_id}")
def delete_document(document_id: str):
    """
    Delete a document and its associated data:

    1. Indexed chunks from ChromaDB
    2. Saved conversation history from SQLite
    3. Original uploaded PDF from disk

    Other documents remain untouched.
    """

    try:
        # STEP 1: Connect to the existing vector database.
        store = VectorStore(
            persist_directory=str(
                BASE_DIR / "data" / "chroma_db"
            )
        )

        # STEP 2: Find chunks belonging to this document.
        matching = store.collection.get(
            where={"document_id": document_id},
            include=[]
        )

        chunk_ids = matching["ids"]

        # STEP 3: Return 404 if the document does not exist.
        if not chunk_ids:
            raise HTTPException(
                status_code=404,
                detail="Document not found."
            )

        # STEP 4: Delete the document's indexed chunks.
        store.collection.delete(
            ids=chunk_ids
        )

        # STEP 5: Delete its saved chat history.
        delete_messages(document_id)

        # STEP 6: Delete its original PDF file.
        # Only accept the 32-character hexadecimal IDs
        # generated by our upload endpoint.
        if (
            len(document_id) == 32
            and all(
                char in "0123456789abcdef"
                for char in document_id
            )
        ):
            pdf_path = UPLOAD_DIR / f"{document_id}.pdf"

            # If the file is missing, deletion still succeeds.
            # This also supports older documents whose
            # original PDFs were not retained.
            pdf_path.unlink(missing_ok=True)

        # STEP 7: Confirm successful deletion.
        return {
            "message": "Document deleted successfully.",
            "document_id": document_id,
            "deleted_chunks": len(chunk_ids)
        }

    except HTTPException:
        raise

    except Exception:
        logger.exception("Document deletion failed")

        raise HTTPException(
            status_code=500,
            detail="Document deletion failed."
        )
# -------------------------------------------------------
# GET DOCUMENT CHAT HISTORY
# -------------------------------------------------------

@app.get("/documents/{document_id}/messages")
def get_document_messages(document_id: str):
    """
    Retrieve the saved conversation history
    associated with a specific PDF document.
    """

    try:
        # STEP 1: Retrieve messages from SQLite.
        messages = get_messages(document_id)

        # STEP 2: Return the conversation history.
        return {
            "document_id": document_id,
            "messages": messages,
        }

    except Exception:
        # STEP 3: Log unexpected database errors.
        logger.exception("Failed to retrieve chat history")

        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve chat history.",
        )