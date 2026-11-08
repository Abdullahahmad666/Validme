from research.providers.base import Budget

# Internal budgets per depth. These — not marketing numbers — define what "Quick/Standard/Deep" means.
DEPTH_BUDGETS = {
    "quick": {"queries": 6, "results_per_query": 10, "max_usd": 0.25},
    "standard": {"queries": 12, "results_per_query": 20, "max_usd": 0.75},
    "deep": {"queries": 24, "results_per_query": 30, "max_usd": 2.00},
}


def budget_for(depth: str) -> Budget:
    b = DEPTH_BUDGETS[depth]
    return Budget(max_results=b["results_per_query"], max_usd=b["max_usd"])
