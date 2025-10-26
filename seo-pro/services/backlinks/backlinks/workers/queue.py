from __future__ import annotations

from redis import Redis
from rq import Queue

from backlinks.core.config import settings

redis = Redis.from_url(settings.redis_url)
queue = Queue("backlinks", connection=redis)


def enqueue_backlink_discovery(domain_id: int, limit: int = 50) -> None:
    """Enqueue a simulated crawl job for a domain."""
    queue.enqueue("backlinks.workers.jobs.discover_backlinks", domain_id=domain_id, limit=limit)

