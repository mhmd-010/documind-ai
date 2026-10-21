
from app.pdf_processor import extract_text_from_pdf
from app.text_chunker import chunk_pages

# Step 1: Extract text from our sample PDF.
pages = extract_text_from_pdf("data/sample.pdf")

# Step 2: Split the extracted pages into chunks.
chunks = chunk_pages(pages)

# Step 3: Display results.
print(f"Pages extracted: {len(pages)}")
print(f"Chunks created: {len(chunks)}")

# Display the first three chunks.
for chunk in chunks[:3]:
    print("\n-----------------------")
    print(f"Chunk ID: {chunk['chunk_id']}")
    print(f"Page: {chunk['page_number']}")
    print(chunk["text"][:250])
