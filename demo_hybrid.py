
from app.pdf_processor import extract_text_from_pdf
from app.text_chunker import chunk_pages
from app.hybrid_retriever import hybrid_search


pages = extract_text_from_pdf("data/sample.pdf")
chunks = chunk_pages(pages)

question = "When is the dissertation submission deadline?"

results = hybrid_search(
    question=question,
    chunks=chunks,
    top_k=5
)

print("\n=== HYBRID RETRIEVAL RESULTS ===")

for rank, result in enumerate(results, start=1):
    print(f"\n--- Rank {rank} ---")
    print("Chunk ID:", result["chunk_id"])
    print("Page:", result["page_number"])
    print("Hybrid score:", round(result["hybrid_score"], 5))
    print("Text:", result["text"][:350])

correct_chunk_ids = {
    chunk["chunk_id"]
    for chunk in chunks
    if "30th Sep 2025" in chunk["text"]
}

top_three_ids = {
    result["chunk_id"]
    for result in results[:3]
}

hit_at_3 = int(
    bool(correct_chunk_ids & top_three_ids)
)

print("\nHit@3:", hit_at_3)
