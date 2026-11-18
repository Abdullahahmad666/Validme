"""Create (or reset) the end-to-end test user: verified email and enough credits to launch research.

Development only: refuses to run with DEBUG off, so it can never create a known-password account in production.
    python manage.py seed_e2e_user [--email e2e@example.com] [--password ...] [--credits 10]
"""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Create the Playwright test user (DEBUG only)."

    def add_arguments(self, parser):
        parser.add_argument("--email", default="e2e@example.com")
        parser.add_argument("--password", default="e2e-pass-12345")
        parser.add_argument("--credits", type=int, default=10)

    def handle(self, *args, **opts):
        if not settings.DEBUG:
            raise CommandError("seed_e2e_user only runs with DEBUG on.")
        from allauth.account.models import EmailAddress

        from accounts.models import User

        email = opts["email"].lower()
        user, _ = User.objects.get_or_create(email=email, defaults={"username": email.split("@")[0]})
        user.set_password(opts["password"])
        user.credits = opts["credits"]
        user.is_active = True
        user.save()
        EmailAddress.objects.update_or_create(user=user, email=email, defaults={"verified": True, "primary": True})
        self.stdout.write(f"E2E user ready: {email} ({user.credits} credits)")
