
from app.vector_store import VectorStore


# Open the database from a new Python process.
store = VectorStore()

print("Chunks loaded from disk:", store.count())

results = store.search(
    "Who is the dissertation module leader?",
    top_k=3
)

for result in results:
    print(
        f"Page {result['page_number']}: "
        f"{result['text'][:200]}"
    )
