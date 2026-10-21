
import numpy as np

from app.pdf_processor import extract_text_from_pdf
from app.text_chunker import chunk_pages
from app.embeddings import embed_texts, cosine_similarity


# Load and process the document.
pages = extract_text_from_pdf("data/sample.pdf")
chunks = chunk_pages(pages)

# Generate embeddings.
texts = [chunk["text"] for chunk in chunks]
document_vectors = embed_texts(texts)

question = "When is the dissertation submission deadline?"
query_vector = embed_texts([question])[0]

# Calculate similarity scores.
scores = cosine_similarity(
    query_vector,
    document_vectors
)

# Rank all chunks by similarity.
ranked_indices = np.argsort(scores)[::-1]

print("\n=== ALL RETRIEVAL RESULTS ===")

for rank, index in enumerate(ranked_indices, start=1):
    chunk = chunks[int(index)]

    print(
        f"Rank {rank} | "
        f"Chunk {chunk['chunk_id']} | "
        f"Page {chunk['page_number']} | "
        f"Score {scores[index]:.4f}"
    )

print("\n=== DEADLINE MATCHES ===")

for chunk in chunks:
    if "30th Sep 2025" in chunk["text"]:
        print("Found in chunk:", chunk["chunk_id"])
        print("Page:", chunk["page_number"])
        print("Text:", chunk["text"])
