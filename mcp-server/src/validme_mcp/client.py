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
        name = " ".join(idea.split())[:80]
        project = self._request(
            "POST",
            "/projects",
            json={"name": name, "description": idea, "audiences": [audience], "geographies": [geography]},
        )
        try:
            # Search queries in the customer's words. Optional: without AI the job searches the idea text itself.
            self._request("POST", f"/projects/{project['id']}/keywords/generate", json={})
        except ValidMeError:
            pass
        job = self._request(
            "POST",
            "/research/jobs",
            json={"project": project["id"], "depth": depth},
            headers={"Idempotency-Key": str(uuid.uuid4())},
        )
        return {
            "job_id": job["id"],
            "project_id": project["id"],
            "status": job.get("status"),
            "credits_charged": job.get("credits_charged"),
            "next": "Poll get_research_status(job_id) until it is COMPLETED or PARTIALLY_COMPLETED, then get_report(project_id).",
        }

    def job_status(self, job_id: str) -> dict[str, Any]:
        if self.use_mock:
            return mock.job_status(job_id)
        return self._request("GET", f"/research/jobs/{job_id}")

    def report(self, project_id: str, report_id: int | None = None) -> dict[str, Any]:
        if self.use_mock:
            return mock.report(project_id)
        return self._request("GET", f"/reports/{project_id}", params={"report": report_id} if report_id else None)

    def history(self, project_id: str) -> dict[str, Any]:
        if self.use_mock:
            return mock.history(project_id)
        return self._request("GET", f"/reports/{project_id}/history")

    def evidence(self, project_id: str, query: str = "", category: str = "") -> dict[str, Any]:
        if self.use_mock:
            return mock.evidence(project_id, query, category)
        params = {"project": project_id, "q": query, "category": category}
        return self._request("GET", "/evidence", params={k: v for k, v in params.items() if v})

    # -- Week 15: monitoring, Radar, Lab (each needs its scope on the API key) -------------------------------------
    def _project_path(self, project_id: str, rest: str) -> str:
        from urllib.parse import quote

        return f"/projects/{quote(str(project_id), safe='')}/{rest}"

    def watches(self, project_id: str) -> dict[str, Any]:
        if self.use_mock:
            return mock.watches(project_id)
        return self._request("GET", self._project_path(project_id, "watches"))

    def changes(self, project_id: str) -> dict[str, Any]:
        if self.use_mock:
            return mock.changes(project_id)
        return self._request("GET", self._project_path(project_id, "changes"))

    def signals(self, project_id: str, status: str = "open") -> dict[str, Any]:
        if self.use_mock:
            return mock.signals(project_id, status)
        return self._request("GET", self._project_path(project_id, "signals"), params={"status": status})

    def score_history(self, project_id: str) -> dict[str, Any]:
        if self.use_mock:
            return mock.score_history(project_id)
        return self._request("GET", self._project_path(project_id, "score-history"))

    def update_signal(self, project_id: str, signal_id: int, status: str, feedback: str = "") -> dict[str, Any]:
        if self.use_mock:
            return mock.update_signal(project_id, signal_id, status, feedback)
        body: dict[str, Any] = {"status": status}
        if feedback:
            body["feedback"] = feedback
        return self._request("PATCH", self._project_path(project_id, f"signals/{int(signal_id)}"), json=body)

    def lab_results(self, project_id: str) -> dict[str, Any]:
        """Pages with their stats and surveys with their aggregate results. Never emails or individual answers."""
        if self.use_mock:
            return mock.lab_results(project_id)
        pages = self._request("GET", self._project_path(project_id, "lab-pages"))
        surveys = self._request("GET", self._project_path(project_id, "lab-surveys"))
        out_pages = [
            {
                "id": p["id"],
                "title": p["title"],
                "status": p["status"],
                "stats": self._request("GET", self._project_path(project_id, f"lab-pages/{int(p['id'])}/stats")),
            }
            for p in pages
        ]
        out_surveys = [
            {
                "id": s["id"],
                "title": s["title"],
                "status": s["status"],
                "results": self._request("GET", self._project_path(project_id, f"lab-surveys/{int(s['id'])}/results")),
            }
            for s in surveys
        ]
        return {"project_id": project_id, "pages": out_pages, "surveys": out_surveys}

    def predicted_vs_actual(self, project_id: str) -> dict[str, Any]:
        if self.use_mock:
            return mock.predicted_vs_actual(project_id)
        return self._request("GET", self._project_path(project_id, "predicted-vs-actual"))

    def set_assumption(self, project_id: str, assumption_id: int, body: dict[str, Any]) -> dict[str, Any]:
        if self.use_mock:
            return mock.set_assumption(project_id, assumption_id, body)
        return self._request("PATCH", self._project_path(project_id, f"assumptions/{int(assumption_id)}"), json=body)
