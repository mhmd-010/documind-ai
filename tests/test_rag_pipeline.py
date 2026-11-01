
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

    # Simulate the LLM rewriting the user's question.
    mock_llm.rewrite_question.return_value = "Explain the assessment"

    # Simulate an empty retrieval result.
    mock_store.search.return_value = []

    # Call the RAG pipeline.
    pipeline.ask(
        question="Explain the assessment",
        top_k=4
    )

    # Verify that the rewritten question and top_k
    # are correctly forwarded to the retriever.
    mock_store.search.assert_called_once_with(
        question="Explain the assessment",
        top_k=4
    )

    # Verify that question rewriting was called.
    mock_llm.rewrite_question.assert_called_once_with(
        "Explain the assessment"
    )
def test_misspelled_question_rewriting(mock_pipeline):
    pipeline, mock_store, mock_llm = mock_pipeline

    # The question as originally typed by the user.
    original_question = "wat are the main reslts"

    # Simulate Groq correcting the spelling.
    corrected_question = "What are the main results?"

    mock_llm.rewrite_question.return_value = corrected_question

    # Provide a matching document passage.
    mock_store.search.return_value = [
        {
            "document_id": "test-document",
            "page_number": 1,
            "chunk_id": "chunk-1",
            "text": "The main results showed improved accuracy."
        }
    ]

    mock_llm.generate_answer.return_value = (
        "The research showed improved accuracy."
    )

    # Execute the RAG pipeline.
    result = pipeline.ask(question=original_question)

    # Verify that retrieval uses the corrected question.
    mock_store.search.assert_called_once_with(
        question=corrected_question,
        top_k=5
    )

    # Verify that answer generation preserves the original question.
    mock_llm.generate_answer.assert_called_once_with(
        question=original_question,
        context=(
            "[Page 1]\n"
            "The main results showed improved accuracy."
        )
    )

    # Verify that the answer and source are returned.
    assert result["answer"] == (
        "The research showed improved accuracy."
    )

    assert result["sources"][0]["page_number"] == 1
    
from unittest.mock import MagicMock


def test_conversational_memory_rewrites_followup():
    from app.rag_pipeline import RAGPipeline

    # Create a mock retriever.
    retriever = MagicMock()

    retriever.search.return_value = [
        {
            "document_id": "test-document",
            "page_number": 5,
            "chunk_id": "chunk-1",
            "text": (
                "XGBoost achieved a lower prediction error "
                "than Random Forest."
            )
        }
    ]

    # Create a mock LLM service.
    llm = MagicMock()

    llm.rewrite_question.return_value = (
        "Which performed better, Random Forest or XGBoost?"
    )

    llm.generate_answer.return_value = (
        "XGBoost performed better."
    )

    # Simulate previous conversation messages.
    history = [
        {
            "role": "user",
            "content": "What models were evaluated?"
        },
        {
            "role": "assistant",
            "content": "Random Forest and XGBoost."
        }
    ]

    # Create the RAG pipeline.
    rag = RAGPipeline(
        vector_store=retriever,
        llm_service=llm
    )

    # Ask a follow-up question.
    result = rag.ask(
        question="Which one performed better?",
        document_id="test-document",
        conversation_history=history
    )

    # Verify that history was passed to the LLM.
    llm.rewrite_question.assert_called_once_with(
        "Which one performed better?",
        conversation_history=history
    )

    # Verify that retrieval used the rewritten question.
    retriever.search.assert_called_once_with(
        question=(
            "Which performed better, Random Forest or XGBoost?"
        ),
        top_k=5,
        document_id="test-document"
    )

    # Verify that the answer was generated.
    assert result["answer"] == "XGBoost performed better."

    # Verify that the source belongs to the selected PDF.
    assert result["sources"][0]["document_id"] == "test-document"

def test_answer_generation_receives_conversation_history():
    from unittest.mock import MagicMock

    from app.rag_pipeline import RAGPipeline

    retriever = MagicMock()
    llm = MagicMock()

    history = [
        {
            "role": "user",
            "content": "Compare Random Forest and XGBoost."
        },
        {
            "role": "assistant",
            "content": "Their performance varies by dataset."
        }
    ]

    retriever.search.return_value = [
        {
            "document_id": "test-doc",
            "chunk_id": 1,
            "page_number": 5,
            "text": "XGBoost performed better on hourly BTC."
        }
    ]

    llm.rewrite_question.return_value = (
        "Why did XGBoost perform better on hourly BTC?"
    )

    llm.generate_answer.return_value = (
        "XGBoost captured nonlinear patterns in the data."
    )

    pipeline = RAGPipeline(
        vector_store=retriever,
        llm_service=llm
    )

    result = pipeline.ask(
        question="Why did it perform better?",
        document_id="test-doc",
        conversation_history=history
    )

    llm.generate_answer.assert_called_once()

    args = llm.generate_answer.call_args.kwargs

    assert args["question"] == "Why did it perform better?"
    assert args["conversation_history"] == history
    assert "[Page 5]" in args["context"]

    assert result["answer"] == (
        "XGBoost captured nonlinear patterns in the data."
    )
