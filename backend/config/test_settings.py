"""Settings for pytest: DEBUG on so the dev SECRET_KEY guard doesn't trip; everything else from settings."""

import os

os.environ.setdefault("DEBUG", "True")

from config.settings import *  # noqa: E402,F403

# Most tests aren't about plan limits; billing/tests sets the real limits explicitly.
PLAN_LIMITS = {
    "free": {
        "depths": ["quick", "standard", "deep"],
        "max_running": 100,
        "daily_launches": 1000,
        "max_watches": 1000,
        "cadences": ["daily", "weekly"],
    },
    "paid": {
        "depths": ["quick", "standard", "deep"],
        "max_running": 100,
        "daily_launches": 1000,
        "max_watches": 1000,
        "cadences": ["daily", "weekly"],
    },
}
LEMONSQUEEZY_TEST_MODE = True
CREDIT_PACKS = []
EVIDENCE_PREVIEW_LIMIT = 100000  # off by default in tests; billing tests set it explicitly
PLAN_LIMITS.update(
    {
        "founder": {**PLAN_LIMITS["paid"], "max_watches": 20},
        "pro": {**PLAN_LIMITS["paid"], "max_watches": 50},
    }
)
EMAIL_PROVIDER = "locmem"
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
SUBSCRIPTION_PLANS = []

# Tasks queued with .delay() run inline in tests (no broker).
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True  # a failing task fails the test

# Fixed test-only Fernet key (pytest runs with DEBUG off, which forbids the dev fallback key).
LAB_ENCRYPTION_KEYS = ["dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHQ="]
LAB_HASH_KEY = "test-hash-key"
