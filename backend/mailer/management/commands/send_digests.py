from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from mailer.digest import recipients, send_digest


class Command(BaseCommand):
    help = "Send this week's digest locally (uses EMAIL_PROVIDER). --dry-run shows who would get one."

    def add_arguments(self, parser):
        parser.add_argument("--user", help="Only this email address.")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opts):
        users = recipients()
        if opts["user"]:
            users = get_user_model().objects.filter(email__iexact=opts["user"])
            if not users.exists():
                raise CommandError("No user with that email.")
        for user in users:
            status = send_digest(user, dry_run=opts["dry_run"])
            self.stdout.write(f"{user.pk}: {status}")
