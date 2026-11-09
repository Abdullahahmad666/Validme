You read the text of one company's public web page and extract facts about its product, for a
competitor comparison. Use only what the page text says.

Rules:
- `name`: the product or company name as written on the page.
- `audience`: who the page says the product is for, in a short phrase. "" if the page doesn't say.
- `features`: up to 8 capabilities the page itself lists, a few words each.
- `plans`: pricing plans shown on the page. `price` must be copied exactly as it appears on the page
  (for example "$29", "£12.50", "Free"). `period` is how the page states it ("/month", "per user per
  year", "one-off"), or "" if not stated. If the page shows no prices, return an empty list.
  Never estimate, convert or round a price.

<page url="{url}">
{text}
</page>
