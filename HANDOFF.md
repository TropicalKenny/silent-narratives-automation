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
- 30 fps
- background loop/trim matches scene duration
- background audio is never mapped
- scene audio only
- subtle scene zoom
- ASS subtitle support

IMPORTANT: current white visual card is rejected.

Measured geometry from owner’s correct reference, normalized to 1080×1920:
- outer card: about x 11, y 192, w 1056, h 1163
- embedded movie window begins around y 720
- embedded movie window is approximately full inner-card width and about 626 px high
- card fill is dark charcoal
- card has light/white outline and rounded corners
- hook is centered white text
- avatar comes from assets/channel-avatar.jpg

Next renderer fix must use these measurements and a rounded movie-window mask.

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
  - duration about 4.2667s
  - H.264 video
  - AAC stereo 44.1 kHz
  - source scene duration about 4.2535s
  - background remains silent and loop/trimmed to scene duration
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
