from django.core.management.base import BaseCommand

from monitoring.candidates import detect
from monitoring.models import Watch
from projects.models import Project


class Command(BaseCommand):
    help = "Look for new competitors locally (recent Show HN launches matching each monitored project's searches)."

    def add_arguments(self, parser):
        parser.add_argument("--project", help="Only this project id.")

    def handle(self, *args, **opts):
        qs = (
            Project.objects.filter(pk=opts["project"])
            if opts["project"]
            else Project.objects.filter(pk__in=Watch.objects.filter(active=True).values("project_id"))
        )
        for project in qs:
            self.stdout.write(f"{project.pk}: {detect(project)} new candidate(s)")
