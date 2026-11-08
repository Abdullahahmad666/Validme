from django.db import transaction
from rest_framework import serializers

from projects.models import IdeaDefinition, MarketProfile, Project

OBJECTIVES = [
    "validate_demand",
    "pain_points",
    "competitor_analysis",
    "find_market_gaps",
    "target_audiences",
    "customer_acquisition",
    "pricing",
]


class ProjectSerializer(serializers.ModelSerializer):
    name = serializers.CharField(min_length=3, max_length=80)
    description = serializers.CharField(source="idea.original_description", min_length=30, max_length=2000)
    objectives = serializers.ListField(child=serializers.ChoiceField(choices=OBJECTIVES), source="idea.objectives", required=False)
    existing_product_url = serializers.URLField(source="idea.existing_product_url", required=False, allow_blank=True)
    additional_context = serializers.CharField(source="idea.additional_context", required=False, allow_blank=True, max_length=1000)
    audiences = serializers.ListField(child=serializers.CharField(max_length=120), source="market.audiences", required=False)
    geographies = serializers.ListField(child=serializers.CharField(max_length=80), source="market.geographies", required=False)
    customer_type = serializers.ChoiceField(choices=MarketProfile.CustomerType.choices, source="market.customer_type", required=False)

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "status",
            "description",
            "objectives",
            "existing_product_url",
            "additional_context",
            "audiences",
            "geographies",
            "customer_type",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "status", "created_at", "updated_at"]

    @transaction.atomic
    def create(self, validated):
        idea = validated.pop("idea", {})
        market = validated.pop("market", {})
        project = Project.objects.create(owner=self.context["request"].user, **validated)
        IdeaDefinition.objects.create(project=project, **idea)
        MarketProfile.objects.create(project=project, **market)
        return project

    @transaction.atomic
    def update(self, project, validated):
        idea = validated.pop("idea", {})
        market = validated.pop("market", {})
        for k, v in validated.items():
            setattr(project, k, v)
        project.save()
        if idea:
            IdeaDefinition.objects.update_or_create(project=project, defaults=idea)
        if market:
            MarketProfile.objects.update_or_create(project=project, defaults=market)
        return project
