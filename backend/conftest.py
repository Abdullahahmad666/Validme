import pytest
from rest_framework.test import APIClient

from accounts.models import User


@pytest.fixture
def make_user(db):
    def _make(email: str, credits: int = 5) -> User:
        return User.objects.create_user(email.split("@")[0], email, "pw-12345678", credits=credits)

    return _make


@pytest.fixture
def user(make_user):
    return make_user("ana@example.com")


@pytest.fixture
def other(make_user):
    return make_user("bob@example.com")


@pytest.fixture
def api(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


@pytest.fixture
def other_api(other):
    c = APIClient()
    c.force_authenticate(other)
    return c
