import hashlib
import secrets

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    email = models.EmailField(unique=True)
    credits = models.PositiveIntegerField(default=0)


class ApiKey(models.Model):
    """API key for the MCP server. Only the SHA-256 hash is stored."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="api_keys")
    name = models.CharField(max_length=80)
    prefix = models.CharField(max_length=12, db_index=True)
    key_hash = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    revoked = models.BooleanField(default=False)

    @staticmethod
    def hash(raw: str) -> str:
        return hashlib.sha256(raw.encode()).hexdigest()

    @classmethod
    def issue(cls, user: User, name: str) -> tuple["ApiKey", str]:
        raw = "vm_" + secrets.token_urlsafe(32)
        key = cls.objects.create(user=user, name=name, prefix=raw[:12], key_hash=cls.hash(raw))
        return key, raw
