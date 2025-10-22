"""Keyword clustering and enrichment helpers."""

from __future__ import annotations

from typing import List, Sequence

from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer


def cluster_keywords(
    keywords: Sequence[str],
    n_clusters: int | None = None,
    random_state: int = 42,
) -> List[int]:
    if not keywords:
        return []

    distinct_keywords = list(dict.fromkeys(keywords))
    cluster_count = n_clusters or min(8, max(1, len(distinct_keywords) // 3))
    cluster_count = max(1, min(cluster_count, len(distinct_keywords)))

    vectorizer = TfidfVectorizer(ngram_range=(1, 2), analyzer="word")
    matrix = vectorizer.fit_transform(distinct_keywords)
    model = KMeans(n_clusters=cluster_count, random_state=random_state, n_init="auto")
    labels = model.fit_predict(matrix)

    label_lookup = {kw: label for kw, label in zip(distinct_keywords, labels)}
    return [label_lookup.get(kw, 0) for kw in keywords]
