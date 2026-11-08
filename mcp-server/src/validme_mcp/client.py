"""Thin client for the ValidMe REST API, with a mock mode for local development."""

from __future__ import annotations

import os
import uuid
from typing import Any

import httpx

from validme_mcp import mock


class ValidMeError(RuntimeError):
    pass


class ValidMeClient:
    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        use_mock: bool | None = None,
        timeout: float = 30.0,
    ) -> None:
        self.base_url = (base_url or os.getenv("VALIDME_API_URL", "http://localhost:8000/api")).rstrip("/")
        self.api_key = api_key if api_key is not None else os.getenv("VALIDME_API_KEY", "")
        self.use_mock = use_mock if use_mock is not None else os.getenv("VALIDME_MOCK", "0") == "1"
        self.timeout = timeout

    # -- HTTP -----------------------------------------------------------------
    def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        if not self.api_key:
            raise ValidMeError("VALIDME_API_KEY is not set. Create one in ValidMe → Settings → API keys.")
        headers = {"Authorization": f"Api-Key {self.api_key}", **kwargs.pop("headers", {})}
        try:
            resp = httpx.request(method, f"{self.base_url}{path}", headers=headers, timeout=self.timeout, **kwargs)
        except httpx.HTTPError as exc:  # network problem
            raise ValidMeError(f"Could not reach ValidMe API: {exc}") from exc
        if resp.status_code >= 400:
            try:
                msg = resp.json().get("error", {}).get("message", resp.text)
            except ValueError:
                msg = resp.text
            raise ValidMeError(f"ValidMe API error {resp.status_code}: {msg}")
        return resp.json()

    # -- Operations -------------------------------------------------------------
    def start_research(self, idea: str, audience: str, geography: str, depth: str) -> dict[str, Any]:
        if self.use_mock:
            return mock.start_research(idea, audience, geography, depth)
        project = self._request(
            "POST",
            "/projects",
            json={"name": idea[:80], "description": idea, "audiences": [audience], "geographies": [geography]},
        )
        return self._request(
            "POST",
            "/research/jobs",
            json={"project": project["id"], "depth": depth},
            headers={"Idempotency-Key": str(uuid.uuid4())},
        )

    def job_status(self, job_id: str) -> dict[str, Any]:
        if self.use_mock:
            return mock.job_status(job_id)
        return self._request("GET", f"/research/jobs/{job_id}")

    def report(self, project_id: str) -> dict[str, Any]:
        if self.use_mock:
            return mock.report(project_id)
        return self._request("GET", f"/reports/{project_id}")

    def evidence(self, project_id: str, query: str = "", category: str = "") -> dict[str, Any]:
        if self.use_mock:
            return mock.evidence(project_id, query, category)
        params = {"project": project_id, "q": query, "category": category}
        return self._request("GET", "/evidence", params={k: v for k, v in params.items() if v})
