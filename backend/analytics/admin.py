from django.contrib import admin

from analytics.models import AnalyticsEvent


@admin.register(AnalyticsEvent)
class AnalyticsEventAdmin(admin.ModelAdmin):
    list_display = ("name", "source", "user", "created_at")
    list_filter = ("name", "source")
    date_hierarchy = "created_at"
    readonly_fields = ("name", "source", "user", "path", "props", "created_at")
