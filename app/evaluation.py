
def evaluate_retrieval(
    retrieved_ids: list[int],
    relevant_ids: set[int],
    k: int = 3
) -> dict:
    """
    Evaluate retrieval using:
    - Hit@K
    - Recall@K
    - Reciprocal Rank
    """

    if k <= 0:
        raise ValueError("k must be positive")

    if not relevant_ids:
        raise ValueError(
            "At least one relevant chunk is required"
        )

    top_k = retrieved_ids[:k]

    # Count relevant chunks retrieved.
    retrieved_relevant = set(top_k) & relevant_ids

    hit = int(bool(retrieved_relevant))

    recall = (
        len(retrieved_relevant) / len(relevant_ids)
    )

    # Find the first relevant result.
    reciprocal_rank = 0.0

    for rank, chunk_id in enumerate(
        retrieved_ids, start=1
    ):
        if chunk_id in relevant_ids:
            reciprocal_rank = 1 / rank
            break

    return {
        "hit_at_k": hit,
        "recall_at_k": recall,
        "reciprocal_rank": reciprocal_rank
    }
