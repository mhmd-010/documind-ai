
from pathlib import Path

import chromadb
from chromadb.config import Settings

from app.embeddings import embed_texts


class VectorStore:
    def __init__(
        self,
        persist_directory: str = "data/chroma_db",
        collection_name: str = "documind"
    ):
        Path(persist_directory).mkdir(
            parents=True,
            exist_ok=True
        )

        self.client = chromadb.PersistentClient(
            path=persist_directory,
            settings=Settings(
                anonymized_telemetry=False
            )
        )

        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )

    def add_chunks(
        self,
        chunks: list[dict],
        document_id: str,
        filename: str = "Unknown PDF",
        total_pages: int = 0
    ) -> None:
        """
        Store document chunks, embeddings and metadata.

        filename and total_pages are optional so existing
        code that calls add_chunks() continues to work.
        """

        if not chunks:
            return

        # Extract the text from each chunk.
        texts = [
            chunk["text"]
            for chunk in chunks
        ]

        # Generate embeddings using our existing model.
        embeddings = embed_texts(texts)

        # Give each chunk a unique ID.
        ids = [
            f"{document_id}_chunk_{chunk['chunk_id']}"
            for chunk in chunks
        ]

        # Store document information alongside each chunk.
        metadata = [
            {
                "document_id": document_id,
                "page_number": chunk["page_number"],
                "chunk_id": chunk["chunk_id"],
                "filename": filename,
                "total_pages": total_pages
            }
            for chunk in chunks
        ]

        # Save chunks and embeddings in persistent ChromaDB.
        self.collection.upsert(
            ids=ids,
            documents=texts,
            embeddings=embeddings.tolist(),
            metadatas=metadata
        )

    def search(
        self,
        question: str,
        top_k: int = 3,
        document_id: str | None = None
    ) -> list[dict]:

        if not question.strip():
            raise ValueError("Question cannot be empty")

        if top_k <= 0:
            raise ValueError("top_k must be positive")

        # Optionally filter by a selected document.
        where_filter = None

        if document_id is not None:
            where_filter = {
                "document_id": document_id
            }

        # Count matching chunks.
        if where_filter is None:
            count = self.collection.count()
        else:
            matching = self.collection.get(
                where=where_filter,
                include=[]
            )
            count = len(matching["ids"])

        if count == 0:
            return []

        # Embed the user's question.
        query_embedding = embed_texts([question])[0]

        query_options = {
            "query_embeddings": [
                query_embedding.tolist()
            ],
            "n_results": min(top_k, count),
            "include": [
                "documents",
                "metadatas",
                "distances"
            ]
        }

        if where_filter is not None:
            query_options["where"] = where_filter

        # Search ChromaDB.
        results = self.collection.query(
            **query_options
        )

        retrieved = []

        for text, metadata, distance in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0]
        ):
            retrieved.append(
                {
                    "text": text,
                    "page_number": metadata["page_number"],
                    "chunk_id": metadata["chunk_id"],
                    "document_id": metadata["document_id"],
                    "distance": float(distance)
                }
            )

        return retrieved

    def count(self) -> int:
        return self.collection.count()
