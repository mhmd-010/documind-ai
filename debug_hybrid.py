
from rank_bm25 import BM25Okapi

from app.vector_store import VectorStore
from app.hybrid_retriever import tokenize
from app.persistent_hybrid_retriever import (
    PersistentHybridRetriever
)


question = "When is the dissertation submission deadline?"

store = VectorStore()

# Load the stored documents.
stored = store.collection.get(
    include=["documents", "metadatas"]
)

ids = stored["ids"]
texts = stored["documents"]
metadata = stored["metadatas"]

print("\n=== SEMANTIC RANKING ===")

semantic_results = store.search(
    question=question,
    top_k=10
)

for rank, result in enumerate(semantic_results, start=1):
    print(
        f"{rank}. Page {result['page_number']} "
        f"| Chunk {result['chunk_id']}"
    )


print("\n=== BM25 RANKING ===")

tokenized_documents = [
    tokenize(text) for text in texts
]

bm25 = BM25Okapi(tokenized_documents)

scores = bm25.get_scores(
    tokenize(question)
)

keyword_order = sorted(
    range(len(scores)),
    key=lambda index: -scores[index]
)

for rank, index in enumerate(keyword_order[:10], start=1):
    print(
        f"{rank}. Page {metadata[index]['page_number']} "
        f"| Chunk {metadata[index]['chunk_id']} "
        f"| Score {scores[index]:.4f}"
    )


print("\n=== HYBRID RANKING ===")

retriever = PersistentHybridRetriever(
    vector_store=store
)

hybrid_results = retriever.search(
    question=question,
    top_k=10
)

for rank, result in enumerate(hybrid_results, start=1):
    print(
        f"{rank}. Page {result['page_number']} "
        f"| Chunk {result['chunk_id']} "
        f"| RRF {result['hybrid_score']:.6f}"
    )
