
import re

import numpy as np
from rank_bm25 import BM25Okapi

from app.embeddings import embed_texts


def tokenize(text: str) -> list[str]:
    """
    Convert text into lowercase searchable words.
    """
    return re.findall(r"\b\w+\b", text.lower())


def hybrid_search(
    question: str,
    chunks: list[dict],
    top_k: int = 3,
    rrf_k: int = 60
) -> list[dict]:
    """
    Combine semantic search and BM25 using
    Reciprocal Rank Fusion.
    """

    if not chunks or top_k <= 0:
        return []

    if not question.strip():
        raise ValueError("Question cannot be empty")

    texts = [chunk["text"] for chunk in chunks]

    # Step 1: Generate semantic embeddings.
    document_vectors = embed_texts(texts)
    query_vector = embed_texts([question])[0]

    # Embeddings are normalised, so the dot
    # product gives cosine similarity.
    semantic_scores = document_vectors @ query_vector

    # Step 2: Calculate keyword-based BM25 scores.
    tokenized_docs = [tokenize(text) for text in texts]

    bm25 = BM25Okapi(tokenized_docs)

    keyword_scores = bm25.get_scores(
        tokenize(question)
    )

    # Step 3: Rank documents independently.
    semantic_ranking = np.argsort(
        -semantic_scores, kind="stable"
    )

    keyword_ranking = np.argsort(
        -keyword_scores, kind="stable"
    )

    # Step 4: Fuse the two rankings.
    combined_scores = np.zeros(len(chunks))

    for ranking in [semantic_ranking, keyword_ranking]:
        for rank, index in enumerate(ranking, start=1):
            combined_scores[index] += 1 / (rrf_k + rank)

    # Step 5: Return highest-ranked chunks.
    final_ranking = np.argsort(
        -combined_scores, kind="stable"
    )[:top_k]

    results = []

    for index in final_ranking:
        result = chunks[int(index)].copy()
        result["hybrid_score"] = float(
            combined_scores[index]
        )
        results.append(result)

    return results
