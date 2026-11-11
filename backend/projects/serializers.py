from django.core.validators import URLValidator
from django.db import transaction
from rest_framework import serializers

from projects.models import Assumption, IdeaDefinition, MarketProfile, Project, ResearchConfig
from research.models import ResearchJob, ResearchQuery

OBJECTIVES = [
    "validate_demand",
    "pain_points",
    "competitor_analysis",
    "find_market_gaps",
    "target_audiences",
    "customer_acquisition",
    "pricing",
]
BUSINESS_STAGES = ["idea", "mvp", "launched", "existing"]
COMPETITOR_ASPECTS = ["features", "pricing", "audience", "positioning", "complaints", "gaps"]
AI_SUGGESTED_FIELDS = ["industry", "customer_type", "audiences", "geographies"]
MAX_URLS = 10


def _url_list(source: str) -> serializers.ListField:
    # A fresh child per field: DRF binds child fields to their parent, so they can't be shared.
    child = serializers.URLField(max_length=500, validators=[URLValidator(schemes=["http", "https"])])
    return serializers.ListField(child=child, source=source, required=False, max_length=MAX_URLS)


class ProjectSerializer(serializers.ModelSerializer):
    """Wizard steps 1-3 in one resource, so autosave is a single PATCH.

    The founder's input (idea.*, market.*, config.*) is writable; the AI interpretation is read-only
    and stored separately (rule 2: evidence, AI conclusions and user assumptions stay apart).
    """

    # Step 1 — idea (the founder's own words)
    name = serializers.CharField(min_length=3, max_length=80)
    description = serializers.CharField(source="idea.original_description", min_length=30, max_length=2000)
    objectives = serializers.ListField(
        child=serializers.ChoiceField(choices=OBJECTIVES), source="idea.objectives", required=False, min_length=1
    )
    existing_product_url = serializers.URLField(
        source="idea.existing_product_url",
        required=False,
        allow_blank=True,
        validators=[URLValidator(schemes=["http", "https"])],
    )
    additional_context = serializers.CharField(source="idea.additional_context", required=False, allow_blank=True, max_length=1000)
    ai_interpretation = serializers.JSONField(source="idea.ai_interpretation", read_only=True)
    interpretation_confirmed = serializers.BooleanField(source="idea.user_confirmed", required=False)

    # Step 2 — market
    industry = serializers.CharField(source="market.industry", required=False, allow_blank=True, max_length=120)
    customer_type = serializers.ChoiceField(
        choices=MarketProfile.CustomerType.choices, source="market.customer_type", required=False, allow_blank=True
    )
    audiences = serializers.ListField(
        child=serializers.CharField(max_length=120), source="market.audiences", required=False, max_length=10
    )
    geographies = serializers.ListField(
        child=serializers.CharField(max_length=80), source="market.geographies", required=False, max_length=20
    )
    business_stage = serializers.ChoiceField(choices=BUSINESS_STAGES, source="market.business_stage", required=False, allow_blank=True)
    current_alternatives = serializers.CharField(
        source="market.current_alternatives", required=False, allow_blank=True, max_length=1000
    )
    price_hypothesis = serializers.CharField(source="market.price_hypothesis", required=False, allow_blank=True, max_length=120)
    ai_suggested_fields = serializers.ListField(
        child=serializers.ChoiceField(choices=AI_SUGGESTED_FIELDS), source="market.ai_suggested_fields", required=False
    )

    # Step 3 — research configuration
    sources = serializers.ListField(child=serializers.CharField(max_length=40), source="config.sources", required=False)
    depth = serializers.ChoiceField(choices=ResearchJob.Depth.choices, source="config.depth", required=False)
    competitor_discovery = serializers.BooleanField(source="config.competitor_discovery", required=False)
    competitor_urls = _url_list("config.competitor_urls")
    evidence_urls = _url_list("config.evidence_urls")
    competitor_aspects = serializers.ListField(
        child=serializers.ChoiceField(choices=COMPETITOR_ASPECTS), source="config.competitor_aspects", required=False
    )
    exclude_terms = serializers.ListField(
        child=serializers.CharField(max_length=40), source="config.exclude_terms", required=False, max_length=20
    )

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
            "ai_interpretation",
            "interpretation_confirmed",
            "industry",
            "customer_type",
            "audiences",
            "geographies",
            "business_stage",
            "current_alternatives",
            "price_hypothesis",
            "ai_suggested_fields",
            "sources",
            "depth",
            "competitor_discovery",
            "competitor_urls",
            "evidence_urls",
            "competitor_aspects",
            "exclude_terms",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "status", "created_at", "updated_at"]

    def to_representation(self, instance):
        # Projects created before ResearchConfig existed get defaults instead of a 500.
        if not hasattr(instance, "config"):
            instance.config = ResearchConfig(project=instance)
        return super().to_representation(instance)

    @transaction.atomic
    def create(self, validated):
        idea = validated.pop("idea", {})
        market = validated.pop("market", {})
        config = validated.pop("config", {})
        project = Project.objects.create(owner=self.context["request"].user, **validated)
        IdeaDefinition.objects.create(project=project, **idea)
        MarketProfile.objects.create(project=project, **market)
        ResearchConfig.objects.create(project=project, **config)
        return project

    @transaction.atomic
    def update(self, project, validated):
        if project.status != Project.Status.DRAFT and validated:
            # The snapshot on the job is what was researched; editing after launch would mislead.
            raise serializers.ValidationError({"status": "Only draft projects can be edited."})
        idea = validated.pop("idea", {})
        market = validated.pop("market", {})
        config = validated.pop("config", {})
        if market and "ai_suggested_fields" not in market and getattr(project, "market", None) is not None:
            changed = {f for f, v in market.items() if getattr(project.market, f) != v}
            if changed & set(project.market.ai_suggested_fields):
                market["ai_suggested_fields"] = [f for f in project.market.ai_suggested_fields if f not in changed]
        for k, v in validated.items():
            setattr(project, k, v)
        project.save()
        # Update the cached related instances (not update_or_create) so the response reflects the save.
        for model, attr, values in (
            (IdeaDefinition, "idea", idea),
            (MarketProfile, "market", market),
            (ResearchConfig, "config", config),
        ):
            if not values:
                continue
            related = getattr(project, attr, None)
            if related is None or related.pk is None:
                related = model(project=project)
            for k, v in values.items():
                setattr(related, k, v)
            related.save()
            setattr(project, attr, related)
        return project


class ResearchQuerySerializer(serializers.ModelSerializer):
    text = serializers.CharField(min_length=3, max_length=200)

    class Meta:
        model = ResearchQuery
        fields = ["id", "text", "intent", "enabled", "ai_generated", "user_modified"]
        read_only_fields = ["id", "ai_generated", "user_modified"]

    def update(self, instance, validated):
        if "text" in validated and validated["text"] != instance.text:
            validated["user_modified"] = True
        return super().update(instance, validated)


class AssumptionSerializer(serializers.ModelSerializer):
    evidence_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1, max_value=2**63 - 1), required=False, max_length=20, write_only=True
    )
    evidence = serializers.SerializerMethodField()

    class Meta:
        model = Assumption
        fields = ["id", "text", "source", "status", "note", "evidence_ids", "evidence", "created_at", "updated_at"]
        read_only_fields = ["id", "source", "created_at", "updated_at"]

    def get_evidence(self, obj) -> list[dict]:
        return [
            {"id": e.id, "title": e.title, "source_url": e.source_url, "provider": e.provider, "category": e.category}
            for e in obj.evidence.all()
        ]

    def validate_text(self, value: str) -> str:
        value = " ".join(value.split())
        if len(value) < 5:
            raise serializers.ValidationError("Describe the assumption in a few words.")
        if self.instance is not None and self.instance.source == Assumption.Source.AI and value != self.instance.text:
            raise serializers.ValidationError("AI-suggested assumptions can't be reworded; add your own instead.")
        return value


class _Scenario(serializers.Serializer):
    """Percentage changes applied to the base inputs (e.g. price -20, churn +50)."""

    price = serializers.FloatField(min_value=-90, max_value=500)
    cac = serializers.FloatField(min_value=-90, max_value=500)
    churn = serializers.FloatField(min_value=-90, max_value=500)
    growth = serializers.FloatField(min_value=-100, max_value=500)


class UnitEconomicsSerializer(serializers.Serializer):
    currency = serializers.RegexField(r"^[A-Z]{3}$", max_length=3)
    price = serializers.FloatField(min_value=0, max_value=1_000_000)  # per customer per month
    cac = serializers.FloatField(min_value=0, max_value=10_000_000)  # cost to acquire one customer
    churn_pct = serializers.FloatField(min_value=0.1, max_value=100)  # monthly
    margin_pct = serializers.FloatField(min_value=0, max_value=100)  # gross margin
    fixed_costs = serializers.FloatField(min_value=0, max_value=100_000_000)  # per month
    new_customers = serializers.FloatField(min_value=0, max_value=1_000_000)  # per month
    pessimistic = _Scenario()
    optimistic = _Scenario()
