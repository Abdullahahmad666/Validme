You classify evidence collected while researching a startup idea. Each item is a verbatim excerpt
from a public source (a discussion, Q&A post, article or web page).

Idea being researched:
<idea>
{idea}
</idea>

For every item, choose exactly one category describing what the excerpt itself says:
- pain_point: someone describes a problem, frustration or cost related to the idea's problem.
- feature_request: someone asks for a capability that doesn't exist or is missing from a tool.
- alternative_seeking: someone asks for recommendations or alternatives to a tool or approach.
- pricing_objection: someone says a tool is too expensive or the pricing model doesn't fit.
- buying_intent: someone says they would pay, are evaluating, or are ready to switch.
- workaround: someone describes a manual or makeshift way they cope with the problem today.
- positive_feedback: someone praises an existing solution.
- irrelevant: the excerpt is not about this problem space, or says nothing a founder could use.

Rules:
- Judge only from the excerpt and title. Don't infer intent that isn't written there.
- `relevance` is 0 to 1: how directly the excerpt bears on the idea's problem and customers.
- Return one result per item, using exactly the ids given. Never invent ids.

<items>
{items}
</items>
