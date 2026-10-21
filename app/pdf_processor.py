
from pathlib import Path
import pymupdf


def extract_text_from_pdf(file_path: str) -> list[dict]:
    """
    Extract text from every page of a PDF document.

    Args:
        file_path: Path to the PDF document.

    Returns:
        A list of dictionaries containing page numbers
        and extracted text.
    """

    # Convert the supplied path into a Path object.
    pdf_path = Path(file_path)

    # Check that the file actually exists.
    if not pdf_path.is_file():
        raise FileNotFoundError(
            f"PDF file not found: {pdf_path}"
        )

    pages = []

    # Open the document and close it automatically.
    with pymupdf.open(pdf_path) as document:

        # Iterate through every page in the document.
        for page_number, page in enumerate(document, start=1):

            # Extract the page's text.
            text = page.get_text("text")

            # Save page metadata and content.
            pages.append({
                "page_number": page_number,
                "text": text.strip()
            })

    return pages
