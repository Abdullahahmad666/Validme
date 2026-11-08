from rest_framework import serializers

from research.models import JobStage, ResearchJob


class JobStageSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobStage
        fields = ["name", "status", "detail", "started_at", "finished_at"]


class ResearchJobSerializer(serializers.ModelSerializer):
    stages = JobStageSerializer(many=True, read_only=True)
    project_id = serializers.UUIDField(source="project.id", read_only=True)

    class Meta:
        model = ResearchJob
        fields = [
            "id",
            "project_id",
            "status",
            "depth",
            "coverage",
            "credits_charged",
            "stages",
            "created_at",
            "started_at",
            "completed_at",
        ]


class ResearchJobCreateSerializer(serializers.Serializer):
    project = serializers.UUIDField()
    depth = serializers.ChoiceField(choices=ResearchJob.Depth.choices, default="standard")
    sources = serializers.ListField(child=serializers.CharField(), required=False)
