from django.contrib import admin

from monitoring.models import Change, Watch


@admin.register(Watch)
class WatchAdmin(admin.ModelAdmin):
    list_display = ("url", "project", "cadence", "active", "last_status", "next_run_at")
    list_filter = ("active", "last_status", "cadence")
    readonly_fields = ("etag", "last_modified", "last_hash", "last_checked_at", "consecutive_errors")


@admin.register(Change)
class ChangeAdmin(admin.ModelAdmin):
    list_display = ("watch", "kind", "significance", "detected_at")
    list_filter = ("kind", "significance")
