# Scene-first v3 correction — 2026-10-05

The first v2 phone preview exposed a false scene-area metric: a 1250px stage contained only 760px of sharp footage, with the remainder rendered as a conspicuous blur band. `scene_first_v3` fixes this by using a 246px (~13%) compact header and a 1320px scene stage. Portrait/4:5 sources such as the Superman gag reel render almost the entire stage as actual sharp footage (~68% of the 1920px frame). Dialogue/editorial captions are shifted left to x=335 and reduced in size for the YouTube Shorts right-side UI safe zone. The template no longer applies the v2 blur-strip composition to portraitish sources.

The corrected Alan Tudyk render was inspected from exported real frames at the opening and payoff before replacement of the scheduled upload.

# Adaptive template checkpoint — 2026-10-04

Public benchmark research sampled high-view movie/TV Shorts from multiple channels, including Mistaket Market (156M-view sample), Screen Brief (66M-view sample), Movie Land (26M-view sample), plus the user-provided subtitle reference. Repeated transferable patterns were: scene-first composition, a compact persistent context hook, 1–5-word timed captions, selective word emphasis, and purposeful punch-ins/callouts at the visual payoff. Patterns explicitly not copied include thick borders that shrink footage, raw clip reposting without added explanation, and editing intended to bypass detection.

New renders use scene_first_v2: compact branded hook panel (about 20% of frame), scene-derived stage (about 65% of frame), blurred scene fill behind a sharper moderately cropped source layer, dynamic editorial/dialogue captions, and a restrained payoff zoom. Gameplay remains silent and visually secondary. The prior template is treated as legacy_card_v1 for performance comparison. Existing Job 6 scheduled on YouTube remains unchanged.

# Originality / YPP safeguard checkpoint — 2026-10-04

Future renders use dynamic_editorial_v1: a researched Silent Narratives hook plus 2-6 scene-accurate caption beats generated from the verified local scene. Audible dialogue may be captioned exactly; editorial callouts are styled separately and must add explanatory value. Rendering and publishing are blocked without an editorial purpose, timed caption plan, verified facts, verified scene and visible payoff. Detection-evasion edits and artificial-engagement tactics are explicitly prohibited. This is a content-quality safeguard, not a guarantee of YouTube monetization eligibility.

The already-uploaded/scheduled Job 6 remains unchanged because YouTube already confirmed that upload and its local media was deleted. Apply this profile to new renders only.

# Current performance checkpoint — 2026-10-03

YouTube Analytics is now enabled. Channel audit found that 20K+ winners have a median 95.7% Shorts-feed share, while sub-1K failures have a median 63.6% share. On multi-upload days, first uploads had a ~33.9K median while later uploads had a 65-view median. This is observational, not proof of a platform penalty, but it is the strongest controllable signal in the channel history.

Current production policy: one manually started Short per day at 22:00 WAT, production paused between batches, target 6–9 seconds (hard publishing gate 6–10), hook target 8–12 words, immediate visible payoff required. Do not restore three-video daily batches without a controlled test. Existing already-published videos remain unchanged.

# Current authoritative checkpoint — 2026-10-03, version 0.3.0

This checkpoint takes precedence over historical records below. Owner requested the report improvements, then explicitly said **leave Cloudflare for now**. Preserve its current service, URL and configuration. Password sign-in remains disabled; manual three-video batches remain paused. No new production videos are authorized by this maintenance task.

Completed implementation: compact 8–14-word prompt and hard maximum 14-word render/approval/upload gate; live reading-load guidance; source-type/independent-URL checks and visible-payoff confirmation; equal-age compact/legacy hook comparisons; YouTube Analytics metrics and interactive retention curve; encrypted complete recovery bundles and optional private Drive delivery.

Current Analytics access: Google returned HTTP 403 `accessNotConfigured`: YouTube Analytics API is disabled in project 399805383895. The UI links to its activation page and requests read-only reporting consent only when selected. Existing YouTube upload credentials are preserved. Data API metrics and backups continue without Analytics access.

Encrypted recovery: public RSA certificate only on VPS; private key belongs to the owner's separate download and must be kept offline. Bundle includes database/credentials/source/fixed assets/referenced pending media with SHA256 manifest, authenticated AES-256-GCM, and a helper that verifies before extraction into an empty directory. Seven local snapshots retained. Daily private Drive delivery requires OAuth `drive.file` consent and enabled Drive API; do not claim it is active before its status says verified. A connector-delivered off-VPS checkpoint is distinct from ongoing automatic delivery.

Validation: 36 JS checks and five Python checks passed in isolated VPS staging, including actual FFmpeg, upload failures, editor guards, reporting schemas, encrypted restoration/tamper rejection and Drive resumption/privacy. Mobile verification passed the actual fixture batch start, rendering, approval gates, reading-load guide and retention chart without page errors or overflow. Staging contains no production credentials.

Existing Jobs 1–5, their YouTube IDs and slots must be preserved. Job 5 stays analyzed, unslotted and paused; do not shorten its actual package, acquire a scene or continue it until the owner explicitly starts a batch. Published videos and existing video design remain unchanged.

See README for current controls and restoration, and the improvement report for completion evidence and remaining one-time Google setup.

---

## Historical handoff

# Silent Narratives Automation — Authoritative Handoff

Last updated: 2026-10-03. This checkpoint takes precedence over all historical checkpoints below. Never place secret values here.

## Current verified deployment

- Version 0.2.0, VPS path `/home/ubuntu/workspace/silent-narratives-automation`, main branch. Existing approved video design is unchanged.
- Stable bookmark: https://vps-0868c90c.vps.ovh.ca/silent-narratives/ redirects to the current Cloudflare Quick Tunnel. Completion URL: https://author-notified-exhibit-forward.trycloudflare.com/; this hostname changes after tunnel restart.
- `silent-narratives-v1.service` serves only `127.0.0.1:8400`. The dedicated `silent-narratives-cloudflare.service` and `silent-narratives-backup.timer` are enabled. The audit staging service is stopped.
- Owner explicitly requested Cloudflare while retaining VPS hosting and no password sign-in. Dashboard contents and controls remain public; CSRF/security headers are not access control. Do not introduce password login without the owner's request.
- Google OAuth uses the original registered callback `https://vps-0868c90c.vps.ovh.ca/silent-narratives/oauth/youtube/callback`. `oauth_callback_base_url` is fixed; `public_base_url` follows the tunnel. Signed state is cookie-bound and expires after ten minutes; token persistence validates channel ID `UCPVj2rGuo-spOTpzUtCayPw`.
- Production is paused: `production_mode=manual_batch`, `batch_limit=3`, blank `batch_active_date`. Exactly one explicitly started date, slots 13:00/15:00/22:00 WAT. No automatic next-day production. Do not continue Job 5 or create new jobs until the owner starts a daily batch.

## Current job and channel state

- Five original job IDs, YouTube IDs and slots were preserved. No new production videos were created, uploaded, scheduled or published by this audit.
- Job 1 Deep Water: existing private upload, confirmed cleanup retained.
- Job 2 The Passion of the Christ: live YouTube public; local status corrected to published.
- Job 3 Meet Bill: rejected unsupported claim, unslotted, cannot continue.
- Job 4 Hardcore Henry: live YouTube public; local status corrected to published.
- Job 5 I Am Legend alternate ending: analyzed, unslotted, paused. Requires independent factual and exact-scene verification. Historical downloaded alternate-ending source is not an assigned/verified scene.
- Authenticated snapshot around 16:57 UTC: 57 subscribers, channel view counter 1,227,079, history 44 uploads (39 public / 5 private). Per-video public lifetime views sum to 1,262,906; different counter cadence/semantics prevent direct reconciliation. No Analytics retention/CTR data was available.
- Fresh history invalidated old ready-lead screening. Zero ready recommendations can mean existing leads are awaiting a fresh check; Scan sources can spend configured API/model quota. Do not treat credentials being configured as proof of live Gemini health.

## Enforced workflow and operational behavior

1. Duplicate checks include published/private history and pending jobs, and apply to direct sources. Invalid/uncertain model results require review.
2. Record an independent factual URL with notes and human confirmation before scene acquisition. Record and confirm the exact scene/timestamp before rendering. These are human attestations, not an automatic truth guarantee.
3. Verify the full current render and four-part package before scheduling. Content/file changes invalidate the relevant render or approval fingerprint. Preserve the charcoal card, real avatar, rounded movie window, silent gameplay, scene-only audio and 1080×1920/30 fps master.
4. Paused, rejected or incorrectly slotted jobs cannot continue. Failed jobs retain their slot. Rejecting an unuploaded job releases it. Three confirmed uploads pause the batch; no future day begins automatically. Pausing does not cancel existing YouTube schedules.
5. Save a YouTube resumable session before sending bytes and a confirmed video ID before readback. Verify privacy, accepted upload state and the exact future private publishing timestamp before cleanup. Preserve media on uncertainty and reconcile the existing upload. Never blindly create another upload when a session or ID exists.
6. Media transfers use 8 MiB chunks with offsets/progress. Long browser actions use asynchronous task IDs. Job state/session recovery is durable; task/progress tickets are in memory and must be checked after restart. Repeated job operations are serialized.
7. Metrics retry with backoff; missing values stay unknown. Slot summaries compare the same checkpoint, using public captures within 30 minutes and median views/sample counts. Do not mix video ages to declare a slot winner.

## Backups, limits and validation

- App systemd drop-in: CPUQuota 200%, MemoryHigh 1536M, MemoryMax 2G, UMask 0077, NoNewPrivileges, protected filesystem. Unrelated VPS apps remain untouched.
- Daily private backups at 03:30 UTC plus up to five minutes jitter; latest seven snapshots retained under project `backups/`. Consistent SQLite and credential copy; separate restored-copy integrity check passed. Fixed assets and off-VPS disaster recovery are not covered.
- Pre-deployment rollback: `/home/ubuntu/workspace/silent-narratives-audit-20261003/rollback-20261003T165740Z`. Keep it private; it contains credentials.
- 24 distinct checks passed: final backend/workflow 22 plus two real FFmpeg media checks run separately. Mocked failure-path uploads generated no real videos. Isolated mobile fact/scene/upload/render/review and settings flow passed. Live desktop/mobile showed no page errors or horizontal overflow.
- Cloudflare HTTP homepage/session/state/health, invalid-CSRF rejection, controlled tunnel restart, dynamic origin redirect and fixed OAuth callback URI all passed. No actual OAuth token exchange or full VPS reboot was performed.
- Remaining improvements: permanent named Cloudflare tunnel/custom hostname, encrypted off-VPS backup, shorter verified hook experiments, and YouTube Analytics for equal-age retention/engagement evaluation. Password-free public access remains the owner's current preference.
- Full report: `docs/AUDIT-2026-10-03.md`; evidence: `/home/ubuntu/workspace/silent-narratives-audit-20261003/evidence/`; operations/restore notes: `README.md` and `ops/`.

---

## Historical handoff (superseded by the checkpoint above)

# Silent Narratives Automation V1 — Authoritative Handoff

Last updated: 2026-10-02

This is the authoritative continuation document. Update it after every meaningful implementation, integration, deployment, workflow, or QA checkpoint. Never place secret values here.

## Project identity

- Project: Silent Narratives Automation V1
- Purpose: discover proven competitor Shorts, prevent repeat stories, generate the four-part Gemini package, locate/verify the exact movie or TV scene, render the established Silent Narratives format, review, upload privately to YouTube, and delete transient video files after confirmed upload.
- VPS path: /home/ubuntu/workspace/silent-narratives-automation
- GitHub: TropicalKenny/silent-narratives-automation
- Branch: main
- Dashboard: https://vps-0868c90c.vps.ovh.ca/silent-narratives/
- Local app: http://127.0.0.1:8400
- Service: silent-narratives-v1.service
- Service user: ubuntu
- Entrypoint: src/server.js
- Port: 8400

## Non-negotiable owner requirements

1. Existing Silent Narratives video format is authoritative. Do not redesign it without explicit approval.
2. Correct reference: dark charcoal social-post card, thin light outline, real Silent Narratives avatar, SILENT NARRATIVES + @silentnarrativesYT, centered white hook text, rounded embedded movie clip, gameplay visible around/below the card.
3. The white-card render is rejected and must not be used.
4. Gameplay background must match the main scene duration exactly by loop/trim.
5. Gameplay background must be silent in the final output.
6. Final audio must come only from the movie/TV scene.
7. Small subtitles are allowed only inside the scene clip; prefer actual dialogue and do not duplicate the full hook.
8. User publishes 3 Shorts/day.
9. First automated upload remains PRIVATE until approved.
10. After YouTube returns a confirmed video ID, immediately delete source/intermediate/final job videos and retain metadata/history only.
11. Failed uploads keep files for retry.
12. Never recommend a story already published by Silent Narratives, even through a different competitor URL/title.
13. Dashboard should use clean YouTube Studio-like hierarchy, not generic SaaS/AI patterns.
14. Single-page dashboard: no redundant mobile bottom navigation.
15. Keep this handoff updated.

## Channel state

Last verified:
- Channel: Silent Narratives
- Subscribers: 57
- Total API-reported views: 1,219,589
- Local avatar: assets/channel-avatar.jpg
- Channel-history rows: 41
- YouTube API videoCount last reported: 38. Do not assume videoCount and history-row count have identical semantics.

Recent published stories include:
- Predator / Carl Weathers 3 AM workout
- Stranger Things / David Harbour real-hair shaving
- John Wick 4 / $39,000 per spoken word
- The Ones Who Live / scrapped Rick Grimes trilogy
- Resident Evil / physical mold
- Scrubs / Elliot heart-rate jumpstart
- LOTR / Viggo Mortensen real pain
- Django / real blood

## Competitors configured

- @JustMotorHead
- @YautjaVision

@YautjaVision resolves to Yautja Vision, channel ID UCg6M2-P01pnmEjtWwtoOlHg.

Earlier “Yajua Vision” wording was wrong. Use the exact handle above.

## Discovery and duplicate prevention

Minimum source views: 5,000,000.

Last verified:
- 34 usable candidates
- 4 confirmed duplicates blocked
- 0 unresolved review-needed candidates
- 0 unscreened current candidates

Blocked repeats:
1. John Wick 4 — $39,000 per word
2. Stranger Things 4 — David Harbour haircut / real hair
3. Rick Grimes movies cancelled / trilogy → The Ones Who Live
4. Scrubs — Elliot jumpstarting patient / heart-rate story

Duplicate implementation:
- src/duplicates.js
- candidate fields: duplicate_of_video_id, duplicate_reason, screened_at
- API state hides duplicate and review_needed candidates
- clear title/history matches block directly
- ambiguous matches use actual-video comparison
- if verification cannot complete, hide/review instead of recommending as safe

## Gemini

Primary: gemini-3.5-flash
Fallback: gemini-3.5-flash-lite

Both are available to the current API key.

Do not use gemini-3.1-pro-preview for the free-tier path.
Do not reintroduce gemini-3.8-flash as primary.
Do not reintroduce the retired Gemini Interactions schema.

Files:
- src/gemini.js
- config/master_prompt.md
- config/defaults.json

Visible Gemini output remains exactly:
1. Hook + Commentary
2. Unique Video Title
3. YouTube Shorts Description
4. Video Tags

Scene metadata stays machine-only.

src/gemini.js uses the current generateContent video-understanding API with request timeouts and fallback from 3.5 Flash to 3.5 Flash-Lite for transient failures.

## Integrations

Last verified configured:
- Gemini API
- YouTube Data API
- Google OAuth client
- YouTube channel OAuth
- gameplay background

Never put credential values in Git, logs, README, or this handoff.

## Dashboard

Public URL:
https://vps-0868c90c.vps.ovh.ca/silent-narratives/

Files:
- public/index.html
- public/styles.css
- public/app.js

Direction:
- restrained dark UI inspired by YouTube Studio
- actual content/thumbnails dominate
- strong section hierarchy
- minimal accent color
- no generic metric-card wall
- no redundant bottom nav
- compact mobile three-slot queue
- system/source management in dialogs

Browser QA has been done at desktop/tablet/iPhone widths. Continue to test real-data states.

## Renderer

File: src/renderer.js

Current technical behavior:
- 1080×1920
- 30 fps, matching the native gameplay frame rate; 60 fps is not used because it would only duplicate frames from 30 fps gameplay / 23.976 fps movie source
- background loop/trim matches the scene-audio master duration
- background audio is never mapped
- scene audio only
- source fps is normalized before zoom so movie footage cannot end early
- tpad/trim guards the last video frame so picture and audio end together
- subtle scene push-in rather than aggressive template motion
- phrase-level ASS subtitles with short fade + 96→100% micro-pop
- subtitle design is limited to 1–2 concise chunks and stays inside the movie window

IMPORTANT: current white visual card is rejected.

Measured geometry was rechecked directly against the owner reference screenshot on 2026-10-02. Final normalized 1080×1920 geometry:
- outer card: x about 11, y about 131, width about 1058, height about 1374
- embedded movie window: x 18, y about 644, width 1044, height 859
- this tall 1044×859 media geometry is the correct reference; the earlier 1044×626 window was too short
- avatar/header group is intentionally inset farther from the left than the rejected render
- card fill is dark charcoal
- card has a light outline and rounded corners
- hook is centered white text
- avatar comes from assets/channel-avatar.jpg

## Gameplay background

File: assets/background.mp4

Last verified:
- source duration about 11.4667s
- video stream only
- no audio stream
- renderer loop/trims to scene duration

A previous test with a 6.3s scene produced a 6.3s final.

## Current end-to-end test job

Job ID: 1
Candidate ID: 17
Competitor source:
https://www.youtube.com/shorts/6Ks8ZB4jNsA

Story:
Deep Water (2022), Ben Affleck and Ana de Armas, on-screen chemistry / real-life romance angle.

Hook:
In Deep Water (2022), Ben Affleck and Ana de Armas played a dysfunctional married couple locked in a psychological game, but their intense on-screen chemistry accidentally sparked a real-life romance during production.

Generated title:
When Movie Chemistry Becomes Real Life 🎬🔥 #DeepWater #BenAffleck #shorts

Scene research:
- official 20th Century Studios trailer was ranked best visual source by Gemini at 0.95 confidence, approximately 6.2–15.0s
- direct YouTube media extraction hit YouTube bot protection
- public Deep Water BTS reel successfully acquired:
  https://www.dailymotion.com/video/x8966sj
- local full source: work/1/deep-water-bts.mp4
- source length about 87.2s, 1080p, with audio

Rejected first scene:
- work/1/scene.mp4
- about 6.05s
- contained “Do you know I love you?”
- also contained featurette narrator beginning “Deep Water is a...”
- reject because promo narration leaks into the edit

Clean candidate scene:
- work/1/scene-clean.mp4
- about 4.2535s
- 1920×1080
- AAC stereo, 44.1 kHz
- must be verified to contain no featurette narrator before final render

Current rejected render:
- work/1/final.mp4
- DB status currently rendered
- DO NOT UPLOAD

## Audio rules and last verification

Technical routing is correct:
- gameplay file has no audio stream
- scene input has AAC stereo
- final render has AAC stereo
- renderer maps scene input audio only
- first 6s scene mean volume about -14.3 dB
- first 6s final mean volume about -14.3 dB

But audio QA must validate content, not just stream mapping.

Every scene must pass:
1. technical audio-source mapping
2. actual dialogue/music/narration content review

## Scene acquisition

Temporary extractor:
- .runtime-tools/yt-dlp
- .runtime-tools/ is Git-ignored

Use only for verifier-approved scene source URLs/ranges, not as a generic downloader.

Direct YouTube extraction can fail due bot checks. Prefer public/authorized alternate sources when available.

## Upload behavior

Route: POST /api/jobs/:id/upload

On confirmed success:
1. persist YouTube video ID/URL
2. set upload_confirmed_at
3. mark uploaded
4. delete all job videos
5. clear scene_file/render_file
6. set deleted_at

Default privacy: private.

Do not publish publicly without explicit owner approval.

## Main API routes

- GET /health
- GET /api/state
- POST /api/history/sync
- POST /api/settings
- POST /api/settings/secrets
- POST /api/assets/background
- POST /api/competitors
- DELETE /api/competitors/:id
- POST /api/discover
- POST /api/jobs/from-candidate/:id
- POST /api/jobs/from-url
- POST /api/jobs/:id/analyze
- POST /api/jobs/:id/scene
- POST /api/jobs/:id/render
- GET /api/jobs/:id/video
- POST /api/jobs/:id/upload
- GET /oauth/youtube/start
- GET /oauth/youtube/callback

## Database

Node built-in SQLite / DatabaseSync.

Main tables:
- competitors
- candidates
- jobs
- channel_history
- app_settings

WAL and foreign keys enabled.

Do not casually clear channel_history; it is part of duplicate prevention.

## Git

Remote:
https://github.com/TropicalKenny/silent-narratives-automation.git

Recent commits:
- 54f3bd5 — Refine V1 studio workflow and Gemini 3.5 analysis
- 41aba08 — Rebuild V1 as media production desk and sync channel history
- 7332213 — Match gameplay duration to scene and mute background audio
- d551fe1 — Match gameplay background to main clip duration
- 2b1ba95 — Fix iPhone gameplay background upload

Uncommitted work at this checkpoint includes later duplicate screening, current Gemini implementation, Studio-style dashboard work, channel avatar, runtime extractor ignore, handoff, and Job 1 scene work. Commit after corrected renderer + preview QA.

## Immediate next steps

1. Verify work/1/scene-clean.mp4 has no featurette narrator.
2. Replace rejected white-card renderer with measured dark Silent Narratives reference.
3. Use assets/channel-avatar.jpg.
4. Add rounded movie-window masking.
5. Preserve useful original dialogue; expected line is “Do you know I love you?”
6. Render Job 1 with exact-duration gameplay, silent background, scene-only audio, subtle motion, minimal dialogue subtitle.
7. QA first/middle/last frames, geometry, text fit, rounded media, duration equality, audio stream and actual audio content.
8. Expose finished Job 1 MP4 in dashboard for owner review.
9. STOP before upload until owner approves.
10. After approval upload PRIVATE and verify automatic transient cleanup.

## Known failures / avoid repeating

- Login was removed after repeated auth failures. Do not reintroduce basic login without request.
- Do not use the rejected white-card renderer.
- Do not assume audio is correct because FFmpeg mapping is correct.
- Direct YouTube download can trigger bot protection.
- 3.8 Flash was unreliable/high-demand.
- Retired Gemini Interactions schema must not return.
- Wrong channel spelling “Yajua Vision” must not return; exact handle is @YautjaVision.
- Do not recommend blocked duplicate stories.
- Do not add redundant mobile bottom navigation.

## V1 completion definition

V1 is complete only after one real Short passes:
- discovery
- duplicate screen
- Gemini package
- exact scene selection/verification
- automatic scene acquisition
- correct Silent Narratives render
- audio QA
- owner preview approval
- PRIVATE YouTube upload
- confirmed YouTube ID
- automatic transient cleanup

After that, extend to automatically preparing 3 complete ready-to-review Shorts per day.

## Checkpoint — 2026-10-02 corrected Job 1 preview

Completed after the initial handoff was written:

- Verified work/1/scene-clean.mp4 with Gemini 3.5 Flash:
  - no featurette narrator
  - clear dialogue: “Do you know I love you?”
  - suitable for final edit
- Rebuilt src/renderer.js to use the owner-approved dark Silent Narratives reference.
- Renderer now uses:
  - dark charcoal card
  - thin light outline
  - local real channel avatar from assets/channel-avatar.jpg
  - SILENT NARRATIVES + @silentnarrativesYT header
  - centered white hook
  - rounded 1044×626 embedded movie window
  - small dialogue subtitles inside the movie window
- Restarted silent-narratives-v1.service so the live process loaded the new renderer.
- Rerendered Job 1 successfully.
- Current Job 1 final:
  - work/1/final.mp4
  - exact video duration: 4.200s
  - exact audio duration: 4.200s
  - H.264 High Profile, BT.709, 1080×1920, 30 fps
  - current video bitrate about 10.15 Mbps
  - AAC-LC stereo, 48 kHz, about 290 kbps actual
  - renderer target quality: libx264 slow preset, CRF 12, fast-start MP4
  - background remains silent and loop/trimmed exactly to the master scene duration
- Visual QA contact sheet:
  - work/1/final-reference-check-v2.jpg
- The previous white-card render is superseded.
- Job 1 remains PRIVATE/not uploaded. Owner review is still required before upload.

Current immediate next step:
1. Owner reviews Job 1 in the dashboard.
2. If visual/audio changes are requested, iterate renderer or clip.
3. If approved, upload Job 1 PRIVATE.
4. Verify YouTube video ID and automatic transient file cleanup.
5. Then convert the proven scene-acquisition process into a reusable automatic scene-acquisition module for the 3-per-day workflow.


## Checkpoint — timing, motion design and upload-master quality

The owner reported that the embedded movie picture was ending before the scene audio/full Short. Root cause was identified precisely:

- source scene video is 24000/1001 fps (~23.976 fps)
- the old zoompan used d=1 while producing 30 fps output
- one output frame was generated per source frame, so ~4.2s of source picture became ~3.4s of visible movie footage
- audio stayed ~4.2s, creating the visible early-stop bug

Fix:
- normalize scene to 30 fps BEFORE zoompan
- tpad with clone guard
- trim picture to the same audio-master duration
- final output now has video duration 4.200s and audio duration 4.200s
- an end-frame QA image at ~4.05s confirmed the movie picture is still present

Hand-edited motion/subtitle treatment now implemented:
- actual scene dialogue only: “Do you know” / “I love you?”
- two short caption chunks
- bold high-contrast white captions with dark outline/shadow
- captions remain inside the movie window
- 85ms in / 110ms out fade
- subtle 96→100% micro-pop per phrase
- gentle scene push-in capped around 3.2%
- short card/scene fade-in
- no bouncing, spinning, constant word effects, or decorative transition spam

Research rationale:
- short-form captions must remain quickly readable on mobile
- motion should reinforce timing/hierarchy rather than decorate every element
- use restrained phrase/word emphasis, not constant animation

Upload-master rule:
- highest meaningful Shorts master for this project is 1080×1920, not artificial 4K upscaling
- current gameplay is native 30 fps; use 30 fps rather than fake 60 fps frame duplication
- MP4 / H.264 High Profile / yuv420p / BT.709 / progressive
- libx264 slow / CRF 12
- AAC-LC stereo / 48 kHz / high bitrate
- +faststart enabled
- current Job 1 master is ~10.15 Mbps video, above YouTube’s standard 1080p reference bitrate while retaining constant-quality encoding

## Checkpoint — 2026-10-02 timing, handcrafted motion, and high-quality master

Owner identified that the embedded movie picture was ending before the scene audio/final Short. Root cause was confirmed:

- source scene video: 24000/1001 fps (~23.976)
- renderer used zoompan with d=1 and output fps=30 without first normalizing source timing
- one output frame per source frame compressed the visible scene duration relative to its audio

Fix:
- normalize the scene to 30 fps BEFORE zoompan
- reset timestamps before the motion filter
- use tpad stop_mode=clone only as a tiny end-safety guard, not as the primary timing fix
- master duration is now derived from the valid synchronized media duration
- final Job 1 video stream duration: exactly 4.200s
- final Job 1 audio stream duration: exactly 4.200s
- end-of-video crop hashes differ at 3.20s, 3.80s and 4.10s, confirming the embedded movie picture continues changing instead of freezing early

Handcrafted-edit treatment added:
- subtle card fade-in
- restrained continuous scene push-in, capped around 3.2%
- custom burned-in dialogue captions inside the movie window
- captions use short phrase chunks, dark outline/shadow and a 96→100% micro-pop with quick fade rather than generic bounce effects
- current Job 1 dialogue chunks: “Do you know” / “I love you?”
- treatment intentionally remains restrained so the existing Silent Narratives format stays recognizable

Research/quality rationale:
- captions are kept short/high-contrast for phone readability and muted viewing
- animation is tied to dialogue/edit timing instead of decorating every word
- do not upscale merely to claim a higher number; preserve meaningful source detail

Current export master:
- container: MP4 with faststart
- canvas: 1080×1920 vertical
- video: H.264 High Profile, Level 4.1
- scan: progressive
- pixel format: yuv420p (4:2:0)
- color: BT.709 primaries / transfer / matrix
- frame rate: 30 fps
- encoder: libx264 preset slow
- quality: CRF 15
- measured Job 1 video bitrate: about 10.15 Mbps
- audio: AAC-LC stereo
- audio sample rate: 48 kHz
- requested audio encode: 320 kbps; measured Job 1 about 290 kbps
- final file duration: exactly 4.200s
- Job 1 final size: about 5.49 MB

Why not force 60 fps or 4K for this source:
- gameplay source is native 30 fps and 512×560
- Deep Water scene source is native ~23.976 fps and 1920×1080
- 60 fps would synthesize/duplicate frames rather than add captured motion
- 4K would upscale the low-resolution gameplay without adding real detail
- exporter should stay source-aware; if future background/scene assets are genuinely higher-resolution/high-frame-rate, raise the master accordingly

Current preview remains NOT uploaded. Owner approval is still required before private YouTube upload.

## Checkpoint — 2026-10-02 first-frame and mobile preview performance

Owner reported two preview problems:
1. Safari/direct video preview showed an empty/black card on the first frame.
2. Review video took too long to load on mobile.

First-frame root cause:
- full FFmpeg composition layers were not all present during the opening ~0.17–0.20 seconds.
- simply removing visual fades was insufficient.

First-frame fix:
- renderer now creates the layered composite first.
- it captures the first fully composed frame at about 0.20s.
- final upload master begins with a deliberate ~0.20s micro-hold of that fully composed frame.
- it then continues from that same source timestamp.
- original audio remains mapped from 0.00 and is not cut/shifted.
- current dialogue begins after the micro-hold, so A/V meaning remains intact.
- literal decoded frame 0 was manually inspected and now contains:
  - full dark Silent Narratives card
  - real avatar
  - brand/handle
  - full hook
  - visible Deep Water scene
- final video and audio streams remain exactly 4.200s.

Review performance root cause:
- the public review route served the full high-quality upload master (~5.2 MB).
- dashboard appended Date.now() as a query parameter, guaranteeing a cache miss on every refresh.
- Nginx added Cache-Control: private, no-store to the entire Silent Narratives route.

Performance fix:
- renderer now creates two files:
  - work/<job>/final.mp4 = upload master
  - work/<job>/preview.mp4 = lightweight phone/browser review derivative
- current Job 1 review derivative:
  - 720×1280
  - ~1.37 Mbps video
  - AAC 48 kHz stereo ~128 kbps
  - total size about 730–775 KB depending on render
  - faststart enabled
- /api/jobs/:id/video serves preview.mp4 by default.
- /api/jobs/:id/video?master=1 serves the full master.
- jobs table now includes preview_file.
- upload cleanup also clears preview_file and deletes it with other transient files.
- dashboard preview URL now uses the job updated_at version instead of Date.now(), so the browser cache is reused until a real rerender occurs.
- Nginx now hides upstream Cache-Control for the Silent Narratives location and applies:
  - video-review route: private, max-age=300
  - all other Silent Narratives routes: private, no-store
- public review route still supports Accept-Ranges and HTTP 206 partial responses.
- VPS-side public transfer test for the ~793 KB review file:
  - time to first byte about 0.023s
  - total transfer about 0.029s on the origin network

Nginx file modified outside Git:
- /etc/nginx/sites-enabled/aurent-origin
- nginx -t passed before reload.

Important:
- do not remove the lightweight review derivative when optimizing upload quality.
- do not re-add Date.now() cache busting to preview URLs.
- upload must continue using final.mp4, not preview.mp4.

## Checkpoint — 2026-10-02 badge spacing, dramatic subtitles, and verified A/V sync

Owner feedback:
- verified badge was too close to / overlapping the end of SILENT NARRATIVES
- “I love you” audio arrived earlier than the matching visible speech
- subtitles/motion were too subtle and did not feel sufficiently hand-edited
- subtitles may be dramatic as long as the result still feels human-made and preserves the Silent Narratives format

Header refinement:
- title font reduced slightly from 39 to 37
- verified badge moved right to provide clear breathing room
- badge now reads as a separate verification mark instead of touching the title

Root cause of the A/V offset:
- the source clip itself was synchronized
- Gemini measured source speech at approximately 0.49–1.55s and visible speech at approximately 0.52–1.55s
- the previous first-frame fix altered the opening picture treatment without applying the same timeline treatment to audio
- therefore the render, not the source, created the perceived audio lead

Final sync-safe head treatment:
- keep the first complete composed frame as a short opening hold
- remove the broken first 0.20s of BOTH the composed video timeline and scene-audio timeline together
- replace that interval with:
  - the fully composed visual hold
  - equal-duration silence
- resume BOTH picture and scene audio from the same 0.20s source timestamp
- no spoken dialogue is lost because the verified line starts around 0.49s
- final duration remains exactly 4.200s
- final video and audio streams both start at 0.000s and end at 4.200s

Final rendered A/V verification:
- Gemini 3.5 Flash inspected the rendered review file itself
- estimated A/V offset: 0.0s
- classification: aligned
- sync quality: good
- the line “Do you know I love you?” was judged synchronized to visible speech

Dramatic subtitle treatment:
- subtitle timing is now based on verified speech timing metadata instead of dividing the clip into rough halves
- Job 1 subtitle timings stored in scene_meta:
  - “DO YOU KNOW” about 0.45–0.94s
  - “I LOVE YOU?” about 0.93–1.64s
- first phrase:
  - white
  - restrained upward lift
  - subtle 95→101% scale-in
  - short fade
- payoff phrase:
  - larger
  - warm coral accent
  - fast 90→110% overshoot, then settles to 100%
  - heavier outline/shadow for drama and phone readability
- the movie shot receives a stronger, timed punch-in starting around the payoff phrase rather than a constant generic zoom
- this is intentionally editorial/dramatic, not a bouncing template effect

Current visual QA:
- literal frame 0 is fully composed and contains the scene
- verified badge no longer crowds the brand title
- first phrase and payoff subtitle are visually distinct
- payoff subtitle remains inside the movie window
- gameplay remains visible outside the card
- final preview remains NOT uploaded to YouTube

Current render:
- final.mp4: full upload master
- preview.mp4: lightweight review derivative
- duration: 4.200s
- video/audio aligned by final rendered-file verification

Do not upload until owner approves this specific version.

## Checkpoint — 2026-10-02 approved visual baseline and verified badge

Owner approved the current Silent Narratives Short design, with one final badge correction.

Verified badge correction:
- previous badge had too much horizontal separation from SILENT NARRATIVES
- previous mark was a plain blue circle
- title text width at the current render scale ends around x≈754
- previous badge began around x≈798, leaving about 44 px of dead space
- badge is now positioned directly after the title with only a small intentional gap
- badge is now a small blue rosette/burst rather than a plain circle
- white check remains centered inside the badge
- title, handle, hook, scene geometry, subtitles, motion, audio timing and gameplay treatment were otherwise left unchanged

Owner status:
- current visual design is approved
- treat this renderer layout as the new authoritative visual baseline
- future work must preserve this baseline unless the owner explicitly requests a redesign

Current approved visual baseline includes:
- dark charcoal card
- thin light outline
- real Silent Narratives avatar
- SILENT NARRATIVES header
- small blue verified rosette immediately after the title
- @silentnarrativesYT handle
- centered white story hook
- rounded embedded scene
- dramatic but restrained dialogue captions
- timed payoff punch-in
- gameplay background visible around/below card
- silent gameplay audio
- scene-only audio
- verified A/V sync
- lightweight mobile preview derivative
- high-quality separate upload master

Job 1 remains not uploaded. Next action after this checkpoint is owner-directed upload/automation continuation.

## Checkpoint — 2026-10-02 first private upload + Nigeria slot engine

### First full upload validation passed

Approved Deep Water Job 1 was uploaded PRIVATE to YouTube.

YouTube result:
- video ID: G4SYn4kf-sI
- URL: https://youtu.be/G4SYn4kf-sI
- privacy verified through channel history sync: private
- correct generated title present
- upload_confirmed_at recorded
- deleted_at recorded at the successful cleanup checkpoint
- scene_file cleared
- render_file cleared
- preview_file cleared
- entire work/1 directory removed after upload confirmation

This proves the V1 upload + confirmed-delete lifecycle works end to end.

### Authoritative publishing schedule

Timezone:
- Africa/Lagos
- WAT / UTC+1

Daily slots:
- 13:00 WAT
- 16:00 WAT
- 22:00 WAT

Stored in app settings and config/defaults.json.

Scheduling fields added to jobs:
- slot_date
- slot_time
- scheduled_publish_at
- youtube_publish_at

Scheduling design:
- new jobs automatically receive the next open future publishing slot
- scheduling uses YouTube publishAt with privacy kept private before the scheduled public release
- do not depend on a VPS timer firing exactly at the publishing minute
- scheduled uploads must be read back from YouTube and verified private before local cleanup
- cleanup after successful scheduling follows the same transient-file deletion rule as normal upload

New routes:
- POST /api/jobs/:id/slot
- POST /api/jobs/:id/schedule

The scheduled-upload path is implemented but has NOT yet been tested with a completed future render. Do not call it proven until one real scheduled upload is verified.

### Job 2 — current 22:00 WAT production job

Candidate:
- candidate ID 2
- competitor: @JustMotorHead
- source Short: https://www.youtube.com/shorts/MfD4Q-tElXM
- source views at discovery: 47,407,906
- story: The Passion of the Christ (2004), Pietro Sarubbi / Barabbas eye-contact with Jim Caviezel / Jesus

Automatic slot assignment passed:
- job ID: 2
- slot date: 2026-10-02
- slot time: 22:00 WAT
- scheduled_publish_at: 2026-10-02T21:00:00.000Z

Gemini package was regenerated after a fact-attribution correction.

Current hook:
In The Passion of the Christ (2004), director Mel Gibson ordered Pietro Sarubbi to avoid looking at Jim Caviezel until the cameras rolled to capture a raw, authentic reaction. When they finally locked eyes, Sarubbi, a lifelong atheist, later claimed he didn't see an actor, but felt he was looking at Jesus himself, a moment he said completely transformed his perspective.

Important editorial rule added to config/master_prompt.md:
- subjective testimony, personal belief, conversion, motive, health experience, or interpretation must be explicitly attributed rather than presented as independently proven fact.

Gemini scene metadata normalization fixed:
- if Gemini returns scene metadata as a one-item array, normalize it to an object
- subtitle_text now persists correctly instead of being silently dropped

Current Job 2 scene metadata:
- exact target: Barabbas is released, reacts/laughs, then locks eyes with bloodied/bound Jesus
- source Short reports only crowd noise/no spoken dialogue
- proposed subtitle treatment is contextual/testimonial rather than fake dialogue

### Scene-source verification result

Tested extractable source:
- Dailymotion: https://www.dailymotion.com/video/x19mrn0
- downloaded successfully at 1920x824
- duration about 116.6 seconds
- local source: work/2/source-dm.mp4
- verification proxy created and inspected with Gemini

Result:
- exact_scene_present: false
- confidence: 1.0
- Gemini identified it as a trailer montage that does NOT contain the exact Barabbas/Jesus eye-contact interaction

Therefore:
- this source is REJECTED for Job 2
- do not render it
- do not schedule Job 2 until an exact scene source is verified
- wrong-scene substitution is prohibited even if the posting slot is approaching

### Immediate continuation point

1. Find another extractable/public/authorized source containing the exact Barabbas/Jesus release scene.
2. Verify the source visually before extracting.
3. Extract a clean 6–9 second segment with the original scene/crowd audio.
4. Build subtitle timing around the actual visual beats because there is no useful spoken dialogue.
5. Render using the approved Silent Narratives visual baseline.
6. QA first frame, scene accuracy, motion, subtitle timing, A/V, and mobile preview.
7. Owner review.
8. Only after approval, test the new YouTube scheduling route.
9. If the 22:00 slot cannot be met safely, move Job 2 to the next open slot rather than publish a wrong or unverified scene.

### Dashboard follow-up still pending

The backend slot engine is live, but the dashboard still needs to visually display:
- 1 PM / 4 PM / 10 PM WAT slot labels
- assigned slot date/time on production cards
- scheduled state and YouTube publishAt
- schedule action after owner approval

Do not consider the slot UI finished until that is implemented and browser-QA'd.

## Checkpoint — 2026-10-02 Job 2 exact-scene render ready for approval

Job 2 progressed beyond the earlier rejected-trailer checkpoint.

Exact source:
- Clip.Cafe
- page: https://clip.cafe/the-passion-of-the-christ-2004/which-of-the-two-men-would-you-have-me-release-to-you/
- direct public clip was available through the Clip.Cafe player
- movie timestamp: 00:49:47
- exact public scene source was verified before rendering

Selected scene:
- local verified exact-source file: work/2/barabbas-exact.mp4
- final scene file: work/2/scene.mp4
- selected source segment: about 4.8–11.0s
- final scene duration: about 6.20s
- resolution: 1920×800
- source frame rate: 23.976 fps
- audio: 48 kHz stereo
- visual sequence contains:
  - Barabbas reacting/laughing during the release-choice sequence
  - cut to Jesus close-up
  - subsequent reactions within the exact Barabbas-release scene
- this replaces the previously rejected unrelated Dailymotion trailer montage

Final Job 2 package:
- status: rendered
- slot: 2026-10-02 at 22:00 WAT
- scheduled_publish_at: 2026-10-02T21:00:00Z
- render master: work/2/final.mp4
- lightweight review: work/2/preview.mp4
- master: 1080×1920, 30 fps, 48 kHz stereo
- master video/audio duration: exactly 6.200s
- review size: about 1.32 MB

Current corrected hook:
In The Passion of the Christ (2004), Mel Gibson kept Pietro Sarubbi from looking at Jim Caviezel until the cameras rolled. Sarubbi later said that first look felt like seeing Jesus himself—and changed his life.

Current title:
The Atheist Actor Who Saw "Jesus" On Set 😲🎬 #thepassionofthechrist #jimcaviezel #shorts

Current contextual subtitles:
- HE LATER SAID…
- HE SAW JESUS.

Subtitle timing:
- HE LATER SAID…: about 0.55–2.10s
- HE SAW JESUS.: about 2.25–4.60s

These are contextual editorial captions, not fake spoken dialogue. The scene itself contains crowd/scene audio rather than useful spoken dialogue.

Visual QA:
- approved Silent Narratives visual baseline preserved
- verified rosette preserved
- gameplay background preserved
- exact Barabbas/Jesus footage is visible
- contextual dramatic subtitles appear within the movie window
- first/mid/end QA frames generated
- wrong-scene Dailymotion source remains rejected and must not be reused

Dashboard scheduling UI:
- production/job cards now display assigned slot date/time in WAT
- rendered jobs with scheduled_publish_at show an “Approve + schedule” action
- schedule action calls POST /api/jobs/:id/schedule
- the UI clearly states that the file is uploaded private first and YouTube publishes it at the assigned slot
- schedule action still requires explicit owner click/approval
- do not auto-schedule without owner approval

Job 2 is NOT uploaded/scheduled yet.
Owner approval of the rendered preview is the next action.

## Checkpoint — 2026-10-02 daily publishing slots + first scheduled-production candidate

### First real private upload validation succeeded

Approved Deep Water Job 1 was uploaded to YouTube as PRIVATE.

YouTube result:
- video ID: G4SYn4kf-sI
- URL: https://youtu.be/G4SYn4kf-sI
- YouTube history sync verified privacy = private
- title verified in channel history
- upload confirmation timestamp stored
- local cleanup occurred only after YouTube returned the real video ID
- scene_file, render_file and preview_file were cleared
- entire work/1 directory was deleted
- channel history now contains this private test upload for duplicate prevention

This proves the V1 upload + confirmed-cleanup path end-to-end.

### Authoritative publishing schedule

Timezone:
- Africa/Lagos
- WAT / UTC+1

Daily publishing slots:
1. 13:00 WAT
2. 16:00 WAT
3. 22:00 WAT

These are now stored in app settings and config/defaults.json.

Default review lead target:
- 90 minutes before each slot

### Slot engine

New job columns:
- slot_date
- slot_time
- scheduled_publish_at
- youtube_publish_at

New jobs created from either:
- screened candidate
- direct YouTube URL

are automatically assigned to the next open future publishing slot.

Slot conversion:
- Nigeria is treated as UTC+1 year-round
- 22:00 WAT = 21:00 UTC

New API:
- POST /api/jobs/:id/slot
- POST /api/jobs/:id/schedule

Scheduling behavior:
- render must exist
- assigned publish time must still be in the future
- upload is sent to YouTube as PRIVATE with publishAt
- app reads the uploaded video back from YouTube
- verifies it is private before scheduled publication
- stores the returned YouTube publishAt
- only after YouTube confirms the scheduled upload does transient cleanup run
- successful scheduled jobs become status scheduled
- failed scheduling preserves files for retry

Do NOT call the schedule route before owner review/approval.

### Dashboard slot workflow

Dashboard now understands the 3 fixed WAT production slots.

Today cards are associated with:
- Video 1 · 1:00 PM WAT
- Video 2 · 4:00 PM WAT
- Video 3 · 10:00 PM WAT

Rendered jobs with an assigned slot show:
- Approve + schedule [slot]

Scheduled/uploaded jobs leave the active production list.

The old private-upload action remains available only for jobs without a scheduled_publish_at value and for explicit testing.

### Gemini reliability fixes

Gemini scene metadata sometimes returned as a one-element array.

src/gemini.js now normalizes:
- array → first object
- invalid/null → empty object
- subtitle_text → always an array

The master prompt now requires attribution for subjective/personal testimony:
- personal beliefs
- memories
- claimed conversions
- motives
- other subjective experiences

Do not present those as independently verified objective events.

### Job 2 — 10 PM WAT candidate

Candidate:
- source candidate ID: 2
- competitor: @JustMotorHead
- competitor Short: https://www.youtube.com/shorts/MfD4Q-tElXM
- competitor views at selection: ~47.4M

Assigned slot:
- date: 2026-10-02
- time: 22:00 WAT
- scheduled_publish_at: 2026-10-02T21:00:00.000Z

Story:
- The Passion of the Christ (2004)
- Pietro Sarubbi / Barabbas
- Mel Gibson keeping Sarubbi from looking at Jim Caviezel before the take
- Sarubbi later describing the first look as feeling like he was seeing Jesus

Current approved-for-review hook:
“In The Passion of the Christ (2004), Mel Gibson kept Pietro Sarubbi from looking at Jim Caviezel until the cameras rolled. Sarubbi later said that first look felt like seeing Jesus himself—and changed his life.”

The wording is intentionally attributed to Sarubbi.

### Job 2 exact scene acquisition

A Dailymotion source was tested first but rejected because it was only teaser/trailer footage.

Exact scene source found:
- Clip.Cafe exact movie clip
- page: https://clip.cafe/the-passion-of-the-christ-2004/which-of-the-two-men-would-you-have-me-release-to-you/
- direct public MP4 was exposed by the page
- clip duration: ~17.86s
- 1920×1080
- stereo 48 kHz
- movie timestamp reported by source: 00:49:47

Selected source window:
- original exact-clip start: 4.8s
- duration: 6.2s
- sequence: Barabbas reaction → Jesus close-up in the release-choice sequence

The exact clip contained encoded letterboxing.
cropdetect measured:
- active picture: 1920×800
- crop: 1920:800:0:140

Job 2 scene.mp4 is cropped to the active image before the standard Silent Narratives renderer so no internal black letterbox bands appear.

### Job 2 subtitles / motion

Custom contextual subtitles:
1. HE LATER SAID…
2. HE SAW JESUS.

These are contextual/attributed captions rather than fabricated movie dialogue.

Timings stored in scene_meta:
- HE LATER SAID…: 0.55–2.10s
- HE SAW JESUS.: 2.25–4.60s

The second phrase uses the approved dramatic payoff treatment and lands on Jesus’ close-up.

### Job 2 final QA

Final master:
- duration: 6.200s
- video duration: 6.200s
- audio duration: 6.200s
- 1080×1920 upload master
- separate lightweight review preview

Visual QA passed after:
- shortening hook so it fits fully
- removing source letterbox
- forcing a clean rerender after stale-output detection
- confirming scene fills rounded movie window

Gemini final rendered-file QA:
- scene_match: true
- av_sync: true
- estimated_offset_seconds: 0.0
- subtitle_safe: true
- verifier model: gemini-3.5-flash-lite (3.5 Flash returned 429 during this QA call)

Current status:
- Job 2 = rendered
- NOT uploaded
- NOT scheduled
- owner review required
- if owner approves while 22:00 WAT slot is still valid, call POST /api/jobs/2/schedule
- if slot becomes too close/past, reassign Job 2 to the next open publishing slot before scheduling

Review URL:
https://vps-0868c90c.vps.ovh.ca/silent-narratives/api/jobs/2/video

### Immediate next steps

1. Owner reviews Job 2.
2. If approved before slot cutoff, schedule for 22:00 WAT via YouTube publishAt.
3. Verify YouTube reports private + correct publishAt.
4. Verify work/2 transient files are deleted after scheduling confirmation.
5. Build the reusable automatic exact-scene acquisition module from the now-proven Job 1 + Job 2 acquisition patterns.
6. Fill tomorrow’s 13:00 / 16:00 / 22:00 production slots automatically.

## Checkpoint — 2026-10-02 first successful YouTube scheduled publish

Owner approved Job 2.

Scheduling result:
- Job ID: 2
- YouTube video ID: tJkrVTrRbwA
- YouTube URL: https://youtu.be/tJkrVTrRbwA
- assigned slot: 2026-10-02 at 22:00 WAT
- YouTube publishAt: 2026-10-02T21:00:00Z
- YouTube privacy immediately after scheduling: private
- DB status: scheduled
- upload_confirmed_at recorded
- youtube_publish_at recorded
- no scheduling error

Cleanup result:
- localVideosDeleted: true
- scene_file cleared
- render_file cleared
- preview_file cleared
- deleted_at recorded
- work/2 directory removed completely after YouTube confirmation

This proves the scheduled-publish path end to end:
approved render → upload as private → set publishAt → read back/verify private → persist YouTube ID/publishAt → delete transient job videos.

The Nigeria slot engine is now proven for a real scheduled upload.

Do not regress these rules:
- scheduling must use YouTube publishAt, not a VPS exact-time uploader
- video must remain private before its scheduled release
- cleanup only happens after successful YouTube confirmation
- failed schedule/upload keeps files for retry
- owner approval remains required before scheduling until a later explicit autopilot decision

Next production target:
- next open publishing slot after Job 2 is the next future configured slot among 13:00, 16:00, 22:00 WAT
- continue using duplicate screening, exact-scene verification, approved render baseline, owner preview approval, then schedule.

## Checkpoint — 2026-10-02 slot-performance learning system

Historical channel data was analyzed before changing future publishing times.

Mature-upload sample used:
- 28 public uploads published before 2026-09-01
- recent uploads were analyzed separately so very fresh videos would not distort long-term comparisons

Historical WAT findings:
- around 13:00 WAT:
  - 2 mature uploads
  - median views about 17,991
- around 15:00 WAT:
  - 5 mature uploads
  - median views about 29,059
  - mean views about 58,860
  - top historical examples included ~190K and ~70K
- around 23:00 WAT:
  - 18 mature uploads
  - median views about 13,050
  - mean views about 19,830
  - many strong 30K–49K videos but also many very low performers
- isolated 02:00 and 05:00 WAT outliers were NOT treated as reliable slot evidence because each had only one observation

Interpretation:
- content/topic/scene quality still explains far more performance variance than posting time
- the strongest repeatable historical signal is closer to 15:00 WAT than 16:00 WAT
- 13:00 WAT remains under-tested
- late evening works but is volatile
- therefore the next controlled schedule experiment is 13:00 / 15:00 / 22:00 WAT

Authoritative experimental publishing slots for FUTURE jobs:
- 13:00 WAT
- 15:00 WAT
- 22:00 WAT

Important:
- Job 2 remains scheduled at its already-approved 22:00 WAT slot
- no existing scheduled job was moved
- this changes only future slot assignment
- config/defaults.json and the server fallback both use 13:00 / 15:00 / 22:00

### Automatic performance snapshots

A new persistent table now exists:
- performance_snapshots

Each successfully scheduled video receives checkpoints relative to the scheduled public release:
- 1 hour
- 6 hours
- 24 hours
- 48 hours
- 7 days

Stored per checkpoint:
- job ID
- YouTube video ID
- checkpoint label
- target timestamp
- actual capture timestamp
- views
- likes
- comments
- privacy state
- YouTube published_at
- error, if collection fails

Collection behavior:
- collector runs once shortly after V1 starts
- collector runs every 15 minutes while the service is alive
- only due, uncaptured checkpoints are requested
- failed captures remain pending and are retried later
- manual endpoint also exists:
  POST /api/performance/collect

Data source:
- authenticated YouTube Data API readback for the owned channel/video
- current OAuth scopes already support this
- deeper YouTube Analytics metrics such as engagedViews/retention are not yet part of this collector and may require additional analytics authorization later

Job 2 was backfilled with all five checkpoints using its YouTube publish time:
- 1h: 2026-10-02T22:00:00Z
- 6h: 2026-10-03T03:00:00Z
- 24h: 2026-10-03T21:00:00Z
- 48h: 2026-10-04T21:00:00Z
- 7d: 2026-10-09T21:00:00Z

At this checkpoint none are due yet, so the collector correctly returned due=0 / captured=0.

### Dashboard

A new clean section now exists:
- Slot learning

It shows:
- 1 PM WAT
- 3 PM WAT
- 10 PM WAT
- latest captured checkpoint/views for each slot when available
- next pending checkpoint when no result has been captured yet

There is also a manual “Refresh metrics” action.

The dashboard should remain restrained; do not turn slot learning into a generic analytics-card wall.

### Experiment discipline

Do not declare a winning slot from one or two posts.

Use the automatic snapshots to compare like-for-like checkpoints:
- 1h vs 1h
- 6h vs 6h
- 24h vs 24h
- 48h vs 48h
- 7d vs 7d

Continue logging story/topic, source competitor, scene duration and slot so time-of-day is not confused with stronger/weaker content.

Target: collect at least 15–30 new-format uploads before making a strong permanent timing decision.

## Checkpoint — 2026-10-02 factual verification gate + Job 4 render

### New factual-verification workflow rule

Competitor Shorts are source leads, not automatically authoritative factual sources.

Before scene acquisition/rendering:
1. identify the exact factual claim made by the competitor Short;
2. independently corroborate the material claim with external/public evidence where possible;
3. if the material claim cannot be corroborated, mark the job rejected/review-needed before spending scene/render work;
4. use cautious attribution such as “reportedly” or “accounts of the shoot say” when evidence is secondary rather than primary;
5. do not turn a competitor’s unsupported caption into a Silent Narratives factual statement.

This rule exists because Job 3 failed this gate.

### Job 3 — rejected before scene work

Candidate:
- candidate ID: 18
- source: @YautjaVision
- video: https://www.youtube.com/shorts/DH4wWH7Mff8
- source views at discovery: about 34.3M
- initial slot: 2026-10-03 at 13:00 WAT
- claimed story: Meet Bill (2007), Jessica Alba and Logan Lerman improvised mall/donut-shop scenes

Verification:
- Gemini confirmed the competitor Short itself explicitly makes the improv claim
- independent public-source checks confirmed cast/location context but did not sufficiently corroborate that specific improv claim

Action:
- Job 3 status: rejected
- candidate 18 status: review_needed
- rejection happened before scene acquisition/rendering
- 13:00 WAT slot was freed for a stronger verified story

### Job 4 — active 13:00 WAT production job

Candidate:
- candidate ID: 19
- competitor source: https://www.youtube.com/shorts/OT91XoiF2gE
- source views at discovery: about 30.1M
- movie: Hardcore Henry (2015)
- slot: 2026-10-03 at 13:00 WAT
- scheduled_publish_at: 2026-10-03T12:00:00Z

Story:
- accidental escalator collision during the chase
- public accounts support that a performer missed her mark/cue, was knocked down during the shot, recovered, and the accidental collision remained in the film
- current copy intentionally uses cautious wording

Current hook:
In Hardcore Henry (2015), a stuntwoman reportedly missed her mark during this escalator chase and got knocked down on camera. She recovered instantly—and the accidental collision stayed in the movie.

Current title:
The Stunt Mistake They Kept in Hardcore Henry 🎬💥 #hardcorehenry #stunts #shorts

Current description:
Did you know this escalator collision in Hardcore Henry (2015) wasn't planned? Accounts of the shoot say a stunt performer missed her mark during the chase and got knocked down on camera. She recovered immediately, and the accidental collision was kept in the finished film.

### Job 4 scene acquisition

Visual verification source:
- https://9gag.com/gag/azqdP6x
- exact 12-second “unscripted escalator scene” copy
- useful for exact visual verification
- its available formats are video-only, so it was NOT used as the final audio source

Audio-bearing source:
- public copy of official Hardcore Henry trailer
- https://www.dailymotion.com/video/x3udl6e
- downloaded at 1848×1040, ~23.976 fps
- AAC stereo audio
- the exact same escalator collision was visually verified inside the trailer

Final selected source segment:
- trailer time approximately 118.4s–122.1s
- final scene duration: 3.700s
- exact escalator approach → collision → immediate aftermath
- unrelated following trailer shot excluded

Final scene audio:
- trailer music
- collision/crash effects
- shouting
- no voiceover
- no invented dialogue

Own dramatic captions:
- THAT HIT WASN’T PLANNED.
- THEY KEPT THE TAKE.

Subtitle timing:
- setup: about 0.45–1.62s
- payoff: about 1.62–3.35s

### Renderer learning: scene-aware payoff motion

Previous approved renderer still had one hidden Job-1-specific value:
- punch-in began around frame 28 regardless of the job

Fixed:
- payoff frame is now derived from the second subtitle’s actual start timestamp
- if no second timing is supplied, renderer falls back to a proportional duration-based value
- each future Short’s punch-in now follows its own editorial payoff rather than the Deep Water timing

This is now part of the approved renderer workflow.

### Job 4 finished render QA

Master:
- work/4/final.mp4
- 1080×1920
- H.264 High
- 30 fps
- BT.709 / yuv420p
- duration exactly 3.700s
- video bitrate about 12.7 Mbps
- AAC-LC stereo 48 kHz
- audio duration exactly 3.700s
- audio bitrate about 310 kbps
- master size about 6.0 MB

Review derivative:
- work/4/preview.mp4
- about 1.46 MB
- public review route is live

Finished-render Gemini QA:
- exact escalator collision visible: yes
- unrelated trailer shot visible: no
- first frame fully composed: yes
- captions seen: both intended captions
- caption timing quality: good
- payoff punch timing: good
- audio: music + collision sound
- voiceover: none
- A/V sync: good
- ending clean: yes
- issues: none

Job 4 is rendered but NOT uploaded or scheduled.
Owner approval is required before scheduling for 13:00 WAT.

## Checkpoint — 2026-10-02 manual three-video daily batches

Owner changed the operating model to prevent a backlog of scheduled Shorts.

Authoritative rule:
- production does NOT run continuously
- owner explicitly says when to start a batch
- one batch = exactly 3 videos for one publishing day
- configured daily slots remain:
  - 13:00 WAT
  - 15:00 WAT
  - 22:00 WAT
- once those three slots are filled, the system must stop
- do not spill automatically into the next day
- do not keep preparing/scheduling future days unless the owner explicitly starts another batch

Implementation:
- production_mode = manual_batch
- batch_limit = 3
- batch_active_date is blank while paused
- POST /api/batch/start activates one explicit date
- POST /api/batch/stop pauses production
- new source/job creation requires an active batch
- nextOpenPublishingSlot searches ONLY the active batch date
- it never searches forward across multiple days
- if all three slots are filled, creation stops with an error
- job creation now validates the batch/slot BEFORE inserting into the database, so an accidental click while paused cannot create orphan jobs
- dashboard displays “Paused · waiting for start” when no batch is active

Existing work at the moment this rule was adopted:
- Job 2 was already scheduled for 2026-10-02 at 22:00 WAT and remains unchanged
- Job 4 had already been scheduled for 2026-10-03 at 13:00 WAT before this workflow change; it remains unchanged
- Job 5 (I Am Legend alternate-ending story) is analyzed and its source was downloaded, but it is now PAUSED with no assigned publishing slot and is NOT uploaded/scheduled
- do not continue Job 5 or create Job 6 until the owner explicitly says to start a daily batch

Operational meaning of “start”:
- when owner says “start”, resolve the intended publishing date
- activate that one date as batch_active_date
- prepare at most 3 videos total for its 13:00 / 15:00 / 22:00 WAT slots
- apply duplicate screening, factual verification, exact-scene verification, approved renderer QA and owner approval rules
- after the three-video batch is complete, clear batch_active_date / pause again

Do not interpret analytics collection as production activity:
- performance snapshots may continue collecting automatically
- channel/history sync may continue when requested
- no new content production begins without the owner’s explicit start command
