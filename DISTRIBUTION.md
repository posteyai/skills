# Agent distribution

Where Postey is registered so that AI agents can find, install and invoke it.

`REGISTRY.md` indexes the skills *inside* this repo. This file tracks the **external**
surfaces. They are different things — don't merge them.

## The four layers

Agent visibility is not one channel. It is four, and they fail independently.

| Layer | What it does | Status |
|---|---|---|
| **Retrieval** | Crawlers and doc-fetchers read us mid-task | ✅ live |
| **Tool** | The agent *uses* Postey rather than describing it | ✅ live |
| **Plugin** | One install wires up skill + MCP together | ✅ fixed, unreleased |
| **Registry** | The agent finds us without being told we exist | ❌ **the gap** |

Layers 1–3 are done. Layer 4 is the whole opportunity.

## Layer 1 — retrieval (done, no action)

- `https://postey.ai/llms.txt` — 200, generated in `PosteyMain/src/routes/llms.txt/+server.ts`.
  Pricing is derived from `softwareApplicationSchema()` so it can't drift.
- `https://postey.ai/llms-full.txt` — 200.
- `robots.txt` explicitly allows GPTBot, ChatGPT-User, ClaudeBot, anthropic-ai, PerplexityBot.
- `sitemap.xml` declared.

## Layer 2 — tool (done, no action)

- MCP endpoint: `https://mcp.postey.ai/mcp` (streamable-http).
- 31 tools — 28 via `@mcp.tool` in `postey-backend/app/core/mcp/tools/`, plus
  `file_manager` / `list_files` / `read_file` registered by `mcp.add_provider()` in
  `uploads.py`. Grepping only for `@mcp.tool` undercounts by 3.
- 20 `postey://` resources.
- Auth: OAuth with dynamic client registration (`/register`, `/authorize`, `/token`,
  `.well-known/oauth-authorization-server` → 200). `X-API-Key: mk_...` for headless.

## Layer 3 — plugin (fixed here, needs release)

The plugin previously shipped `SKILL.md` and a CLI but **no `.mcp.json`**, so installing it
gave the agent instructions without the tools. `skills/postey/.mcp.json` now declares the
remote server, so install and connect are one step. OAuth means no secret is embedded.

`claude plugin validate ./skills/postey` → passes.

## Layer 4 — registries (the work)

> **You do not submit to thousands of directories.** The long tail scrapes the official
> registry and GitHub. Submit to the ~6 sources below and the tail follows on its own.
> Treating this as a thousand-item task is how it never gets started.

### Tier 1 — do these

| # | Target | Mechanism | Status |
|---|---|---|---|
| 1 | **Official MCP Registry** | `mcp-publisher` + `server.json`, DNS auth | ready — not submitted |
| 2 | **ClawHub** | `clawhub skill publish` (staged copy, see RUNBOOK) | ready — not submitted (2026-10-25: `postey` slug free; Postiz listed) |
| 3 | **Anthropic plugin directory** | developer portal `claude.ai/directory/manage` | ready — not submitted (2026-10-25: Postiz is in both `claude-plugins-official` and `-community`) |
| 4 | **awesome-mcp-servers / mcpservers.org** | pull request | not submitted |
| 5 | **Context7** | `context7.com/add-library` | not submitted |
| 6 | **Glama** | auto-indexes public GitHub | passive |

**1. Official MCP Registry.** `server.json` is at this repo root and validates against the
published `2025-12-11` schema. Namespace `ai.postey/postey` — reverse DNS of `postey.ai`,
which requires the DNS challenge rather than GitHub auth.

```
mcp-publisher login dns --domain postey.ai
mcp-publisher publish
```

Verified 2026-08-27: searching the live registry for `postey` returns 0 results, and for
`postiz` also 0. **Neither we nor our closest competitor is listed.** First-mover here is
uncontested, and downstream directories sync from this registry — so this one submission
does the most work.

**2. ClawHub.** Embedding-based search, so `description` and `when_to_use` in `SKILL.md`
matter more than keywords. Requires a GitHub account old enough to clear the upload gate.
`clawhub skill publish ./skills/postey` is refused because the folder carries
`.claude-plugin/plugin.json`; publish a staged copy without it (exact commands in RUNBOOK
Step 2). Never `clawhub sync --all`: it ignores `.clawhubignore` and would take the
`template` slug.

Publishes are held for automated scanning (VirusTotal + code-pattern analysis) before going live.

**3. Anthropic plugin directory.** Submit from the developer portal at
`claude.ai/directory/manage` (Submit new → Plugin bundle, plugin path `skills/postey`). Needs
a paid claude.ai plan and a connected GitHub account with push access. One submission per
plugin folder; each new commit on the tracked branch is re-scanned, so raise `version` per
release. Listing reaches claude.ai, Cowork and Claude Code (as `postey@synced`). Submit
`mcp.postey.ai/mcp` as an MCP connector alongside it. `claude-plugins-official` takes no
portal submissions.

**4. awesome-mcp-servers.** A PR against the list that backs `mcpservers.org`. Postiz is
listed there; we are not.

**5. Context7.** Indexes our markdown so agents retrieve real Postey docs mid-task instead
of guessing an API. No approval, no star minimum. Add their GitHub Action to re-index on push.

**6. Glama.** Indexes public GitHub automatically — this repo being public is the whole
requirement. Nothing to submit.

### Tier 2 — volume directories

Submit after Tier 1 lands. Each is a form; none is load-bearing.

`mcp.so` · `smithery.ai` · `LobeHub` · `MCPMarket` · `PulseMCP` · `Composio` · `Protodex`

Postiz appears on `mcpservers.org` and Composio. That is the visibility gap to close.

### Not a registry

**Vercel** hosts `postey.ai` and `app.postey.ai`. It is a deployment platform, not a
discovery surface — nothing to register there. The hosting-side work that *does* affect
agent visibility is the retrieval layer above, and it is already done.

### Deliberately skipped

`.well-known/mcp.json` — still a proposal, and the two live SEPs disagree on the path
(SEP-1649 says `/.well-known/mcp/server-card.json`, SEP-1960 says `/.well-known/mcp`).
Neither Postiz nor Postly ships one. Revisit when a path is ratified; building the wrong
one now is worse than waiting.

`mcp.postey.ai/.well-known/oauth-protected-resource` returns 404 (the path-suffixed
`/.well-known/oauth-protected-resource/mcp` returns 200). The bare path *is* ratified
(RFC 9728) and some clients probe it to discover the auth server. OAuth works today without
it, so it's a robustness fix rather than a blocker — worth doing in the backend, low priority.

## Keeping this honest

Every row above says *not submitted* because nothing has been submitted yet. Update the
status the day a submission lands, with the date. A tracker that claims coverage it doesn't
have is worse than no tracker.
