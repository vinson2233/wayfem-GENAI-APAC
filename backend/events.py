"""
Per-request event emitter for real-time agent progress streaming (SSE).
Uses a ContextVar so agents can emit without threading the emitter through every call signature.
"""
import asyncio
import json
from contextvars import ContextVar
from typing import AsyncIterator, Optional

_emitter_var: ContextVar[Optional["EventEmitter"]] = ContextVar("emitter", default=None)


def get_emitter() -> Optional["EventEmitter"]:
    return _emitter_var.get()


def set_emitter(emitter: Optional["EventEmitter"]) -> None:
    _emitter_var.set(emitter)


class EventEmitter:
    def __init__(self) -> None:
        self._queue: asyncio.Queue = asyncio.Queue()

    def emit(self, agent: str, message: str) -> None:
        self._queue.put_nowait({"type": "agent_event", "agent": agent, "message": message})

    def agent_start(self, agent: str) -> None:
        self._queue.put_nowait({"type": "agent_start", "agent": agent})

    def agent_complete(self, agent: str, summary: str = "") -> None:
        self._queue.put_nowait({"type": "agent_complete", "agent": agent, "summary": summary})

    def complete(self, result: dict) -> None:
        self._queue.put_nowait({"type": "complete", "result": result})

    def error(self, message: str) -> None:
        self._queue.put_nowait({"type": "error", "message": message})

    async def stream(self) -> AsyncIterator[str]:
        while True:
            event = await self._queue.get()
            yield f"data: {json.dumps(event, default=str)}\n\n"
            if event.get("type") in ("complete", "error"):
                break
