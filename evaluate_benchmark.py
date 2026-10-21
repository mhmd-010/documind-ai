
import json
from pathlib import Path

import numpy as np

from app.pdf_processor import extract_text_from_pdf
from app.text_chunker import chunk_pages
from app.embeddings import embed_texts
from app.hybrid_retriever import hybrid_search
from app.evaluation import evaluate_retrieval


# Load benchmark questions.
benchmark_path = Path("evaluation/questions.json")

with benchmark_path.open("r", encoding="utf-8") as file:
    questions = json.load(file)

# Process the PDF once.
pages = extract_text_from_pdf("data/sample.pdf")
chunks = chunk_pages(pages)

# Generate document embeddings once for semantic retrieval.
document_vectors = embed_texts(
    [chunk["text"] for chunk in chunks]
)

results = {
    "Semantic": [],
    "Hybrid": []
}

print("\n=== MULTI-QUESTION RETRIEVAL BENCHMARK ===")

for item in questions:
    question = item["question"]
    answer_text = item["answer_text"]

    # Identify chunks containing the expected answer.
    relevant_ids = {
        chunk["chunk_id"]
        for chunk in chunks
        if answer_text.casefold() in chunk["text"].casefold()
    }

    if not relevant_ids:
        raise ValueError(
            f"No relevant chunk found for {item['id']}: "
            f"{answer_text}"
        )

    # Semantic retrieval.
    query_vector = embed_texts([question])[0]
    semantic_scores = document_vectors @ query_vector

    semantic_ids = [
        chunks[int(index)]["chunk_id"]
        for index in np.argsort(
            -semantic_scores, kind="stable"
        )
    ]

    # Hybrid retrieval.
    hybrid_results = hybrid_search(
        question=question,
        chunks=chunks,
        top_k=len(chunks)
    )

    hybrid_ids = [
        result["chunk_id"]
        for result in hybrid_results
    ]

    # Evaluate both methods.
    for name, retrieved_ids in [
        ("Semantic", semantic_ids),
        ("Hybrid", hybrid_ids)
    ]:
        metrics = evaluate_retrieval(
            retrieved_ids=retrieved_ids,
            relevant_ids=relevant_ids,
            k=3
        )

        results[name].append(metrics)

        print(
            f"{item['id']} | {name:8} | "
            f"Hit@3={metrics['hit_at_k']} | "
            f"Recall@3={metrics['recall_at_k']:.2f} | "
            f"RR={metrics['reciprocal_rank']:.3f}"
        )


# Calculate average performance.
print("\n=== AGGREGATE RESULTS ===")

for name, metrics_list in results.items():
    count = len(metrics_list)

    mean_hit = sum(
        m["hit_at_k"] for m in metrics_list
    ) / count

    mean_recall = sum(
        m["recall_at_k"] for m in metrics_list
    ) / count

    mrr = sum(
        m["reciprocal_rank"] for m in metrics_list
    ) / count

    print(f"\n{name}")
    print(f"Mean Hit@3: {mean_hit:.3f}")
    print(f"Mean Recall@3: {mean_recall:.3f}")
    print(f"MRR: {mrr:.3f}")
