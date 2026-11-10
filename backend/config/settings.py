"""Django settings for ValidMe. All secrets and environment-specific values come from env vars."""

from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env(DEBUG=(bool, False))
environ.Env.read_env(BASE_DIR.parent / ".env")

VALIDME_BRAND = "ValidMe"

SECRET_KEY = env("DJANGO_SECRET_KEY", default="dev-only-insecure-key-change-me")
DEBUG = env.bool("DEBUG", default=False)  # dev sets DEBUG=True in .env; tests use config.test_settings
if not DEBUG and SECRET_KEY.startswith("dev-only"):
    raise RuntimeError("Set DJANGO_SECRET_KEY when DEBUG is off.")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

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
]

MIDDLEWARE = [
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
    },
    "EXCEPTION_HANDLER": "config.exceptions.error_envelope_handler",
}

# Frontend + cookies. The Next.js app proxies /api and /_allauth to Django, so the browser
# sees a single origin and uses Django session cookies + CSRF (no tokens in localStorage).
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:3000")
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[FRONTEND_URL])
SESSION_COOKIE_SECURE = env.bool("SESSION_COOKIE_SECURE", default=not DEBUG)
CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
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
EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")
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

# Celery
CELERY_BROKER_URL = env("REDIS_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = CELERY_BROKER_URL
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=False)
# Run `celery -A config beat` next to the worker: it fails and refunds jobs whose worker died.
CELERY_BEAT_SCHEDULE = {
    "recover-stuck-jobs": {"task": "research.tasks.recover_stuck_jobs_task", "schedule": 300.0},
}
JOB_PENDING_TIMEOUT_MINUTES = env.int("JOB_PENDING_TIMEOUT_MINUTES", default=15)
JOB_RUNNING_TIMEOUT_MINUTES = env.int("JOB_RUNNING_TIMEOUT_MINUTES", default=45)

# Research providers (empty key => provider shows REQUIRES_CONNECTION)
BRAVE_SEARCH_API_KEY = env("BRAVE_SEARCH_API_KEY", default="")
EXA_API_KEY = env("EXA_API_KEY", default="")
STACKEXCHANGE_API_KEY = env("STACKEXCHANGE_API_KEY", default="")

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
PLAN_LIMITS = {
    "free": {"depths": ["quick"], "max_running": 1, "daily_launches": 3},
    "paid": {"depths": ["quick", "standard", "deep"], "max_running": 3, "daily_launches": 20},
}

# Payments: Lemon Squeezy is the merchant of record (handles tax/VAT). Without these, buying is closed.
LEMONSQUEEZY_API_KEY = env("LEMONSQUEEZY_API_KEY", default="")
LEMONSQUEEZY_STORE_ID = env("LEMONSQUEEZY_STORE_ID", default="")
LEMONSQUEEZY_WEBHOOK_SECRET = env("LEMONSQUEEZY_WEBHOOK_SECRET", default="")
LEMONSQUEEZY_TEST_MODE = env.bool("LEMONSQUEEZY_TEST_MODE", default=True)
# JSON list of packs: [{"id": "starter", "credits": 6, "variant_id": "123456"}]. Prices live in Lemon Squeezy.
CREDIT_PACKS = env.json("CREDIT_PACKS", default=[])

# Logs go to stdout (the platform collects them). Never log request bodies, headers or keys.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"plain": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "plain"}},
    "root": {"handlers": ["console"], "level": env("LOG_LEVEL", default="INFO")},
    "loggers": {"httpx": {"level": "WARNING"}, "httpcore": {"level": "WARNING"}},
}
