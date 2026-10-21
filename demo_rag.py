
from app.vector_store import VectorStore
from app.persistent_hybrid_retriever import (
    PersistentHybridRetriever
)
from app.llm_service import LLMService
from app.rag_pipeline import RAGPipeline


# Connect to existing persistent database.
store = VectorStore()

# Create hybrid retriever.
retriever = PersistentHybridRetriever(
    vector_store=store
)

# Use the model that worked in Step 12.
llm = LLMService(
    model_name="openai/gpt-oss-20b"
)

# Inject the hybrid retriever into our pipeline.
rag = RAGPipeline(
    vector_store=retriever,
    llm_service=llm
)

question = "When is the dissertation submission deadline?"

result = rag.ask(
    question=question,
    top_k=3
)

print("\n=== DOCUMIND AI: HYBRID RAG ===")
print("Question:", question)
print("\nAnswer:")
print(result["answer"])

print("\nRetrieved sources:")

for source in result["sources"]:
    print(
        f"Document: {source['document_id']} | "
        f"Page: {source['page_number']} | "
        f"Chunk: {source['chunk_id']}"
    )
