
import numpy as np
from rank_bm25 import BM25Okapi

from app.hybrid_retriever import tokenize
from app.vector_store import VectorStore


class PersistentHybridRetriever:
    def __init__(
        self,
        vector_store: VectorStore,
        rrf_k: int = 60
    ):
        if rrf_k <= 0:
            raise ValueError("rrf_k must be positive")

        self.vector_store = vector_store
        self.rrf_k = rrf_k

    def search(
        self,
        question: str,
        top_k: int = 3,
        document_id: str | None = None
    ) -> list[dict]:

        if not question.strip():
            raise ValueError("Question cannot be empty")

        if top_k <= 0:
            raise ValueError("top_k must be positive")

        # Load stored chunks, optionally filtering by document.
        get_options = {
            "include": ["documents", "metadatas"]
        }

        if document_id is not None:
            get_options["where"] = {
                "document_id": document_id
            }

        stored = self.vector_store.collection.get(
            **get_options
        )

        ids = stored["ids"]
        texts = stored["documents"]
        metadata = stored["metadatas"]

        count = len(ids)

        if count == 0:
            return []

        # Semantic retrieval using ChromaDB.
        semantic_results = self.vector_store.search(
            question=question,
            top_k=count,
            document_id=document_id
        )

        semantic_ids = [
            f"{item['document_id']}_chunk_{item['chunk_id']}"
            for item in semantic_results
        ]

        # BM25 keyword retrieval.
        tokenized_docs = [
            tokenize(text)
            for text in texts
        ]

        bm25 = BM25Okapi(tokenized_docs)

        keyword_scores = bm25.get_scores(
            tokenize(question)
        )

        keyword_order = np.argsort(
            -keyword_scores,
            kind="stable"
        )

        keyword_ids = [
            ids[int(index)]
            for index in keyword_order
        ]

        # Reciprocal Rank Fusion.
        combined_scores = {
            record_id: 0.0
            for record_id in ids
        }

        for ranking in [semantic_ids, keyword_ids]:
            for rank, record_id in enumerate(
                ranking,
                start=1
            ):
                combined_scores[record_id] += (
                    1 / (self.rrf_k + rank)
                )

        # Record ranking positions for tie-breaking.
        keyword_rank = {
            record_id: rank
            for rank, record_id in enumerate(
                keyword_ids,
                start=1
            )
        }

        semantic_rank = {
            record_id: rank
            for rank, record_id in enumerate(
                semantic_ids,
                start=1
            )
        }

        # Sort by RRF score, then keyword rank.
        final_ids = sorted(
            ids,
            key=lambda record_id: (
                -combined_scores[record_id],
                keyword_rank[record_id],
                semantic_rank[record_id],
                record_id
            )
        )[:top_k]

        records_by_id = {
            record_id: {
                "text": text,
                "page_number": meta["page_number"],
                "chunk_id": meta["chunk_id"],
                "document_id": meta["document_id"]
            }
            for record_id, text, meta in zip(
                ids,
                texts,
                metadata
            )
        }

        results = []

        for record_id in final_ids:
            result = records_by_id[record_id].copy()

            result["hybrid_score"] = (
                combined_scores[record_id]
            )

            results.append(result)

        return results
