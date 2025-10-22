"""Utility module to interact with a local LLaMA-compatible model."""

from __future__ import annotations

import os
import threading
from typing import Optional

from pydantic import BaseModel

try:
    from llama_cpp import Llama  # type: ignore
except ImportError:  # pragma: no cover - handled gracefully at runtime
    Llama = None  # type: ignore


class LLMConfig(BaseModel):
    model_path: Optional[str] = os.getenv("LLM_MODEL_PATH")
    n_ctx: int = int(os.getenv("LLM_CONTEXT_TOKENS", "4096"))
    n_threads: int = int(os.getenv("LLM_THREADS", str(os.cpu_count() or 4)))
    temperature: float = float(os.getenv("LLM_TEMPERATURE", "0.6"))
    top_p: float = float(os.getenv("LLM_TOP_P", "0.9"))
    max_tokens: int = int(os.getenv("LLM_MAX_TOKENS", "512"))


class LocalLLM:
    """Wrapper around llama-cpp to keep a singleton model in memory."""

    _instance: Optional["LocalLLM"] = None
    _lock = threading.Lock()

    def __init__(self, config: Optional[LLMConfig] = None) -> None:
        self.config = config or LLMConfig()
        self._model = None
        self._available = False

        if Llama is None:
            return
        if not self.config.model_path:
            return
        if not os.path.exists(self.config.model_path):
            return
        try:
            self._model = Llama(
                model_path=self.config.model_path,
                n_ctx=self.config.n_ctx,
                n_threads=self.config.n_threads,
                verbose=False,
            )
            self._available = True
        except Exception:
            self._model = None
            self._available = False

    @classmethod
    def instance(cls) -> "LocalLLM":
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    @property
    def available(self) -> bool:
        return self._available and self._model is not None

    def generate(self, prompt: str, temperature: Optional[float] = None) -> str:
        if not self.available:
            return (
                "AI engine is not available. Please configure LLM_MODEL_PATH with a local "
                "GGUF model to enable on-device generation."
            )
        sampling_temp = temperature if temperature is not None else self.config.temperature
        output = self._model(
            prompt,
            max_tokens=self.config.max_tokens,
            temperature=sampling_temp,
            top_p=self.config.top_p,
            stop=["</s>"],
        )
        choices = output.get("choices", [])
        if not choices:
            return ""
        return choices[0].get("text", "").strip()


def get_llm() -> LocalLLM:
    return LocalLLM.instance()
