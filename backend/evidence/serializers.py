from rest_framework import serializers

from evidence.models import Evidence, EvidenceCluster


class EvidenceSerializer(serializers.ModelSerializer):
    """Source fields (verbatim) and AI classification fields are separate in the payload too."""

    duplicates = serializers.IntegerField(source="duplicates_count", read_only=True, default=0)
    classification = serializers.SerializerMethodField()

    class Meta:
        model = Evidence
        fields = [
            "id",
            "project",
            "provider",
            "source_url",
            "title",
            "excerpt",
            "published_at",
            "retrieved_at",
            "license",
            "author_name",
            "author_url",
            "duplicates",
            "classification",
            "saved_by_user",
        ]
        read_only_fields = [f for f in fields if f != "saved_by_user"]

    def get_classification(self, obj: Evidence) -> dict:
        return {
            "category": obj.category,
            "relevance": obj.relevance,
            "ai_classified": bool(obj.classifier_version),  # prompt/model versions stay server-side
        }


class EvidenceClusterSerializer(serializers.ModelSerializer):
    evidence_ids = serializers.SerializerMethodField()
    distinct_sources = serializers.SerializerMethodField()
    providers = serializers.SerializerMethodField()

    class Meta:
        model = EvidenceCluster
        fields = [
            "id",
            "name",
            "category",
            "severity",
            "confidence",
            "ai_summary",
            "evidence_ids",
            "distinct_sources",
            "providers",
            "created_at",
        ]

    def _members(self, obj):
        return [e for e in obj.evidence.all() if e.duplicate_of_id is None]

    def get_evidence_ids(self, obj) -> list[int]:
        return [e.id for e in self._members(obj)]

    def get_distinct_sources(self, obj) -> int:
        return len({e.source_url for e in self._members(obj)})

    def get_providers(self, obj) -> list[str]:
        return sorted({e.provider for e in self._members(obj)})
