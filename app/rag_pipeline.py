
from app.llm_service import LLMService


class RAGPipeline:
    def __init__(
        self,
        vector_store,
        llm_service: LLMService
    ):
        self.vector_store = vector_store
        self.llm_service = llm_service

  
    def ask(
        self,
        question: str,
        top_k: int = 5,
        document_id: str | None = None,
        conversation_history: list[dict] | None = None
    ) -> dict:

        if not question.strip():
            raise ValueError("Question cannot be empty")

        # STEP 1: Preserve the user's original question.
        original_question = question.strip()

        # STEP 2: Prepare previous conversation messages.
        # We will use these for follow-up questions later.
        recent_history = (
            conversation_history[-10:]
            if conversation_history
            else []
        )

        # STEP 3: Correct spelling and grammar for retrieval.
        # Fall back to the original question if rewriting fails.
        try:
           if recent_history:
            rewritten_question = self.llm_service.rewrite_question(
            original_question,
            conversation_history=recent_history
        )
           else:
            rewritten_question = self.llm_service.rewrite_question(
            original_question
        )
        except Exception:
          rewritten_question = original_question

        if not rewritten_question or not rewritten_question.strip():
            rewritten_question = original_question

        # STEP 4: Search using the improved question.
        search_options = {
            "question": rewritten_question,
            "top_k": top_k
        }

        if document_id is not None:
            search_options["document_id"] = document_id

        results = self.vector_store.search(
            **search_options
        )

        if not results:
            if document_id is None:
                message = "No documents have been indexed yet."
            else:
                message = "No matching document passages were found."

            return {
                "answer": message,
                "sources": []
            }

        # STEP 5: Build context from retrieved PDF passages.
        context = "\n\n".join(
            f"[Page {result['page_number']}]\n"
            f"{result['text']}"
            for result in results
        )

        # STEP 6: Generate an answer grounded in the PDF.
        
        if recent_history:
            answer = self.llm_service.generate_answer(
                question=original_question,
                context=context,
                conversation_history=recent_history
            )
        else:
            answer = self.llm_service.generate_answer(
                question=original_question,
                context=context
            )


        # STEP 7: Prepare source references.
        sources = [
            {
                "document_id": result["document_id"],
                "page_number": result["page_number"],
                "chunk_id": result["chunk_id"]
            }
            for result in results
        ]

        return {
            "answer": answer,
            "sources": sources
        }


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
