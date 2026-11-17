"""Django settings for ValidMe. All secrets and environment-specific values come from env vars."""

from pathlib import Path

import environ
from celery.schedules import crontab
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env(DEBUG=(bool, False))
environ.Env.read_env(BASE_DIR.parent / ".env")

VALIDME_BRAND = "ValidMe"

SECRET_KEY = env("DJANGO_SECRET_KEY", default="dev-only-insecure-key-change-me")
DEBUG = env.bool("DEBUG", default=False)  # dev sets DEBUG=True in .env; tests use config.test_settings
if not DEBUG and SECRET_KEY.startswith("dev-only"):
    raise RuntimeError("Set DJANGO_SECRET_KEY when DEBUG is off.")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

# Validation Lab: founder pages are served only on LAB_HOST, a separate origin from the app (no shared cookies).
# Locally 127.0.0.1:8000 (the app uses localhost); in production e.g. pages.<domain> or a separate domain.
LAB_HOST = env("LAB_HOST", default="127.0.0.1:8000")
LAB_ORIGIN = env("LAB_ORIGIN", default=f"http://{LAB_HOST}")
# Fernet keys for respondents' emails, newest first (rotate by prepending). Required when DEBUG is off.
LAB_ENCRYPTION_KEYS = [k.strip() for k in env.list("LAB_ENCRYPTION_KEYS", default=[]) if k.strip()]
LAB_HASH_KEY = env("LAB_HASH_KEY", default="")  # HMAC key for duplicate detection; derived from SECRET_KEY if empty
LAB_PAGES = {
    "free": env.int("LAB_PAGES_FREE", default=1),
    "paid": env.int("LAB_PAGES_PAID", default=1),
    "founder": env.int("LAB_PAGES_FOUNDER", default=3),
    "pro": env.int("LAB_PAGES_PRO", default=10),
}
# Optional Cloudflare Turnstile on the waitlist form (adds Cloudflare's script to Lab pages only).
# Support inbox shown to waitlist respondents for deletion requests and page reports (required in production).
CONTACT_EMAIL = env("CONTACT_EMAIL", default="")
TURNSTILE_SITE_KEY = env("TURNSTILE_SITE_KEY", default="")
TURNSTILE_SECRET_KEY = env("TURNSTILE_SECRET_KEY", default="")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "allauth.headless",
    "accounts",
    "projects",
    "research",
    "evidence",
    "reports",
    "billing",
    "analytics",
    "monitoring",
    "notifications",
    "mailer",
    "radar",
    "distribution",
    "lab",
]

MIDDLEWARE = [
    "lab.middleware.LabHostMiddleware",  # first: founder pages get their own URL map, headers and no cookies
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]
WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {"default": env.db("DATABASE_URL", default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}")}

AUTH_USER_MODEL = "accounts.User"
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "accounts.auth.ApiKeyAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": env("THROTTLE_ANON", default="60/min"),
        "user": env("THROTTLE_USER", default="600/min"),
        # LLM-backed drafting endpoints cost real money and are free to the user.
        "ai": env("THROTTLE_AI", default="30/hour"),
        "checkout": env("THROTTLE_CHECKOUT", default="10/hour"),
        "analytics": env("THROTTLE_ANALYTICS", default="120/hour"),
        # Creating watches / check now / from report: each can make the server fetch pages.
        "monitoring": env("THROTTLE_MONITORING", default="30/hour"),
        # Radar "Check now": re-scores all stored evidence of a project (no network, but not cheap).
        "radar_refresh": env("THROTTLE_RADAR_REFRESH", default="6/hour"),
        # "Where to find your customers" look-ups: YouTube quota and paid keyword data.
        "distribution": env("THROTTLE_DISTRIBUTION", default="6/hour"),
    },
    "EXCEPTION_HANDLER": "config.exceptions.error_envelope_handler",
    # Throttles key on the client IP the proxy appended (X-Forwarded-For), not on a header the client controls.
    # Django must only be reachable through that proxy (see USE_X_FORWARDED_HOST below).
    "NUM_PROXIES": env.int("DRF_NUM_PROXIES", default=1),
}

# Frontend + cookies. The Next.js app proxies /api and /_allauth to Django, so the browser
# sees a single origin and uses Django session cookies + CSRF (no tokens in localStorage).
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:3000")
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[FRONTEND_URL])
SESSION_COOKIE_SECURE = env.bool("SESSION_COOKIE_SECURE", default=not DEBUG)
CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
# Lab isolation guards: cookies must stay host-only and the pages origin must differ from the app's.
if env("SESSION_COOKIE_DOMAIN", default="") or env("CSRF_COOKIE_DOMAIN", default=""):
    raise RuntimeError("Don't set SESSION/CSRF_COOKIE_DOMAIN: app cookies must not reach the Validation Lab pages origin.")
if not DEBUG:
    from urllib.parse import urlsplit as _urlsplit

    if not LAB_ENCRYPTION_KEYS:
        raise RuntimeError("Set LAB_ENCRYPTION_KEYS (Fernet key) when DEBUG is off: waitlist emails are encrypted with it.")
    from cryptography.fernet import Fernet as _Fernet

    try:
        [_Fernet(k.encode()) for k in LAB_ENCRYPTION_KEYS]
    except (ValueError, TypeError) as _exc:
        raise RuntimeError("LAB_ENCRYPTION_KEYS contains an invalid Fernet key.") from _exc
    if not LAB_HASH_KEY:
        raise RuntimeError("Set LAB_HASH_KEY when DEBUG is off (duplicate detection must survive a SECRET_KEY rotation).")
    _lab_domain = LAB_HOST.split(":")[0].rstrip(".").lower()
    if not env("LAB_HOST", default="") or _lab_domain in ("127.0.0.1", "localhost", "::1", "[::1]"):
        raise RuntimeError("Set LAB_HOST to the public pages domain when DEBUG is off.")
    if bool(TURNSTILE_SITE_KEY) != bool(TURNSTILE_SECRET_KEY):
        raise RuntimeError("Set both TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY, or neither.")
    if not CONTACT_EMAIL:
        raise RuntimeError("Set CONTACT_EMAIL when DEBUG is off: waitlist respondents need a way to ask for deletion.")
    if LAB_HOST.split(":")[0].lower() == (_urlsplit(FRONTEND_URL).hostname or "").lower():
        raise RuntimeError("LAB_HOST must be a different host from the app (FRONTEND_URL).")
# Next.js forwards the browser host as X-Forwarded-Host, so URLs Django builds (the Google OAuth
# redirect URI) point at the frontend origin. Django must only be reachable through that proxy.
USE_X_FORWARDED_HOST = env.bool("USE_X_FORWARDED_HOST", default=True)
if env.bool("BEHIND_TLS_PROXY", default=False):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=31536000)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
X_FRAME_OPTIONS = "DENY"
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"

# Email
# Email provider: console (prints, default for local dev) | smtp (e.g. Gmail with an app password) | resend.
EMAIL_PROVIDER = env("EMAIL_PROVIDER", default="console")
EMAIL_BACKEND = {
    "console": "django.core.mail.backends.console.EmailBackend",
    "smtp": "django.core.mail.backends.smtp.EmailBackend",
    "resend": "mailer.backends.ResendEmailBackend",
}.get(EMAIL_PROVIDER, "django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = env("EMAIL_HOST", default="smtp.gmail.com")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")  # Gmail: an app password, never the account password
EMAIL_TIMEOUT = 15
RESEND_API_KEY = env("RESEND_API_KEY", default="")
RESEND_WEBHOOK_SECRET = env("RESEND_WEBHOOK_SECRET", default="")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default=f"{VALIDME_BRAND} <no-reply@localhost>")

# Auth (django-allauth, headless API for the Next.js frontend)
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*"]
ACCOUNT_UNIQUE_EMAIL = True
ACCOUNT_EMAIL_VERIFICATION = env("ACCOUNT_EMAIL_VERIFICATION", default="optional")  # none | optional | mandatory
ACCOUNT_LOGIN_ON_EMAIL_CONFIRMATION = True
HEADLESS_ONLY = True
HEADLESS_CLIENTS = ("browser",)
HEADLESS_FRONTEND_URLS = {
    "account_confirm_email": f"{FRONTEND_URL}/verify-email/{{key}}",
    "account_reset_password_from_key": f"{FRONTEND_URL}/reset-password/{{key}}",
    "account_signup": f"{FRONTEND_URL}/signup",
    "socialaccount_login_error": f"{FRONTEND_URL}/login?error=social",
}
SOCIALACCOUNT_EMAIL_AUTHENTICATION = True
SOCIALACCOUNT_EMAIL_AUTHENTICATION_AUTO_CONNECT = True
GOOGLE_CLIENT_ID = env("GOOGLE_CLIENT_ID", default="")
GOOGLE_CLIENT_SECRET = env("GOOGLE_CLIENT_SECRET", default="")
SOCIALACCOUNT_PROVIDERS: dict = {}
if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET:
    SOCIALACCOUNT_PROVIDERS["google"] = {
        "APPS": [{"client_id": GOOGLE_CLIENT_ID, "secret": GOOGLE_CLIENT_SECRET}],
        "SCOPE": ["profile", "email"],
        "AUTH_PARAMS": {"access_type": "online"},
        "EMAIL_AUTHENTICATION": True,
    }

# Cache (throttling + allauth rate limits). Use Redis in production so limits are shared across workers.
CACHES = {"default": env.cache("CACHE_URL", default="locmemcache://")}
if not DEBUG and "locmem" in CACHES["default"]["BACKEND"].lower():
    # Throttles, the anonymous-analytics cap and monitoring politeness need ONE cache shared by every web
    # and worker process. A per-process cache silently multiplies all of those limits.
    raise ImproperlyConfigured("Set CACHE_URL to Redis (e.g. redis://localhost:6379/1) when DEBUG is off.")

# Celery
CELERY_BROKER_URL = env("REDIS_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = CELERY_BROKER_URL
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=False)
# Run `celery -A config beat` next to the worker: it fails and refunds jobs whose worker died.
CELERY_BEAT_SCHEDULE = {
    "recover-stuck-jobs": {"task": "research.tasks.recover_stuck_jobs_task", "schedule": 300.0},
    "monitoring-due-watches": {"task": "monitoring.tasks.run_due_watches", "schedule": 300.0},
    # Weekly, Monday morning UTC: look for new competitors first, then send the digest that lists them.
    "detect-new-competitors": {
        "task": "monitoring.tasks.detect_new_competitors",
        "schedule": crontab(hour=5, minute=0, day_of_week=1),
    },
    # Then re-score every researched project and look for Radar signals, so the digest includes them.
    "radar-revalidate": {"task": "radar.tasks.revalidate_all", "schedule": crontab(hour=6, minute=0, day_of_week=1)},
    # YouTube API data may be stored for at most 30 days: delete expired rows daily.
    "purge-youtube": {"task": "distribution.tasks.purge_expired_youtube", "schedule": crontab(hour=3, minute=30)},
    # Waitlist sign-ups past their retention period are deleted daily.
    "purge-lab-signups": {"task": "lab.tasks.purge_expired_signups", "schedule": crontab(hour=3, minute=45)},
    "weekly-digest": {"task": "mailer.tasks.send_weekly_digests", "schedule": crontab(hour=8, minute=0, day_of_week=1)},
}
JOB_PENDING_TIMEOUT_MINUTES = env.int("JOB_PENDING_TIMEOUT_MINUTES", default=15)
JOB_RUNNING_TIMEOUT_MINUTES = env.int("JOB_RUNNING_TIMEOUT_MINUTES", default=45)
# Workers stop before recovery would act, so a job is never both refunded and completed.
CELERY_TASK_SOFT_TIME_LIMIT = max(60, (JOB_RUNNING_TIMEOUT_MINUTES - 5) * 60)
CELERY_TASK_TIME_LIMIT = max(120, (JOB_RUNNING_TIMEOUT_MINUTES - 2) * 60)

# Research providers (empty key => provider shows REQUIRES_CONNECTION)
BRAVE_SEARCH_API_KEY = env("BRAVE_SEARCH_API_KEY", default="")
EXA_API_KEY = env("EXA_API_KEY", default="")
STACKEXCHANGE_API_KEY = env("STACKEXCHANGE_API_KEY", default="")
# GitHub issues search: works without a token at a low limit; a fine-grained token with no permissions raises it.
GITHUB_TOKEN = env("GITHUB_TOKEN", default="")
# YouTube Data API v3 (public data, API key). Stored data expires after 30 days (YouTube API policy).
YOUTUBE_API_KEY = env("YOUTUBE_API_KEY", default="")
YOUTUBE_DAILY_UNITS = env.int("YOUTUBE_DAILY_UNITS", default=9000)  # stay under the 10,000/day project quota
YOUTUBE_USER_DAILY_UNITS = env.int("YOUTUBE_USER_DAILY_UNITS", default=1300)  # ~4 look-ups per account per day
# Keyword demand (DataForSEO, paid per request): per-plan keywords per account per month + a global monthly budget.
DATAFORSEO_LOGIN = env("DATAFORSEO_LOGIN", default="")
DATAFORSEO_PASSWORD = env("DATAFORSEO_PASSWORD", default="")
DATAFORSEO_MONTHLY_BUDGET_USD = env.float("DATAFORSEO_MONTHLY_BUDGET_USD", default=20.0)
KEYWORD_LOOKUPS_MONTHLY = {
    "free": env.int("KEYWORD_LOOKUPS_FREE", default=10),
    "paid": env.int("KEYWORD_LOOKUPS_PAID", default=10),
    "founder": env.int("KEYWORD_LOOKUPS_FOUNDER", default=100),
    "pro": env.int("KEYWORD_LOOKUPS_PRO", default=300),
}

# LLM
LLM_PROVIDER = env("LLM_PROVIDER", default="anthropic")  # only "anthropic" is implemented
LLM_MODEL = env("LLM_MODEL", default="claude-opus-5-5")
LLM_EFFORT = env("LLM_EFFORT", default="medium")  # low | medium | high | xhigh | max
ANTHROPIC_API_KEY = env("ANTHROPIC_API_KEY", default="")
OPENAI_API_KEY = env("OPENAI_API_KEY", default="")

# Credits per research depth (internal budgets live in research/budgets.py)
CREDITS_PER_DEPTH = {"quick": 1, "standard": 2, "deep": 4}
FREE_SIGNUP_CREDITS = 1

# Plan limits, enforced at launch (billing/plans.py). "paid" = has bought a credit pack.
# Plans (prices live in Lemon Squeezy and frontend/src/content/pricing.ts; these are the entitlements).
#   free  : $0             paid (any credit pack): research depths unlocked
#   founder: $19/mo, $190/yr   pro: $39/mo, $390/yr  (monitoring capacity + monthly credits)
# max_watches = pages monitored per account; cadences = allowed check frequencies (last = fallback).
_ALL_DEPTHS = ["quick", "standard", "deep"]
PLAN_LIMITS = {
    "free": {"depths": ["quick"], "max_running": 1, "daily_launches": 3, "max_watches": 3, "cadences": ["weekly"]},
    "paid": {"depths": _ALL_DEPTHS, "max_running": 3, "daily_launches": 20, "max_watches": 3, "cadences": ["weekly"]},
    "founder": {"depths": _ALL_DEPTHS, "max_running": 3, "daily_launches": 20, "max_watches": 20, "cadences": ["daily", "weekly"]},
    "pro": {"depths": _ALL_DEPTHS, "max_running": 5, "daily_launches": 40, "max_watches": 50, "cadences": ["daily", "weekly"]},
}

# Monitoring (competitor pages). Locally: `manage.py monitor [--loop]`; in production Celery beat runs it.
MONITORING_BATCH_SIZE = env.int("MONITORING_BATCH_SIZE", default=100)  # watches claimed per cycle
MONITORING_LEASE_MINUTES = 15  # a claimed watch isn't re-claimed for this long (crash → retried later)
MONITORING_HOST_INTERVAL = env.int("MONITORING_HOST_INTERVAL", default=30)  # seconds between requests to one host
MONITORING_MAX_ERRORS = 5  # failed checks in a row before a watch pauses itself
MONITORING_KEEP_OBSERVATIONS = 10  # plus any referenced by a kept change
MONITORING_KEEP_CHANGES = 100  # per watch; older changes (and the observations only they used) are pruned
MONITORING_MANUAL_COOLDOWN_MINUTES = 10
MONITORING_MAX_WATCHES_PER_PROJECT = 20
MONITORING_MAX_WATCHES_PER_USER = 50
# AI summaries of detected changes per account per day, by plan (cost guard; extra changes keep the factual summary).
MONITORING_AI_DAILY = {
    "free": env.int("MONITORING_AI_DAILY_FREE", default=10),
    "paid": env.int("MONITORING_AI_DAILY_PAID", default=10),
    "founder": env.int("MONITORING_AI_DAILY_FOUNDER", default=100),
    "pro": env.int("MONITORING_AI_DAILY_PRO", default=300),
}

# Free plan: evidence explorer/search shows this many records per project (reports are never limited).
EVIDENCE_PREVIEW_LIMIT = env.int("EVIDENCE_PREVIEW_LIMIT", default=10)
# Global cap on anonymous analytics events per day (storage guard on top of the per-IP throttle).
ANALYTICS_ANON_DAILY_CAP = env.int("ANALYTICS_ANON_DAILY_CAP", default=20000)

# Payments: Lemon Squeezy is the merchant of record (handles tax/VAT). Without these, buying is closed.
LEMONSQUEEZY_API_KEY = env("LEMONSQUEEZY_API_KEY", default="")
LEMONSQUEEZY_STORE_ID = env("LEMONSQUEEZY_STORE_ID", default="")
LEMONSQUEEZY_WEBHOOK_SECRET = env("LEMONSQUEEZY_WEBHOOK_SECRET", default="")
# Defaults to DEBUG: production (DEBUG off) honours live orders unless test mode is set explicitly.
LEMONSQUEEZY_TEST_MODE = env.bool("LEMONSQUEEZY_TEST_MODE", default=DEBUG)
# JSON list of packs: [{"id": "starter", "credits": 6, "variant_id": "123456"}]. Prices live in Lemon Squeezy.
CREDIT_PACKS = env.json("CREDIT_PACKS", default=[])
# Subscription plans: variant ids from Lemon Squeezy + credits granted on each paid invoice.
# [{"id":"founder","monthly_variant_id":"1","yearly_variant_id":"2","monthly_credits":4},
#  {"id":"pro","monthly_variant_id":"3","yearly_variant_id":"4","monthly_credits":10}]
SUBSCRIPTION_PLANS = env.json("SUBSCRIPTION_PLANS", default=[])

# Logs go to stdout (the platform collects them). Never log request bodies, headers or keys.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"plain": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "plain"}},
    "root": {"handlers": ["console"], "level": env("LOG_LEVEL", default="INFO")},
    "loggers": {"httpx": {"level": "WARNING"}, "httpcore": {"level": "WARNING"}},
}
