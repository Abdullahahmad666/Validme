"""Settings for pytest: DEBUG on so the dev SECRET_KEY guard doesn't trip; everything else from settings."""

import os

os.environ.setdefault("DEBUG", "True")

from config.settings import *  # noqa: E402,F403

# Most tests aren't about plan limits; billing/tests sets the real limits explicitly.
PLAN_LIMITS = {
    "free": {"depths": ["quick", "standard", "deep"], "max_running": 100, "daily_launches": 1000},
    "paid": {"depths": ["quick", "standard", "deep"], "max_running": 100, "daily_launches": 1000},
}
LEMONSQUEEZY_TEST_MODE = True
CREDIT_PACKS = []
