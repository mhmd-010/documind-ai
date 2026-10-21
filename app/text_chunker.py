
def chunk_pages(
    pages: list[dict],
    chunk_size: int = 800,
    overlap: int = 150
) -> list[dict]:
    """
    Split extracted PDF pages into overlapping text chunks.

    Each chunk retains its original page number.
    """

    # Validate configuration before processing.
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")

    if not 0 <= overlap < chunk_size:
        raise ValueError(
            "overlap must be non-negative and smaller than chunk_size"
        )

    chunks = []

    # Process each page separately to preserve metadata.
    for page in pages:

        page_number = page["page_number"]
        text = page["text"]

        # Skip empty pages.
        if not text.strip():
            continue

        start = 0

        while start < len(text):

            # Calculate where this chunk ends.
            end = min(start + chunk_size, len(text))

            # Extract the text section.
            chunk_text = text[start:end]

            # Store text and metadata together.
            chunks.append({
                "chunk_id": len(chunks),
                "page_number": page_number,
                "text": chunk_text
            })

            # Stop when we've reached the end.
            if end == len(text):
                break

            # Move forward while retaining overlap.
            start = end - overlap

    return chunks
