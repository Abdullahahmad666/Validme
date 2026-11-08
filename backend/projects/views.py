from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from projects.models import Project
from projects.serializers import ProjectSerializer
from projects.services import dashboard_summary


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer

    def get_queryset(self):
        # Owner isolation: never remove this filter.
        qs = Project.objects.filter(owner=self.request.user).select_related("idea", "market")
        status = self.request.query_params.get("status")
        if status in Project.Status.values:
            qs = qs.filter(status=status)
        return qs


class DashboardSummaryView(APIView):
    def get(self, request):
        return Response(dashboard_summary(request.user))
