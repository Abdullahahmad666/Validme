"""Settings for pytest: DEBUG on so the dev SECRET_KEY guard doesn't trip; everything else from settings."""

import os

os.environ.setdefault("DEBUG", "True")

from config.settings import *  # noqa: E402,F403
