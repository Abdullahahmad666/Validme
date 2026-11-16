"""The perf check command: runs every endpoint, keeps nothing, and refuses to run with DEBUG off unless forced."""

import json

import pytest
from django.core.management import CommandError, call_command

from accounts.models import User
from projects.models import Project


def test_perf_check_measures_and_rolls_back(db, tmp_path):
    out = tmp_path / "perf.json"
    call_command("perf_check", evidence=30, requests=2, force=True, json_path=str(out))
    body = json.loads(out.read_text())
    assert len(body["results"]) >= 20
    assert all(r["status"] == 200 for r in body["results"]), [r for r in body["results"] if r["status"] != 200]
    assert all(r["queries"] > 0 for r in body["results"])  # counting works through the test client
    assert not Project.objects.exists() and not User.objects.filter(email="perf-check@validme.invalid").exists()


def test_perf_check_needs_debug_or_force(db, settings):
    settings.DEBUG = False
    with pytest.raises(CommandError, match="--force"):
        call_command("perf_check", evidence=5, requests=1)
