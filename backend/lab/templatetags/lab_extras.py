from django import template

register = template.Library()


@register.filter
def first_waitlist_index(blocks) -> int:
    """Index of the first waitlist block: it gets id="join", the target of the hero button."""
    for i, b in enumerate(blocks or []):
        if isinstance(b, dict) and b.get("type") == "waitlist":
            return i
    return -1
