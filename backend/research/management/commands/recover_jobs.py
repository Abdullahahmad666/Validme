from django.core.management.base import BaseCommand

from research.recovery import recover_stuck_jobs


class Command(BaseCommand):
    help = "Fail and refund research jobs whose worker died (stuck PENDING or RUNNING past the time limit)."

    def handle(self, *args, **options):
        n = recover_stuck_jobs()
        self.stdout.write(self.style.SUCCESS(f"Recovered {n} stuck job(s)."))
