"""Seed the assumption tracker for projects whose reports predate it, from each latest report snapshot."""

from django.db import migrations


def backfill(apps, schema_editor):
    Assumption = apps.get_model("projects", "Assumption")
    Report = apps.get_model("reports", "Report")
    seen = set()
    for r in Report.objects.order_by("project_id", "-created_at").only("project_id", "content").iterator():
        if r.project_id in seen:
            continue  # only the newest report per project
        seen.add(r.project_id)
        room = 30 - Assumption.objects.filter(project_id=r.project_id).count()
        for a in ((r.content or {}).get("opportunity") or {}).get("assumptions") or []:
            text = " ".join(str(a.get("text", "")).split())[:300]
            if room <= 0 or len(text) < 5:
                break
            _, created = Assumption.objects.get_or_create(
                project_id=r.project_id, text=text, defaults={"source": a.get("source") if a.get("source") in ("founder", "ai") else "founder"}
            )
            room -= int(created)


class Migration(migrations.Migration):
    dependencies = [
        ("projects", "0005_assumption_dismissed"),
        ("reports", "0003_report_project_created_idx"),
    ]

    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
