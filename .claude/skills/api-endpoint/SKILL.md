---
name: api-endpoint
description: Add or change a ValidMe Django REST API endpoint, model, or serializer. Use for any backend/ API work.
---

# Add an API endpoint

1. Check `docs/architecture.md` API table; add/adjust the row first.
2. Model changes: edit `models.py` in the owning app, `python manage.py makemigrations <app>`, never edit old migrations.
3. Serializer validates exactly the rules in `docs/design/screens.md` (same limits as the frontend Zod schema).
4. ViewSet: `permission_classes = [IsAuthenticated]`; `get_queryset()` **must** filter by `owner=self.request.user` (or via project owner). Paginate lists.
5. Business logic in `services.py`; views stay thin. Long work → Celery task in `tasks.py`.
6. Mutations that spend credits: `transaction.atomic()`, `select_for_update()` on the balance, require `Idempotency-Key` header.
7. Errors: `{ "error": { "code": "...", "message": "..." } }`.
8. Tests (pytest + DRF APIClient): happy path, validation error, **another user gets 404**, idempotent retry.
9. Update the frontend type in `frontend/src/types/` and the MCP client if the endpoint is used there.
