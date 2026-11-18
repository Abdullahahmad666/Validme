"""What an API key (MCP server) may do, by scope (Week 15). Default deny: a request a key's scopes don't cover is refused
in authentication, before any view runs, so a new endpoint is unreachable by keys until it's listed here.

Never reachable with a key, whatever its scopes: account and key management, billing actions, Lab sign-ups / survey
answers / exports (personal data), creating or checking watches (fetch proxy), publishing, deleting, AI suggestions.
Views keep their own checks too (ApiKeysReadOnly and friends); this table is the first gate, not the only one.
"""

from __future__ import annotations

import re

SCOPES = {
    "research:read": "Read projects, reports and evidence",
    "research:run": "Start research (spends credits)",
    "monitoring:read": "Read watches, changes, new competitors, Radar signals and score history",
    "monitoring:write": "Mark Radar signals as seen, acted on or dismissed",
    "lab:read": "Read Lab pages, surveys and results as counts (never emails or answers)",
    "assumptions:write": "Set an assumption's status or note, or hand it back to the survey result",
}
# What a key gets when no scopes are chosen, and what keys made before scopes existed keep: the same reach as before
# (read everything a key could read, and start research). Write scopes are always opt-in.
DEFAULT_SCOPES = ["research:read", "research:run", "monitoring:read", "lab:read"]

_ID = r"[^/]+"
_P = rf"/api/projects/{_ID}"
_READ = ("GET", "HEAD", "OPTIONS")
RULES: list[tuple[tuple[str, ...], re.Pattern, str]] = [
    (methods, re.compile(f"^{pattern}/?$"), scope)
    for methods, pattern, scope in [
        # research
        (_READ, r"/api/(me|health|dashboard/summary|research/sources|research/estimate|billing/packs|billing/usage)", "research:read"),
        (_READ, rf"/api/research/jobs(/{_ID})?", "research:read"),
        (_READ, rf"/api/reports/{_ID}(/history|/export|/competitive-matrix)?", "research:read"),
        (_READ, r"/api/projects(/compare)?", "research:read"),
        (_READ, rf"{_P}(/unit-economics|/distribution)?", "research:read"),
        (_READ, rf"{_P}/(queries|assumptions)(/{_ID})?", "research:read"),
        (_READ, rf"/api/evidence(/clusters|/facets|/{_ID})?", "research:read"),
        (("POST",), r"/api/projects", "research:run"),
        (("POST",), rf"{_P}/keywords/generate", "research:run"),
        (("POST",), r"/api/research/jobs", "research:run"),
        # monitoring and Radar
        (_READ, r"/api/(notifications|monitoring/changes)", "monitoring:read"),
        (_READ, rf"{_P}/(watches|changes|candidates|signals)(/{_ID})?", "monitoring:read"),
        (_READ, rf"{_P}/score-history", "monitoring:read"),
        (("PATCH",), rf"{_P}/signals/{_ID}", "monitoring:write"),
        # Validation Lab: counts only
        (_READ, rf"{_P}/(lab-pages|lab-surveys)(/{_ID}(/stats|/results)?)?", "lab:read"),
        (_READ, rf"{_P}/(predicted-vs-actual|lab-notices)", "lab:read"),
        # assumptions: the founder's call, so a separate opt-in scope
        (("PATCH",), rf"{_P}/assumptions/{_ID}", "assumptions:write"),
    ]
]
# A route that matches a rule's path for reads but is personal data. Checked first.
NEVER = re.compile(rf"^{_P}/(lab-pages|lab-surveys)/{_ID}/(signups|signups-export|responses|responses-export)(/.*)?/?$")


def required_scope(method: str, path: str) -> str | None:
    """The scope a key needs for this request, or None if keys may never do it."""
    if NEVER.match(path):
        return None
    for methods, pattern, scope in RULES:
        if method in methods and pattern.match(path):
            return scope
    return None


def clean_scopes(raw) -> list[str]:
    """Known scopes only, de-duplicated, in a stable order."""
    chosen = set(raw or [])
    return [s for s in SCOPES if s in chosen]
