// Mirrors backend serializers. Keep in sync with backend/*/serializers.py.
export type Availability = "AVAILABLE" | "LIMITED" | "REQUIRES_CONNECTION" | "UNAVAILABLE";

export type ResearchSource = { key: string; label: string; contributes: string; availability: Availability };

export type ProjectStatus = "DRAFT" | "RESEARCHING" | "COMPLETED" | "ARCHIVED";

export type Project = {
  id: string;
  name: string;
  status: ProjectStatus;
  description: string;
  objectives: string[];
  audiences: string[];
  geographies: string[];
  customer_type?: "B2B" | "B2C" | "B2B2C";
  created_at: string;
  updated_at: string;
};

export type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };
