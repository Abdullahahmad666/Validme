from rest_framework.views import exception_handler


def error_envelope_handler(exc, context):
    """Wrap DRF errors as {"error": {"code", "message", "details"}}."""
    response = exception_handler(exc, context)
    if response is None:
        return None
    code = getattr(exc, "default_code", "error")
    data = response.data
    message = data.get("detail") if isinstance(data, dict) and "detail" in data else "Invalid request."
    response.data = {"error": {"code": str(code), "message": str(message), "details": data}}
    return response
