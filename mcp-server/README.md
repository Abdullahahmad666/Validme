# ValidMe MCP server

Lets Claude (Claude Code, Claude Desktop) validate ideas with ValidMe.

## Install
```bash
cd mcp-server
pip install -e ".[dev]"
```

## Use in this repo (Claude Code)
The repo's `.mcp.json` already registers it as `validme`. By default `VALIDME_MOCK=1`, so it returns clearly-labelled sample data until the backend is running.

Against a real backend:
```bash
export VALIDME_API_URL=http://localhost:8000/api
export VALIDME_API_KEY=<key from Settings → API keys>
export VALIDME_MOCK=0
```

## Use anywhere (user scope)
```bash
claude mcp add validme --scope user -e VALIDME_API_KEY=<key> -- python -m validme_mcp
```

## Tools
`validate_idea`, `get_research_status`, `get_report`, `search_evidence`, `list_competitors`, `suggest_channels`.

## Test
```bash
pytest
```
