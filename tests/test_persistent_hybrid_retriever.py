
from unittest.mock import Mock

import pytest

from app.persistent_hybrid_retriever import (
    PersistentHybridRetriever
)


def make_store():
    """
    Create a fake vector store with predictable
    semantic and keyword rankings.
    """

    store = Mock()

    documents = [
        "Submission deadline is 30 September 2025.",
        "The dissertation is submitted online.",
        "Students should check the study guide.",
    ]

    metadata = [
        {
            "document_id": "test",
            "page_number": 1,
            "chunk_id": 0,
        },
        {
            "document_id": "test",
            "page_number": 2,
            "chunk_id": 1,
        },
        {
            "document_id": "test",
            "page_number": 3,
            "chunk_id": 2,
        },
    ]

    store.count.return_value = 3

    store.collection.get.return_value = {
        "ids": [
            "test_chunk_0",
            "test_chunk_1",
            "test_chunk_2",
        ],
        "documents": documents,
        "metadatas": metadata,
    }

    # Simulate semantic retrieval results.
    store.search.return_value = [
        {**metadata[1], "text": documents[1]},
        {**metadata[2], "text": documents[2]},
        {**metadata[0], "text": documents[0]},
    ]

    return store


def test_hybrid_retrieval_returns_results():
    store = make_store()

    retriever = PersistentHybridRetriever(
        vector_store=store
    )

    results = retriever.search(
        question="When is the submission deadline?",
        top_k=3
    )

    assert len(results) == 3

    assert all(
        "hybrid_score" in result
        for result in results
    )


def test_hybrid_retrieval_includes_deadline():
    store = make_store()

    retriever = PersistentHybridRetriever(
        vector_store=store
    )

    results = retriever.search(
        question="When is the submission deadline?",
        top_k=3
    )

    chunk_ids = [
        result["chunk_id"]
        for result in results
    ]

    assert 0 in chunk_ids



def test_empty_hybrid_database():
    # Create a mock vector store.
    store = Mock()

    # Simulate a database containing zero chunks.
    store.count.return_value = 0

    # Simulate ChromaDB returning an empty collection.
    store.collection.get.return_value = {
        "ids": [],
        "documents": [],
        "metadatas": []
    }

    # Initialize the persistent hybrid retriever.
    retriever = PersistentHybridRetriever(
        vector_store=store
    )

    # Search the empty database.
    results = retriever.search(
        "What is the deadline?"
    )

    # An empty database must return no results.
    assert results == []



def test_invalid_hybrid_question():
    store = make_store()

    retriever = PersistentHybridRetriever(
        vector_store=store
    )

    with pytest.raises(ValueError):
        retriever.search("   ")


def test_invalid_hybrid_top_k():
    store = make_store()

    retriever = PersistentHybridRetriever(
        vector_store=store
    )

    with pytest.raises(ValueError):
        retriever.search(
            question="What is the deadline?",
            top_k=0
        )


def test_invalid_rrf_k():
    store = make_store()

    with pytest.raises(ValueError):
        PersistentHybridRetriever(
            vector_store=store,
            rrf_k=0
        )
