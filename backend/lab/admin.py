from django.contrib import admin

from lab.models import LabPage


@admin.action(description="Unpublish (take down) selected pages")
def take_down(modeladmin, request, queryset):
    queryset.update(status=LabPage.Status.UNPUBLISHED)


@admin.register(LabPage)
class LabPageAdmin(admin.ModelAdmin):
    """Abuse handling: find a reported page by its address and unpublish it. Sign-ups aren't shown here."""

    list_display = ("slug", "title", "status", "published_at", "project")
    list_filter = ("status",)
    search_fields = ("slug", "title")
    readonly_fields = ("project", "blocks", "published_at", "created_at")
    actions = [take_down]
