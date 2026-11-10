---
name: postey
version: 1.0.0
description: >
  Draft, schedule and publish social posts with Postey across X, LinkedIn, Instagram,
  TikTok, YouTube, Threads, Bluesky, Facebook and Pinterest, through Postey's hosted MCP
  server. Writes one caption per network against its real limits, validates it, and
  publishes or schedules only after the user approves.
when_to_use: >
  Use when the user asks to draft a tweet or thread, post to LinkedIn, write captions for
  several networks, schedule or publish a post, check what is scheduled or published, attach
  an image or video, turn a video URL into posts, or manage social media drafts in Postey.
---

# Postey

Create, schedule and publish social media posts through [Postey](https://postey.ai). Everything
here runs on the Postey MCP server that this plugin connects (`https://mcp.postey.ai/mcp`). There
is no local script: every read and every write is an MCP tool or resource.

## Before Anything Else

- **The server must be connected.** If no Postey tools are in your session, say so and stop.
  Claude asks the user to sign in to Postey the first time a tool is used.
- **The server describes itself.** `postey://skill-manifest` lists every tool, resource, prompt
  and platform it serves. When a tool entry has `superseded_by`, use what it names instead. When a
  resource and a tool serve the same thing, read the resource.
- **Never hardcode a limit.** Character limits, media caps and allowed values live in
  `postey://platform-limits` and `postey://platforms/{platform}/rules`. Read them.

## Hard Rules

1. **Everything stays a draft until the user says publish.** Never call `publish_draft` or
   `schedule_post` without the user's explicit yes in the current turn, after they have seen the
   exact copy for every platform. "Post this now" approves the intent, not text they have not
   seen.
2. **Scheduling counts as publishing.** A scheduled post publishes itself, so it needs the same
   approval.
3. **Every platform gets its own caption.** Never paste one caption across networks. Write each
   one for that platform's format and limits.
4. **Platforms come from the account.** Read the connected platforms from `postey://accounts`.
   Never assume which networks an account has.
5. **Never invent an `account_id`.** Read the accounts and confirm with the user.

## Account Selection

1. Read `postey://accounts`. Call `get_accounts` only if your client cannot read MCP resources.
2. One account: use it. Several: show them and ask which one.
3. Each account carries one key per connected platform (`twitter` for X, otherwise the
   platform's own name). A missing key means that platform is not connected.
4. Pass that `account_id` to every write.

## Create and Publish

1. **Resolve the account** as above.
2. **Get writing guidance**: the `compose-post` prompt, or
   [caption-playbook.md](references/caption-playbook.md) and
   [hook-formulas.md](references/hook-formulas.md).
3. **Create the draft** with `create_post`. It returns a `post_id`. Several platforms go in
   **one** call through `additional_platforms`, each with its own hand-written content. One
   `post_id` per topic; never a separate draft per platform for the same content.
4. **Tag it** (see Tagging). Needs ADMIN on the account; skip it with WRITE or PUBLISH only.
5. **Validate** with `validate_post_content`, once per platform, passing `account_id` so the
   account's real limit applies.
6. **Review** with `review_post` when the user wants a virality check. It returns a `job_id` and
   takes 60 to 120 seconds; poll `get_review_status` while `status` is `running`.
7. **Show the user every platform's final copy**, then `publish_draft` or `schedule_post` (ISO
   8601 UTC) only after they say yes.

| User says | Do |
|---|---|
| "Draft a tweet about X" | `create_post` |
| "Post this to X and LinkedIn" | `create_post` with a separate caption for each |
| "What's scheduled?" | `get_posts` with `status=SCHEDULED` |
| "Show my recent posts" | `get_posts` with `status=PUBLISHED` |
| "Schedule this for tomorrow 9am" | Draft, show it, then `schedule_post` after a yes |

Threads: put `---` on its own line to split a post into a thread.

## Updating a Draft

1. `get_posts(account_id, social=<PLATFORM>, status=DRAFT)` to find it.
2. Read `postey://posts/{post_id}/content/{platform}`.
3. `update_post(post_id, ...)` with only the fields you change. Omitted media and settings are
   kept. Pass `media_urls=[]` to remove media.

YouTube and Pinterest need their title field on every call; the server names it if missing.

## Repurposing

`convert_post_content` rewrites content for other platforms on the **same** `post_id`. Use it only
when the user asks to convert or adapt a post. For new multi-platform posts, write each caption
yourself. After converting, validate each target and refine it with `update_post`.

## Attaching Media

| You have | Use |
|---|---|
| A public URL | `upload_media(source_type='url')` |
| A small inline file | `upload_media(source_type='base64')` |
| A file on the user's computer | `file_manager()` then `list_files()`: a drag-and-drop upload straight to Postey |

Upload first, take `cdn_url` from the response, then pass it in `contents[].media_urls`. Never
build a media URL by hand, and never ask the user to paste a file's contents.

**A video URL with no caption:** call `transcribe_video`, write each platform's caption from the
transcript (never paste the raw transcript), then `create_post`.

## Tagging

Add 2 to 3 tags after creating a post. Read `postey://accounts/{account_id}/tags` first and reuse
an existing name with its exact casing (`Marketing` and `marketing` are two tags). `add_tag` needs
ADMIN; `remove_tag` undoes a mis-tag.

## Ask, Don't Guess

- **Instagram**: ask for `post_type` (feed, reel or story). Never assume feed.
- **TikTok**: confirm the post type.
- **YouTube**: ask for the video title. It is required and is not the caption.
- **Pinterest**: ask for the Pin title, and the destination link if it should link out.

## Automation Guidelines

- No duplicate content across accounts, no unsolicited automated replies, no fake engagement.
- Respect rate limits; the server reports them.

## References

Loaded when you write captions:

- [caption-playbook.md](references/caption-playbook.md): the rules every caption follows
- [platform-archetypes.md](references/platform-archetypes.md): per-platform structure, hashtags, CTAs
- [hook-formulas.md](references/hook-formulas.md): writing the first line
- [post-structures.md](references/post-structures.md): post templates by goal
- [thread-and-video-formats.md](references/thread-and-video-formats.md): threads, reels, carousels
- [x-algorithm.md](references/x-algorithm.md): how X ranks posts
- [brand-profile-template.md](references/brand-profile-template.md): capturing a brand's voice
