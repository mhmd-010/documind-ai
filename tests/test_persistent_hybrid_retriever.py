
from unittest.mock import Mock
import numpy as np
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

from unittest.mock import MagicMock, patch

from app.persistent_hybrid_retriever import (
    PersistentHybridRetriever,
)


def test_hybrid_search_handles_missing_semantic_rank():
    # Simulate three chunks stored in ChromaDB.
    document_id = "test-document"

    stored = {
        "ids": [
            "test-document_chunk_0",
            "test-document_chunk_1",
            "test-document_chunk_2",
        ],
        "documents": [
            "Random Forest forecasting results.",
            "XGBoost forecasting results.",
            "ARIMA forecasting results.",
        ],
        "metadatas": [
            {
                "document_id": document_id,
                "chunk_id": 0,
                "page_number": 1,
            },
            {
                "document_id": document_id,
                "chunk_id": 1,
                "page_number": 2,
            },
            {
                "document_id": document_id,
                "chunk_id": 2,
                "page_number": 3,
            },
        ],
    }

    vector_store = MagicMock()
    vector_store.collection.get.return_value = stored

    # Semantic search deliberately omits chunk 2.
    vector_store.search.return_value = [
        {
            "document_id": document_id,
            "chunk_id": 0,
            "page_number": 1,
            "text": stored["documents"][0],
        },
        {
            "document_id": document_id,
            "chunk_id": 1,
            "page_number": 2,
            "text": stored["documents"][1],
        },
    ]

    # Use a small RRF constant so semantic ranking
    # has a visible effect on the final ordering.
    retriever = PersistentHybridRetriever(
        vector_store=vector_store,
        rrf_k=1,
    )

    # Force deterministic BM25 scores:
    # chunk 2 ranks first, then chunk 1, then chunk 0.
    with patch(
        "app.persistent_hybrid_retriever.BM25Okapi"
    ) as mock_bm25:
       mock_bm25.return_value.get_scores.return_value = np.array([
      1.0,
      2.0,
      3.0,
    ])

    results = retriever.search(
            question="Compare forecasting models",
            top_k=3,
            document_id=document_id,
        )

    # The search should complete without KeyError.
    assert len(results) == 3

    # All three chunks should remain available.
    returned_ids = {
        result["chunk_id"]
        for result in results
    }

    assert returned_ids == {0, 1, 2}

    # Every returned chunk should have an RRF score.
    assert all(
        result["hybrid_score"] > 0
        for result in results
    )

    # Document filtering must still be passed through.
    vector_store.collection.get.assert_called_once_with(
        include=["documents", "metadatas"],
        where={"document_id": document_id},
    )
