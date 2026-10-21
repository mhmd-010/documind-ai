
import pytest

from app.vector_store import VectorStore


@pytest.fixture
def temp_store(tmp_path):
    """
    Create an isolated ChromaDB database for each test.
    """
    return VectorStore(
        persist_directory=str(tmp_path / "chroma"),
        collection_name="test_documents"
    )


def test_empty_database(temp_store):
    """
    A new database should contain no chunks.
    """
    assert temp_store.count() == 0
    assert temp_store.search("test question") == []


def test_add_chunks(temp_store):
    """
    Adding two chunks should store two records.
    """
    chunks = [
        {
            "chunk_id": 0,
            "page_number": 1,
            "text": "Python is a programming language."
        },
        {
            "chunk_id": 1,
            "page_number": 2,
            "text": "Machine learning uses data."
        }
    ]

    temp_store.add_chunks(
        chunks=chunks,
        document_id="test_pdf"
    )

    assert temp_store.count() == 2


def test_upsert_does_not_duplicate(temp_store):
    """
    Re-ingesting the same chunk should not
    increase the record count.
    """
    chunks = [
        {
            "chunk_id": 0,
            "page_number": 1,
            "text": "Artificial intelligence is useful."
        }
    ]

    temp_store.add_chunks(chunks, "document_1")
    temp_store.add_chunks(chunks, "document_1")

    assert temp_store.count() == 1


def test_search_returns_metadata(temp_store):
    """
    Search results should include source metadata.
    """
    chunks = [
        {
            "chunk_id": 0,
            "page_number": 4,
            "text": "The submission deadline is Friday."
        }
    ]

    temp_store.add_chunks(chunks, "document_2")

    results = temp_store.search(
        "When is the submission deadline?",
        top_k=1
    )

    assert len(results) == 1
    assert results[0]["page_number"] == 4
    assert results[0]["document_id"] == "document_2"
    assert results[0]["chunk_id"] == 0


def test_persistence(tmp_path):
    """
    Data must survive opening a new database client.
    """
    database_path = str(tmp_path / "persistent_db")

    first_store = VectorStore(
        persist_directory=database_path,
        collection_name="persistence_test"
    )

    first_store.add_chunks(
        [
            {
                "chunk_id": 0,
                "page_number": 1,
                "text": "This information should persist."
            }
        ],
        document_id="persist_doc"
    )

    second_store = VectorStore(
        persist_directory=database_path,
        collection_name="persistence_test"
    )

    assert second_store.count() == 1


def test_invalid_search_input(temp_store):
    """
    Invalid search inputs should be rejected.
    """
    with pytest.raises(ValueError):
        temp_store.search("")

    with pytest.raises(ValueError):
        temp_store.search("valid question", top_k=0)
