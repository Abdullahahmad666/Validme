"""URL map for LAB_HOST only (see lab.middleware). Nothing else is reachable on the pages origin."""

from django.urls import path

from lab import data_requests, public, public_surveys

urlpatterns = [
    path("", public.root),
    path("robots.txt", public.robots),
    path("p/<slug:slug>", public.page_view),
    path("p/<slug:slug>/join", public.join),
    path("p/<slug:slug>/choose", public.choose),
    path("s/<slug:slug>", public_surveys.survey_view),
    path("s/<slug:slug>/answer", public_surveys.answer),
    path("data-request", data_requests.request_form),
    path("data-request/confirm", data_requests.confirm),
]

handler404 = "lab.public.root"
