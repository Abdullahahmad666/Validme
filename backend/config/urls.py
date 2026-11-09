from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from accounts.views import ApiKeyViewSet, MeView
from evidence.views import EvidenceClusterViewSet, EvidenceViewSet
from projects.views import DashboardSummaryView, ProjectQueryViewSet, ProjectViewSet
from reports.views import ReportView
from research.views import EstimateView, ResearchJobViewSet, SourcesView

router = DefaultRouter(trailing_slash=False)
router.register("projects", ProjectViewSet, basename="project")
router.register("research/jobs", ResearchJobViewSet, basename="research-job")
router.register("api-keys", ApiKeyViewSet, basename="api-key")
router.register("evidence/clusters", EvidenceClusterViewSet, basename="evidence-cluster")
router.register("evidence", EvidenceViewSet, basename="evidence")
router.register(r"projects/(?P<project_pk>[^/.]+)/queries", ProjectQueryViewSet, basename="project-query")


def health(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    # allauth: headless JSON API for the frontend + provider OAuth callbacks (Google).
    path("_allauth/", include("allauth.headless.urls")),
    path("accounts/", include("allauth.urls")),
    path("api/health", health),
    path("api/me", MeView.as_view()),
    path("api/dashboard/summary", DashboardSummaryView.as_view()),
    path("api/research/sources", SourcesView.as_view()),
    path("api/research/estimate", EstimateView.as_view()),
    path("api/reports/<str:project_id>", ReportView.as_view()),
    path("api/", include(router.urls)),
]
