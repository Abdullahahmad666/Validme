"""JSON error pages for API paths; everything else keeps Django's default pages."""

from django.http import HttpResponseNotFound, HttpResponseServerError, JsonResponse


def _is_api(request) -> bool:
    return request.path.startswith("/api/")


def not_found(request, exception=None):
    if _is_api(request):
        return JsonResponse({"error": {"code": "not_found", "message": "Not found."}}, status=404)
    return HttpResponseNotFound("Not found.")


def server_error(request):
    # Never include exception details: they're in the server logs.
    if _is_api(request):
        return JsonResponse({"error": {"code": "server_error", "message": "Something went wrong on our side."}}, status=500)
    return HttpResponseServerError("Server error.")
