"""Versioned prompt templates. Changing a prompt means a new file (e.g. interpret_v2.md)."""

from pathlib import Path

_DIR = Path(__file__).parent


def load(name: str) -> tuple[str, str]:
    """Return (template, version) for e.g. load("interpret_v1")."""
    return (_DIR / f"{name}.md").read_text(encoding="utf-8"), name
