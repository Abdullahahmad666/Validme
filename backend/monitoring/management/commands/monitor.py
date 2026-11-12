import time

from django.core.management.base import BaseCommand

from monitoring.engine import run_cycle


class Command(BaseCommand):
    help = "Run monitoring checks locally without Celery: one cycle (default) or --loop every N seconds."

    def add_arguments(self, parser):
        parser.add_argument("--loop", action="store_true", help="Keep running cycles until stopped (Ctrl+C).")
        parser.add_argument("--interval", type=int, default=60, help="Seconds between cycles with --loop.")
        parser.add_argument("--limit", type=int, default=None, help="Max watches per cycle.")

    def handle(self, *args, **opts):
        while True:
            counts = run_cycle(opts["limit"])
            self.stdout.write(f"checked {sum(counts.values())} watch(es): {counts or 'none due'}")
            if not opts["loop"]:
                return
            time.sleep(max(5, opts["interval"]))
