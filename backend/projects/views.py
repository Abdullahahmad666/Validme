from rest_framework import viewsets

from projects.models import Project
from projects.serializers import ProjectSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer

    def get_queryset(self):
        # Owner isolation: never remove this filter.
        return Project.objects.filter(owner=self.request.user).select_related("idea", "market")
