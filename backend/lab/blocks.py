"""Page blocks: a fixed set of types with plain-text fields and length limits. Nothing a founder writes is ever HTML:
templates autoescape it, there are no link fields, and URLs in text are refused (no phishing or spam links)."""

from __future__ import annotations

import re

from jsonschema import Draft202012Validator

BLOCK_TYPES = ("hero", "problem", "benefits", "pricing", "faq", "waitlist")
MAX_BLOCKS = 12


def _text(max_len: int, min_len: int = 0) -> dict:
    return {"type": "string", "minLength": min_len, "maxLength": max_len}


def _block(kind: str, props: dict, required: list[str]) -> dict:
    return {
        "type": "object",
        "properties": {"type": {"const": kind}, **props},
        "required": ["type", *required],
        "additionalProperties": False,
    }


SCHEMA = {
    "type": "array",
    "maxItems": MAX_BLOCKS,
    "items": {
        "oneOf": [
            _block("hero", {"headline": _text(90, 1), "subheadline": _text(240), "cta_label": _text(30)}, ["headline"]),
            _block("problem", {"heading": _text(80), "body": _text(800, 1)}, ["body"]),
            _block(
                "benefits",
                {
                    "heading": _text(80),
                    "items": {
                        "type": "array",
                        "minItems": 1,
                        "maxItems": 6,
                        "items": {
                            "type": "object",
                            "properties": {"title": _text(60, 1), "body": _text(240)},
                            "required": ["title"],
                            "additionalProperties": False,
                        },
                    },
                },
                ["items"],
            ),
            _block(
                "pricing",
                {
                    "heading": _text(80),
                    "items": {
                        "type": "array",
                        "minItems": 1,
                        "maxItems": 3,
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": _text(40, 1),
                                "price": _text(20, 1),
                                "period": _text(20),
                                "features": {"type": "array", "maxItems": 6, "items": _text(80, 1)},
                            },
                            "required": ["name", "price"],
                            "additionalProperties": False,
                        },
                    },
                },
                ["items"],
            ),
            _block(
                "faq",
                {
                    "heading": _text(80),
                    "items": {
                        "type": "array",
                        "minItems": 1,
                        "maxItems": 8,
                        "items": {
                            "type": "object",
                            "properties": {"q": _text(120, 1), "a": _text(500, 1)},
                            "required": ["q", "a"],
                            "additionalProperties": False,
                        },
                    },
                },
                ["items"],
            ),
            _block("waitlist", {"heading": _text(80), "body": _text(240), "button": _text(30)}, []),
        ]
    },
}
_VALIDATOR = Draft202012Validator(SCHEMA)

# Links of any kind in founder text, checked after NFKC normalisation with invisible characters removed (so
# "evil．com", soft hyphens and zero-width joiners don't help): scheme URLs, www., anything that looks like
# name.tld (any letters, so Cyrillic look-alikes too), "evil. com" (a spaced dot before a lowercase common TLD; a
# capitalised word after ". " is just a new sentence), "evil dot com", and e-mail addresses.
_LINK_PATTERN = re.compile(
    r"(?i)(?:https?|ftp)\s*:|\bwww\s*\.|[^\W_]\s*[.。．｡][^\W\d_]{2,}\b"
    r"|(?-i:[.。．｡]\s+(?:com|net|org|io|app|co|ai|dev|me|xyz|shop|site|online|store)\b)"
    r"|\bdot\s+(?:com|net|org|io|app|co|ai|dev|me|xyz)\b"
    r"|@\s*[^\W_]"
)


def _visible(text: str) -> str:
    import unicodedata

    norm = unicodedata.normalize("NFKC", text)
    return "".join(c for c in norm if unicodedata.category(c) != "Cf")


class _Linky:
    """Same interface as a compiled pattern's .search (used by lab.suggest too)."""

    @staticmethod
    def search(text: str):
        return _LINK_PATTERN.search(_visible(text or ""))


_LINKY = _Linky()
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f​-‏‪-‮⁦-⁩]")

SLUG = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$")
RESERVED_SLUGS = {
    "admin",
    "api",
    "app",
    "login",
    "signup",
    "account",
    "accounts",
    "billing",
    "pay",
    "payment",
    "checkout",
    "support",
    "help",
    "security",
    "verify",
    "password",
    "reset",
    "static",
    "media",
    "assets",
    "robots",
    "sitemap",
    "www",
    "mail",
    "validme",
    "official",
    "settings",
    "privacy",
    "terms",
    "legal",
    "abuse",
    "report",
    "join",
    "p",
}


def _strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from _strings(v)
    elif isinstance(value, list):
        for v in value:
            yield from _strings(v)


def clean_text(text: str) -> str:
    return _CONTROL.sub("", text).strip()


def clean_blocks(blocks: list) -> list:
    """Strip control and bidi characters and surrounding whitespace from every string (applied before validation)."""

    def walk(v):
        if isinstance(v, str):
            return _CONTROL.sub("", v).strip()
        if isinstance(v, dict):
            return {k: walk(x) for k, x in v.items()}
        if isinstance(v, list):
            return [walk(x) for x in v]
        return v

    return walk(blocks)


def validate_blocks(blocks) -> list[str]:
    """Problems that make the blocks unsavable (structure, lengths, links). Empty list = valid."""
    from itertools import islice

    if not isinstance(blocks, list) or len(blocks) > MAX_BLOCKS:
        return [f"A page has at most {MAX_BLOCKS} blocks."]
    problems = []
    for err in sorted(islice(_VALIDATOR.iter_errors(blocks), 5), key=lambda e: list(e.path)):
        where = ".".join(str(p) for p in err.path) or "blocks"
        problems.append(f"{where}: {err.message[:120]}")
    if problems:
        return problems
    for text in _strings(blocks):
        if text in BLOCK_TYPES:
            continue
        if _LINKY.search(text):
            problems.append("Links, web addresses and e-mail addresses aren't allowed in page text.")
            break
    return problems


# Words that make an address look official or like a login/payment page, anywhere in it.
RESERVED_PARTS = (
    "validme",
    "admin",
    "support",
    "login",
    "signin",
    "logon",
    "verify",
    "verification",
    "password",
    "billing",
    "payment",
    "invoice",
    "account",
    "security",
    "official",
    "wallet",
    "bank",
    "paypal",
    "stripe",
    "apple",
    "google",
    "microsoft",
    "amazon",
    "meta",
    "facebook",
    "instagram",
)


def text_problem(text: str) -> str | None:
    """For single-line founder text outside blocks (the page title)."""
    if _LINKY.search(text):
        return "Links, web addresses and e-mail addresses aren't allowed."
    return None


def slug_problem(slug: str) -> str | None:
    if not SLUG.match(slug or ""):
        return "Use 3–48 lowercase letters, numbers and hyphens (not at the start or end)."
    if slug in RESERVED_SLUGS or "--" in slug or any(part in slug for part in RESERVED_PARTS):
        return "That address isn't available."
    from lab.models import RetiredSlug

    if RetiredSlug.objects.filter(slug=slug).exists():
        return "That address was used before and can't be reused."
    return None


def publish_problems(page) -> list[str]:
    """What stops a page from going live. Checked on publish, never silently."""
    problems = validate_blocks(page.blocks)
    kinds = [b.get("type") for b in page.blocks if isinstance(b, dict)]
    if "hero" not in kinds:
        problems.append("Add a hero block: it's the first thing visitors see.")
    if "waitlist" not in kinds:
        problems.append("Add a waitlist block: it's how visitors sign up.")
    if not page.title.strip():
        problems.append("Give the page a title.")
    if page.slug is None:
        problems.append("Choose a web address for the page.")
    return problems
