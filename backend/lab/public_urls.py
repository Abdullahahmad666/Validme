"""URL map for LAB_HOST only (see lab.middleware). Nothing else is reachable on the pages origin."""

from django.urls import path

from lab import public

urlpatterns = [
    path("", public.root),
    path("robots.txt", public.robots),
    path("p/<slug:slug>", public.page_view),
    path("p/<slug:slug>/join", public.join),
]

handler404 = "lab.public.root"
