
import pytest
import pymupdf

from app.pdf_processor import extract_text_from_pdf


def test_extract_text_from_valid_pdf(tmp_path):
    # Create a temporary PDF document.
    pdf_path = tmp_path / "test.pdf"

    # Generate a PDF containing known text.
    with pymupdf.open() as document:
        page = document.new_page()
        page.insert_text((72, 72), "Hello DocuMind AI")
        document.save(pdf_path)

    # Extract text using our function.
    result = extract_text_from_pdf(str(pdf_path))

    # Check the expected results.
    assert len(result) == 1
    assert result[0]["page_number"] == 1
    assert "Hello DocuMind AI" in result[0]["text"]


def test_missing_pdf_raises_error(tmp_path):
    # Create a path that does not exist.
    missing_path = tmp_path / "missing.pdf"

    # Verify the correct exception is raised.
    with pytest.raises(FileNotFoundError):
        extract_text_from_pdf(str(missing_path))
