
import traceback

from app.vector_store import VectorStore
from app.persistent_hybrid_retriever import (
    PersistentHybridRetriever
)
from app.llm_service import LLMService
from app.rag_pipeline import RAGPipeline


DOCUMENT_ID = "86d98c9be8794de694c0abc0a4fd2a12"

QUESTION = "When is the dissertation submission deadline?"


def main():
    print("\n=== FULL RAG DEBUG ===")

    try:
        # STEP 1: Connect to ChromaDB.
        store = VectorStore()

        print("Vector database connected.")

        # STEP 2: Initialize hybrid retrieval.
        retriever = PersistentHybridRetriever(
            vector_store=store
        )

        print("Hybrid retriever initialized.")

        # STEP 3: Initialize the Groq LLM.
        # Replace this with your working model ID.
        llm = LLMService(
            model_name="openai/gpt-oss-20b"
        )

        print("LLM initialized.")

        # STEP 4: Create the RAG pipeline.
        rag = RAGPipeline(
            vector_store=retriever,
            llm_service=llm
        )

        print("RAG pipeline initialized.")

        # STEP 5: Ask a document-specific question.
        result = rag.ask(
            question=QUESTION,
            top_k=3,
            document_id=DOCUMENT_ID
        )

        print("\n=== ANSWER ===")
        print(result["answer"])

        print("\n=== SOURCES ===")

        for source in result["sources"]:
            print(
                f"Document: {source['document_id']} "
                f"| Page: {source['page_number']} "
                f"| Chunk: {source['chunk_id']}"
            )

        print("\nFull RAG test completed successfully.")

    except Exception:
        print("\n=== ERROR DETAILS ===")
        traceback.print_exc()


if __name__ == "__main__":
    main()
