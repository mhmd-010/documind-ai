
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
        document_id: str | None = None
    ) -> dict:

        if not question.strip():
            raise ValueError("Question cannot be empty")

                # STEP 1: Preserve the user's original question.
        original_question = question.strip()

        # STEP 2: Correct spelling and grammar for retrieval.
        # Fall back to the original question if rewriting fails.
        try:
            rewritten_question = self.llm_service.rewrite_question(
                original_question
            )
        except Exception:
            rewritten_question = original_question

        if not rewritten_question or not rewritten_question.strip():
            rewritten_question = original_question

        # STEP 3: Search using the improved question.
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

        context = "\n\n".join(
            f"[Page {result['page_number']}]\n"
            f"{result['text']}"
            for result in results
        )

        answer = self.llm_service.generate_answer(
            question=question,
            context=context
        )

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
