
import numpy as np

from app.pdf_processor import extract_text_from_pdf
from app.text_chunker import chunk_pages
from app.embeddings import embed_texts
from app.hybrid_retriever import hybrid_search
from app.evaluation import evaluate_retrieval


pages = extract_text_from_pdf("data/sample.pdf")
chunks = chunk_pages(pages)

question = "When is the dissertation submission deadline?"

# Ground truth for this specific document.
relevant_ids = {
    chunk["chunk_id"]
    for chunk in chunks
    if "30th Sep 2025" in chunk["text"]
}

assert relevant_ids, "Expected deadline passage not found"

# Semantic-only retrieval.
document_vectors = embed_texts(
    [chunk["text"] for chunk in chunks]
)
query_vector = embed_texts([question])[0]

scores = document_vectors @ query_vector

semantic_ids = [
    chunks[int(i)]["chunk_id"]
    for i in np.argsort(-scores, kind="stable")
]

# Hybrid retrieval.
hybrid_results = hybrid_search(
    question,
    chunks,
    top_k=len(chunks)
)

hybrid_ids = [
    result["chunk_id"]
    for result in hybrid_results
]

# Evaluate both methods.
semantic_metrics = evaluate_retrieval(
    semantic_ids, relevant_ids, k=3
)

hybrid_metrics = evaluate_retrieval(
    hybrid_ids, relevant_ids, k=3
)

print("\n=== RETRIEVAL COMPARISON ===")

for name, metrics in [
    ("Semantic", semantic_metrics),
    ("Hybrid", hybrid_metrics)
]:
    print(f"\n{name}:")
    print("Hit@3:", metrics["hit_at_k"])
    print("Recall@3:", metrics["recall_at_k"])
    print(
        "Reciprocal Rank:",
        round(metrics["reciprocal_rank"], 4)
    )
