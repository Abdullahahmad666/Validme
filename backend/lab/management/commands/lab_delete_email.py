"""Delete one person's email from every Validation Lab waitlist (a deletion request to the support inbox).

    python manage.py lab_delete_email person@example.org            # shows what would be deleted
    python manage.py lab_delete_email person@example.org --confirm  # deletes

Addresses are only stored encrypted, so they're found by their keyed hash. Founders' exported copies (CSV) are
outside our reach: reply to the person with the page owners' contact if they ask about those.
"""

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email

from lab import crypto
from lab.models import WaitlistSignup


class Command(BaseCommand):
    help = "Delete an email address from every Validation Lab waitlist."

    def add_arguments(self, parser):
        parser.add_argument("email")
        parser.add_argument("--confirm", action="store_true", help="actually delete (otherwise only count)")

    def handle(self, *args, **opts):
        email = opts["email"].strip()
        try:
            validate_email(email)
        except ValidationError as exc:
            raise CommandError("That isn't an email address.") from exc
        qs = WaitlistSignup.objects.filter(email_hash=crypto.email_hash(email))
        pages = sorted({s.page.slug or f"page {s.page_id}" for s in qs.select_related("page")})
        if not opts["confirm"]:
            self.stdout.write(f"{qs.count()} sign-up(s) on: {', '.join(pages) or 'no pages'}. Re-run with --confirm to delete.")
            return
        n, _ = qs.delete()
        self.stdout.write(self.style.SUCCESS(f"Deleted {n} sign-up(s) from: {', '.join(pages) or 'no pages'}."))
