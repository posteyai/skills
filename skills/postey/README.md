# Postey for Claude

Postey lets Claude draft, schedule and publish social media posts on X, LinkedIn, Instagram, TikTok, YouTube, Threads, Bluesky, Facebook and Pinterest from your Postey account (https://postey.ai).

Write one idea and Claude reshapes it for each network against that network's real limits. Everything stays a draft until you say publish. Scheduling counts as publishing, so Claude asks for an explicit yes before it schedules anything. Every task ends with a share link you can send to a reviewer.

## What's in the plugin

- **Postey MCP server** (`.mcp.json`): the hosted, remote server at `https://mcp.postey.ai/mcp`. You sign in to your Postey account with OAuth in your browser the first time you use it. Nothing is installed locally.
- **`postey` skill** (`SKILL.md` and `references/`): accounts, platform limits, the post lifecycle, and the writing guidance (hooks, captions, post structures) Claude uses to shape each draft.
- **Optional CLI** (`scripts/postey.js`, plain readable Node.js): only used in Claude Code when you ask for something the hosted server can't reach, such as uploading a video or image from your local disk.

Optional packs that build on this plugin: `postey-video`, `postey-ideas`, `postey-ops`, `postey-analytics`, `postey-voice`, `postey-teams` and `postey-engagement`.

## Requirements

- A Postey account (https://app.postey.ai) with at least one social account connected.
- Claude with connectors enabled, or Claude Code.

## Example prompts

- "Draft a post about our launch and show me a version for each of my platforms."
- "What's scheduled this week?"
- "Upload ~/Videos/demo.mp4 as an Instagram Reel draft with a caption."

## What it runs, sends and fetches

- The MCP server and the CLI talk only to Postey's own services: `mcp.postey.ai`, `srvr.postey.ai` (API and sign-in) and `app.postey.ai`.
- The CLI signs in with OAuth: it opens your browser and listens on a localhost callback port. If you set `POSTEY_API_KEY` or `POSTEY_AUTH_TOKEN` in your environment, the CLI sends that Postey credential to `srvr.postey.ai` only.
- For video workflows the CLI can run `ffmpeg`/`ffprobe` locally, if they're installed, to check media and make a cover image.
- No data goes to any other service. The plugin doesn't read your chat history, or any file you haven't asked it to use.

## Privacy and support

- Privacy policy: https://postey.ai/policies/privacy
- Terms: https://postey.ai/policies/terms
- Support: support@postey.ai · https://postey.ai/policies/support

## License

MIT
