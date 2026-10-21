
import numpy as np

from app.pdf_processor import extract_text_from_pdf
from app.text_chunker import chunk_pages
from app.embeddings import embed_texts, cosine_similarity


# 1. Extract text from our PDF.
pages = extract_text_from_pdf("data/sample.pdf")

# 2. Split the pages into chunks.
chunks = chunk_pages(pages)

# 3. Extract only the text from each chunk.
texts = [chunk["text"] for chunk in chunks]

# 4. Generate embeddings for all chunks.
document_vectors = embed_texts(texts)

print("Number of chunks:", len(chunks))
print("Embedding matrix shape:", document_vectors.shape)

# 5. Ask a question about the document.
question = "When is the dissertation submission deadline?"

# 6. Convert the question into an embedding.
query_vector = embed_texts([question])[0]

# 7. Calculate similarity scores.
scores = cosine_similarity(
    query_vector,
    document_vectors
)

# 8. Find the three highest-scoring chunks.
top_indices = np.argsort(scores)[::-1][:3]

# 9. Display the retrieved results.
for rank, index in enumerate(top_indices, start=1):
    chunk = chunks[int(index)]

    print(f"\n--- Result {rank} ---")
    print("Page:", chunk["page_number"])
    print("Similarity:", round(float(scores[index]), 4))
    print("Text:", chunk["text"][:400])
