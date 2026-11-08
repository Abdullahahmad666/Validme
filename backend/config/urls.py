from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from projects.views import ProjectViewSet
from research.views import ResearchJobViewSet, SourcesView

router = DefaultRouter(trailing_slash=False)
router.register("projects", ProjectViewSet, basename="project")
router.register("research/jobs", ResearchJobViewSet, basename="research-job")


def health(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health", health),
    path("api/research/sources", SourcesView.as_view()),
    path("api/", include(router.urls)),
]
