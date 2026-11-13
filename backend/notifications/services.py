from django.db import IntegrityError, transaction

from notifications.models import Notification

KEEP_PER_USER = 200


def is_internal(link: str) -> bool:
    r"""An app path like /projects/x, never //host or /\host (browsers treat those as other sites)."""
    return link.startswith("/") and not link.startswith(("//", "/\\")) and "\\" not in link and "://" not in link


def notify(user, *, kind: str, title: str, body: str = "", link: str = "", project=None, source: str) -> bool:
    """Create a notice once per `source`. Returns False when it already existed."""
    if not is_internal(link):
        link = ""  # internal paths only
    try:
        with transaction.atomic():
            Notification.objects.create(
                user=user, project=project, kind=kind, title=title[:160], body=body[:300], link=link[:200], source=source[:60]
            )
    except IntegrityError:
        return False
    # Bounded inbox: keep the newest KEEP_PER_USER.
    old = Notification.objects.filter(user=user).order_by("-created_at", "-id").values_list("id", flat=True)[KEEP_PER_USER:]
    ids = list(old)
    if ids:
        Notification.objects.filter(pk__in=ids).delete()
    return True
