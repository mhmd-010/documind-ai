
from unittest.mock import Mock

import pytest

from app.rag_pipeline import RAGPipeline


@pytest.fixture
def mock_pipeline():
    """
    Create a RAG pipeline with fake dependencies.
    """
    mock_store = Mock()
    mock_llm = Mock()

    pipeline = RAGPipeline(
        vector_store=mock_store,
        llm_service=mock_llm
    )

    return pipeline, mock_store, mock_llm


def test_rag_generates_answer(mock_pipeline):
    pipeline, mock_store, mock_llm = mock_pipeline

    # Simulate a retrieved document passage.
    mock_store.search.return_value = [
        {
            "document_id": "test_doc",
            "page_number": 1,
            "chunk_id": 2,
            "text": "Submission deadline: 30 September 2025."
        }
    ]

    # Simulate an LLM response.
    mock_llm.generate_answer.return_value = (
        "The deadline is 30 September 2025 (Page 1)."
    )

    result = pipeline.ask(
        "When is the submission deadline?"
    )

    assert "30 September 2025" in result["answer"]
    assert result["sources"][0]["page_number"] == 1

    # Verify that the LLM received the source context.
    context = mock_llm.generate_answer.call_args.kwargs[
        "context"
    ]

    assert "[Page 1]" in context
    assert "Submission deadline" in context


def test_empty_database(mock_pipeline):
    pipeline, mock_store, mock_llm = mock_pipeline

    mock_store.search.return_value = []

    result = pipeline.ask("What is the deadline?")

    assert result["sources"] == []
    assert "No documents" in result["answer"]

    # The LLM should not be called without documents.
    mock_llm.generate_answer.assert_not_called()


def test_invalid_question(mock_pipeline):
    pipeline, mock_store, mock_llm = mock_pipeline

    with pytest.raises(ValueError):
        pipeline.ask("   ")

    mock_store.search.assert_not_called()
    mock_llm.generate_answer.assert_not_called()


def test_top_k_forwarded(mock_pipeline):
    pipeline, mock_store, mock_llm = mock_pipeline

    mock_store.search.return_value = []

    pipeline.ask(
        question="Explain the assessment",
        top_k=4
    )

    mock_store.search.assert_called_once_with(
        question="Explain the assessment",
        top_k=4
    )
