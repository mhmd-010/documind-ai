
import pytest

from app.text_chunker import chunk_pages


def test_chunking_with_overlap():
    pages = [{
        "page_number": 1,
        "text": "ABCDEFGHIJ"
    }]

    chunks = chunk_pages(
        pages,
        chunk_size=6,
        overlap=2
    )

    assert len(chunks) == 2
    assert chunks[0]["text"] == "ABCDEF"
    assert chunks[1]["text"] == "EFGHIJ"
    assert chunks[0]["page_number"] == 1


def test_empty_page():
    pages = [{
        "page_number": 2,
        "text": "   "
    }]

    assert chunk_pages(pages) == []


def test_invalid_overlap():
    with pytest.raises(ValueError):
        chunk_pages(
            [],
            chunk_size=100,
            overlap=100
        )
