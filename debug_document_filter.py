
from app.vector_store import VectorStore
from app.persistent_hybrid_retriever import (
    PersistentHybridRetriever
)


DOCUMENT_ID = "86d98c9be8794de694c0abc0a4fd2a12"

QUESTION = "When is the dissertation submission deadline?"


def main():
    print("\n=== DOCUMENT FILTER DEBUG ===")

    store = VectorStore()

    print("\nTotal stored chunks:", store.count())

    print("\nTesting filtered semantic search...")

    semantic_results = store.search(
        question=QUESTION,
        top_k=3,
        document_id=DOCUMENT_ID
    )

    for result in semantic_results:
        print(
            f"Page {result['page_number']} "
            f"| Chunk {result['chunk_id']}"
        )

    print("\nTesting filtered hybrid search...")

    retriever = PersistentHybridRetriever(
        vector_store=store
    )

    hybrid_results = retriever.search(
        question=QUESTION,
        top_k=3,
        document_id=DOCUMENT_ID
    )

    for result in hybrid_results:
        print(
            f"Page {result['page_number']} "
            f"| Chunk {result['chunk_id']} "
            f"| Score {result['hybrid_score']:.6f}"
        )

    print("\nDebug completed successfully.")


if __name__ == "__main__":
    main()
