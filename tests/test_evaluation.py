
import pytest

from app.evaluation import evaluate_retrieval


def test_relevant_result_at_rank_three():
    results = evaluate_retrieval(
        retrieved_ids=[21, 17, 2, 11, 12],
        relevant_ids={2},
        k=3
    )

    assert results["hit_at_k"] == 1
    assert results["recall_at_k"] == 1.0
    assert results["reciprocal_rank"] == pytest.approx(1 / 3)


def test_relevant_result_outside_top_three():
    results = evaluate_retrieval(
        retrieved_ids=[21, 11, 17, 12, 2],
        relevant_ids={2},
        k=3
    )

    assert results["hit_at_k"] == 0
    assert results["recall_at_k"] == 0.0
    assert results["reciprocal_rank"] == pytest.approx(1 / 5)


def test_no_relevant_result():
    results = evaluate_retrieval(
        retrieved_ids=[21, 17, 11],
        relevant_ids={2},
        k=3
    )

    assert results["hit_at_k"] == 0
    assert results["recall_at_k"] == 0.0
    assert results["reciprocal_rank"] == 0.0


def test_invalid_k():
    with pytest.raises(ValueError):
        evaluate_retrieval([1, 2], {1}, k=0)
