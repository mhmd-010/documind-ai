
from app.pdf_processor import extract_text_from_pdf
from app.text_chunker import chunk_pages
from app.vector_store import VectorStore


# Extract and chunk the PDF.
pages = extract_text_from_pdf("data/sample.pdf")
chunks = chunk_pages(pages)

# Connect to the persistent vector database.
store = VectorStore()

# Save all chunks.
store.add_chunks(
    chunks=chunks,
    document_id="dissertation_guidelines"
)

print("Stored chunks:", store.count())

# Search the database.
question = "When is the dissertation submission deadline?"

results = store.search(
    question=question,
    top_k=5
)

print("\n=== CHROMADB SEARCH RESULTS ===")

for rank, result in enumerate(results, start=1):
    print(f"\n--- Result {rank} ---")
    print("Page:", result["page_number"])
    print("Chunk ID:", result["chunk_id"])
    print("Distance:", round(result["distance"], 4))
    print("Text:", result["text"][:350])
