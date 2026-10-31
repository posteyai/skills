# Registration runbook

Execution order for getting Postey listed where agents look. Work top to bottom — step 0
gates everything else, and step 1 does more work than steps 2–7 combined.

Each step has a **verify** command. Don't mark a row done in `DISTRIBUTION.md` until its
verify passes.

Time: about 90 minutes total, most of it waiting on DNS propagation and review queues.

---

## Step 0 — publish the assets (gates everything)

Every submission below cites a public commit. Until this merges, they'd reference code that
doesn't exist publicly.

```bash
cd ~/code/postey/skills
git push -u origin agent-visibility-mcp-wiring
gh pr create --title "Wire MCP server into plugin; add registry manifests" --body "Adds .mcp.json so installing the plugin also connects the MCP server, server.json for the official MCP registry, and DISTRIBUTION.md/RUNBOOK.md for external listings."
```

> Confirm the account you are pushing from has write access to `posteyai/skills`. A machine
> signed in as a different org's account will fail here, or push under the wrong identity.

**Verify:** `curl -s -o /dev/null -w "%{http_code}\n" https://raw.githubusercontent.com/posteyai/skills/main/server.json` → `200`

---

## Step 1 — Official MCP Registry

Do this one first. Downstream directories sync from it, so this single submission propagates
further than anything else on the list.

As of 2026-08-27 the live registry returns **0 results for `postey` and 0 for `postiz`**.
Uncontested — and namespaces are first-come.

```bash
# 1. install
go install github.com/modelcontextprotocol/registry/cmd/mcp-publisher@latest
# or: brew install mcp-publisher

# 2. authenticate with the postey.ai DNS key
mcp-publisher login dns --domain postey.ai --private-key "$(openssl pkey -in ~/.config/mcp-publisher/postey-ai-ed25519.pem -noout -text | grep -A3 'priv:' | tail -n +2 | tr -d ' :\n')"
```

Registry auth uses an Ed25519 DNS key on `postey.ai`. The public half is already published as
a TXT record on `postey.ai`; the private key lives at
`~/.config/mcp-publisher/postey-ai-ed25519.pem` on the publisher's machine. **Never commit the
key** or paste it into this repo. If the key is lost, generate a new pair and replace the
`v=MCPv1; k=ed25519; p=...` TXT value on `postey.ai`, keeping the other apex TXT values intact.

```bash
# 3. confirm the TXT record is visible if login fails
dig +short TXT postey.ai

# 4. publish (run from repo root — reads ./server.json)
cd ~/code/postey/skills
mcp-publisher publish
```

`server.json` is already written and validates against the published `2025-12-11` schema.
Its `version` must equal the live server's `serverInfo.version`
(`curl -s https://mcp.postey.ai/.well-known/mcp/server-card.json`). Bump both together; the registry rejects republishing
an existing version, so a mismatch cannot be fixed later under the same number.
Namespace: `ai.postey/postey` — reverse DNS of `postey.ai`, which is why this needs the DNS
challenge rather than GitHub auth.

**Verify:** `curl -s "https://registry.modelcontextprotocol.io/v0/servers/ai.postey%2Fpostey/versions/latest"` shows the
`version` from `server.json` and the remote `https://mcp.postey.ai/mcp`.

---

## Step 2 — ClawHub

Each pack folder (`skills/<name>/`) is a plain skill folder: no `.claude-plugin/`, no
`.mcp.json` (its Claude Code plugin is defined by its entry in `.claude-plugin/marketplace.json`),
so packs publish straight from the repo. ClawHub refuses a folder holding a plugin manifest
("This looks like a plugin").

The hub is different: `skills/postey/` keeps `.claude-plugin/plugin.json` and `.mcp.json`
because the Claude directory (Step 3) blocks the plugin without them. Publish the hub from a
staged copy with those two files removed:

```bash
stage="$(mktemp -d)/postey"
cp -R skills/postey "$stage"
rm -rf "$stage/.claude-plugin" "$stage/.mcp.json"
# then run the publish below with "$stage" in place of "skills/$s"
```

`tests/plugin-layout.test.mjs` enforces both rules.

```bash
npm i -g clawhub
clawhub login          # opens a browser for GitHub OAuth
clawhub whoami

s=postey               # or a pack: postey-video, postey-ideas, ...
v=$(node -p "require('./skills/$s/pack.json').version")
clawhub skill publish "skills/$s" --slug "$s" --version "$v" \
  --owner <postey-org-handle> \
  --source-repo posteyai/skills --source-commit "$(git rev-parse HEAD)" \
  --source-ref main --source-path "skills/$s" \
  --dry-run              # drop --dry-run once the preview says "Would publish $s@<v>"
```

Pass `--name "Postey"` for the hub. Always pass `--version`: without it ClawHub starts
every skill at 1.0.0.

Don't use `clawhub sync --all` from the repo root. Its folder scan ignores `.clawhubignore`,
so it would also publish `templates/skill` under the permanent slug `template`, and it
versions every skill from 1.0.0 instead of reading the real version. The same scan would
also find the test fixtures under `tests/fixtures/` (`alpha`, `beta`, `absent`, `declared`,
...), which are synthetic `SKILL.md` files for the repo's own checks.

**Publish from an org account, not personal** — a personal-account listing reads as a
third-party clone rather than the official Postey skill.

Publishes are held behind a prepublication worker (VirusTotal + code-pattern scanning)
before going live, so expect a delay. Search is embedding-based, so the `description` and
`when_to_use` fields in `SKILL.md` are what get you found — not tags.

`clawhub.ai` also has a web "Import from GitHub". It lists every `SKILL.md` in the repo as
a candidate, including `templates/skill` and the `tests/fixtures/` ones, because the
importer reads no ignore file (`.clawhubignore` only applies to CLI publishes). Pick
`skills/<name>` by hand and nothing else. The CLI path above is the one that is verified.

**Verify:** `clawhub search postey` returns the listing, and `clawhub.ai/skills/postey` loads.

---

## Step 3 — Claude Code community marketplace

The earlier Console forms are gone. Submit from the developer portal at
**`claude.ai/directory/manage`** → **Submit new** → **Plugin bundle**
(guide: `claude.com/docs/plugins/submit`). It needs a paid claude.ai plan (Pro/Max submit
from their own account; on Team/Enterprise an Owner submits) and a GitHub account connected
on claude.ai that can push to `posteyai/skills`.

Field values:

| Field | Value |
|---|---|
| Repository | `posteyai/skills` |
| Plugin path | `skills/postey` (one submission per plugin folder) |
| Branch or tag | leave empty (follows `main`) |
| Updates | GitHub push webhook (needs repo admin) |

Then answer the Data handling and Compliance steps. The portal's **Validate** runs more
checks than the CLI: a plugin-folder README of 40+ words and a license are blocking. `postey`
has both; the packs have no README, so add one before submitting any of them.

Pre-flight — already passing, re-run after any edit:

```bash
claude plugin validate --strict .
```

`skills/postey` must carry `.claude-plugin/plugin.json`: the portal's validation blocks a
plugin folder without one ("No plugin.json" — this blocked 4213b0b and 65b0781 in Oct 2026,
after the hub's manifest was removed for ClawHub). Keep it, and keep `.mcp.json` beside it so
the plugin bundles the MCP server. ClawHub gets a staged copy instead (Step 2).

Each scanned commit is checked again, so later releases need no new submission. Raise
`version` with every release (`node scripts/set-version.mjs`), or the listing won't move. Also submit
`https://mcp.postey.ai/mcp` separately as an **MCP connector**, which the portal expects
for a plugin that references a remote server you run.

**Verify:** the listing appears at `claude.ai/directory`. Anthropic's `claude-plugins-official`
marketplace takes no portal submissions; that one goes through a partner contact.

---

## Step 4 — Context7

Go to **`context7.com/add-library`**, GitHub tab, paste `https://github.com/posteyai/skills`.

No approval, no star minimum, no ownership check. It indexes the markdown — `SKILL.md`,
`command-reference.md`, `routing-guide.md`, `video-workflow.md`, `prompts.md` — so agents
retrieve real Postey usage mid-task instead of guessing at an API.

Add their GitHub Action afterwards so it re-indexes on every push to `main`.

**Verify:** the library resolves at `context7.com/posteyai/skills`.

---

## Step 5 — awesome-mcp-servers (backs mcpservers.org)

Postiz is listed here. Postey is not.

```bash
gh repo fork punkpeye/awesome-mcp-servers --clone
```

Add one row under the social-media section:

```markdown
- [Postey](https://github.com/posteyai/skills) 🏠 ☁️ - Draft, schedule and publish social posts to 9 networks; manage team drafts and comments.
```

Match the surrounding rows' emoji legend exactly — mismatched legends are the usual reason
these PRs sit unmerged. Then open the PR.

**Verify:** PR merged, and the entry appears on `mcpservers.org`.

---

## Step 6 — Glama (passive)

Nothing to submit. Glama auto-indexes public GitHub; `posteyai/skills` being public after
step 0 is the whole requirement.

**Verify:** search `glama.ai/mcp` for Postey after ~a week.

---

## Step 7 — Tier 2, batch in one sitting

Only after steps 0–5 land. Each is a form; none is load-bearing individually, but together
they're most of the long-tail directory traffic.

`mcp.so` · `smithery.ai` · `LobeHub` · `MCPMarket` · `PulseMCP` · `Composio` · `Protodex`

Reuse the same copy everywhere:

- **Name:** Postey
- **Description:** Draft, schedule and publish social posts to 9 networks; manage team drafts and comments.
- **MCP URL:** `https://mcp.postey.ai/mcp` (streamable-http)
- **Auth:** OAuth (dynamic client registration); `X-API-Key: mk_...` for headless
- **Homepage:** `https://postey.ai` · **Repo:** `https://github.com/posteyai/skills`

Postiz is on `mcpservers.org` and Composio. Those two close the visible gap.

---

## After each step

Update the status column in [`DISTRIBUTION.md`](DISTRIBUTION.md) with the date it landed.
A tracker that claims coverage it doesn't have is worse than no tracker.

## Not on this list

**Vercel** hosts `postey.ai` — it's a deployment platform, not a discovery surface. The
hosting-side work that does affect agent visibility (`llms.txt`, `llms-full.txt`, AI-crawler
rules in `robots.txt`, sitemap) is already live and needs nothing.
