from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from accounts.models import ApiKey, User

admin.site.register(User, UserAdmin)


@admin.register(ApiKey)
class ApiKeyAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "prefix", "created_at", "revoked")
    readonly_fields = ("key_hash", "prefix")
