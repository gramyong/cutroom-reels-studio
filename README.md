# CUTROOM STUDIO — Supabase Cloud

Pastel-themed video planning checklist with Google sign-in, live briefs, per-user cloud workspaces and Vercel continuous deployment.

## Account content strategy — four stages

In the account creation/edit dialog, creators design an account before publishing:

1. **Core message / mission** — what this account wants to communicate to its audience.
2. **Four content pillars** — the categories supporting that message.
3. **Topic ideas per pillar** — one video concept per line.
4. **Production allocation** — choose a target number of videos, then distribute exact quantities across the four pillars. Example: target 8 = 4 + 2 + 1 + 1.

Each account's mission, topic ideas and production mix appear at the **top of the workspace** as an always-visible strategy compass. The four cards show percentage allocations and how many video drafts were assigned to each pillar.

When creating or renaming a video, choose a pillar and optionally choose one of its planned topics. The live brief and MD/PDF exports include the selected pillar and account mission.

**Existing accounts and cloud records:** Previous account/project JSON remains readable; missing strategy fields are initialized as an incomplete draft. Open Account Settings to fill out the new strategy. No schema migration is required because the user-owned data uses JSONB and RLS remains enforced. Previous tone/tagline UI inputs were removed.

## V-A-L-S-A account operation strategy

Content pillars determine **what** an account talks about; V-A-L-S-A determines **which side of the creator** each video reveals. Its goal is to show a multidimensional person and build loyal followers, rather than using every tactic in every post.

- **V — Viral (바이럴):** quickly benchmark a currently popular format. Example: weave a trending dance format into a video.
- **A — Authority (권위 부여):** establish trust through lived experience or expertise. Example: a family member with 50 years' experience selling makgeolli.
- **L — Lifestyle (라이프 스타일):** share parts of everyday life to become relatable.
- **S — Storytelling (스토리텔링):** tell a personal journey, such as leaving an office job to care for rescued dogs.
- **A — Value (가치):** leave an actionable, beneficial one-line takeaway.

The V-A-L-S-A board sits **under the four-step account design** and before the video editing workspace. It shows per-element counts and five-facet coverage across this account's videos. A fold-out guide presents goals and practical examples.

In the video's **주제 선정** stage, select any VALSA facets relevant to that particular video (multiple choice) and type an implementation note. These selections update the board and account history instantly, are preserved by JSON backups and per-user Supabase JSONB storage, and appear in the live brief and all export formats.

The V-A-L-S-A coverage number is a descriptive count, **not a performance score** and not a requirement to force every facet into each video. Older videos with no saved VALSA selection remain compatible.

## Implemented
- Google OAuth via Supabase Auth (PKCE).
- Cloud accounts and video briefs saved per user, with Supabase PostgreSQL RLS.
- Debounced cloud writes and a per-user browser cache for intermittent connectivity.
- Manual confirmation before importing records from the old browser-only version.
- Existing Markdown/PDF/HTML document export, JSON backup and responsive editing.
- GitHub main branch automatically deploys to Vercel.

## One-time setup (required for live cloud storage)

The latest UI and cloud client code are deployed, but cloud storage remains in explicit local-only mode until a database and Google OAuth are configured.

### 1. Provision and link Supabase to Vercel
Open Vercel dashboard → cutroom-reels-studio → Storage → Supabase and create/connect an actual database resource. Link it to the cutroom-reels-studio PROJECT, not just the Vercel team. Region can be Seoul (icn1).

Official Vercel Supabase integration environment variables:
- SUPABASE_URL
- SUPABASE_PUBLISHABLE_KEY

Also accepted: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, legacy SUPABASE_ANON_KEY.

Do not paste a service role key or SUPABASE_SECRET_KEY into this app or GitHub. The public /api/config endpoint emits ONLY the project URL and a publishable key. The actual security boundary is Postgres RLS.

Redeploy the main branch after linking. Check https://cutroom-reels-studio.vercel.app/api/config — it must respond with configured:true.

### 2. SQL migrations
Supabase Dashboard → SQL Editor → run supabase/schema.sql from this repository.
This creates cutroom_accounts and cutroom_projects with account-owner foreign key enforcement and per-user RLS policies.

### 3. Google OAuth
In Google Cloud Console:
- Configure OAuth consent screen and OAuth client type Web Application.
- Authorized redirect URI: https://YOUR-SUPABASE-REF.supabase.co/auth/v1/callback (use exact callback from Supabase dashboard).
- Store the Google Client ID and Client Secret in Supabase Dashboard → Authentication → Providers → Google. Enable Google. Never commit Client Secret.

In Supabase → Authentication → URL Configuration:
- Site URL: https://cutroom-reels-studio.vercel.app
- Redirect URLs: https://cutroom-reels-studio.vercel.app/**

### 4. End-to-end verification
1. Open the live site in a fresh browser and complete Google login.
2. Create one video project, edit a field and tick a checklist item.
3. Ensure cloud indicator shows saved, not a setup/error message.
4. On a second device sign in as the same Google account, verify the same project and progress.
5. As a different Google account, confirm that first account's records are not visible.
6. Where older records exist, click 기존 기록 가져오기 once and check they sync to the second device.
7. Check phone layouts and Markdown/PDF/HTML exports.

### Caution
Edits to the exact same video simultaneously from multiple devices may resolve with last writer wins; edit independent videos normally, but avoid simultaneous editing of the same video.

## Key files
- index.html: original editor and cloud bridge
- cloud.js: Google OAuth, cloud autosync, browser cache and explicit legacy migration
- api/config.js: public Supabase configuration endpoint for Vercel
- supabase/schema.sql: secure PostgreSQL schema and RLS

GitHub main branch deployments: https://cutroom-reels-studio.vercel.app
