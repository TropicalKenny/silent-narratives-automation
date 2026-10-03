# Silent Narratives Automation — version 0.3.0

Current checkpoint: 3 October 2026. This section takes precedence over the older operating notes below.

- Cloudflare is unchanged by owner request. Password sign-in remains disabled. Production remains paused; no videos were produced or uploaded by this improvement release.
- Future generated hooks target 8–14 words. Hooks above 14 words cannot render, approve or upload. The review dialog shows approximate reading time; this is guidance, not measured retention. Existing published packages are unchanged.
- New factual confirmations require a source type, an independent URL and corroborating notes. The competitor video's own URL cannot verify its claim. Exact-scene confirmation requires a visible payoff. Human review still establishes truth and audio suitability.
- Audience response includes engaged views, average view duration/percentage and per-video retention curves. Publishing tests keep equal-age checkpoints and compare compact hooks with earlier packages. No result is treated as proof of a causal winner.
- YouTube Analytics is disabled in the current Google project. Use **Enable Analytics API**, then **Connect read-only analytics** and **Refresh analytics**. Existing upload tokens remain saved until a valid same-channel consent completes. Reports cover completed YouTube reporting days with processing lag; they are separate from exact-age Data API checkpoints. Feed exposure/swipe metrics remain in YouTube Studio.
- Backups now contain a consistent database, credentials, current source, fixed gameplay/avatar assets and referenced unfinished media. Unassigned raw downloads are omitted. File hashes accompany the bundle. External bundles use OpenSSL CMS AES-256-GCM and an RSA recipient certificate.
- Only the public recipient certificate is on the VPS at `data/backup-recipient.pem`. Keep the separate private recovery key offline; do not upload it beside the encrypted backup. The VPS cannot decrypt external snapshots.
- The daily backup timer is unchanged. Local snapshots retain seven copies. Automatic private Drive delivery is implemented and requires **Connect automatic Drive backups** to grant `drive.file` access on the existing Google OAuth client; enable the Drive API in that Google project if it is disabled. The uploader checks owner-only permissions and size. Remote copies are append-only; remote retention is not pruned automatically.
- **Back up now** starts a serialized asynchronous backup and displays external-delivery status. Local backup success and external-delivery failure are reported separately.

Verify or extract an encrypted bundle with a downloaded copy of the helper:

```bash
python3 ops/restore-backup.py recovery.tar.gz.cms --key /secure/path/recovery-key.pem
python3 ops/restore-backup.py recovery.tar.gz.cms --key /secure/path/recovery-key.pem --destination /new/empty/recovery-directory
```

The helper authenticates/decrypts, checks every manifest hash, rejects unsafe members and refuses to overwrite a nonempty directory. Stop the app and backup/tunnel services before a deliberate live restoration. Preserve current data, remove stale WAL/SHM only while stopped, restore permissions and matching code/assets, then verify local and public health. Production restoration is an operator action; it was not performed during this release.

`npm test` runs the JS workflow/media tests and Python encryption/recovery/Drive checks. No new runtime Node dependencies were added. Current release evidence is at `/home/ubuntu/workspace/silent-narratives-improvements-20261003/evidence/`.

---

## Earlier deployment notes

# Silent Narratives Automation

Self-hosted production desk for Silent Narratives. The current workflow preserves the approved video format and uses explicitly started one-video daily batches.

## Live deployment

- Bookmark: https://vps-0868c90c.vps.ovh.ca/silent-narratives/
- Hosted at `/home/ubuntu/workspace/silent-narratives-automation` on the existing VPS.
- App: `silent-narratives-v1.service`, listening only on `127.0.0.1:8400`.
- Cloudflare: `silent-narratives-cloudflare.service`. Its Quick Tunnel URL is stored in `app_settings.public_base_url`; the original VPS address redirects there. The generated hostname changes after a tunnel restart. A permanent named tunnel/custom domain is not configured.
- Password sign-in is disabled by owner request. The dashboard is public, including its operating controls. CSRF protection does not provide access control.
- YouTube OAuth retains the original registered callback: `https://vps-0868c90c.vps.ovh.ca/silent-narratives/oauth/youtube/callback`. `oauth_callback_base_url` is independent of the changing Cloudflare hostname.

## Production workflow

1. Choose a day with the 22:00 WAT slot still in the future and explicitly start its one-video batch.
2. Scan sources and select a story screened against channel history and pending work. New work receives a slot only in the active day.
3. Analyze and review the four-part package: hook/commentary, title, description and tags. Record an independent factual source link with notes and confirm the claim.
4. Upload the matching scene, record its timestamp and visible action, and confirm scene/audio content.
5. Render and watch the complete preview. The approved charcoal-card layout, avatar, rounded clip, silent gameplay and scene-only audio remain authoritative.
6. Confirm review and choose **Approve & schedule**. The app verifies the current render/package, uploads privately with the exact future publishing time, and reads the video status back before cleanup.

After the confirmed upload the batch pauses. It never starts the next day automatically. Pausing preparation does not cancel schedules already registered on YouTube. Failed jobs keep their slot; rejecting an unuploaded job releases it. Paused, rejected or unslotted jobs cannot proceed through production.

## Uploads, recovery and storage

- Chunked scene/gameplay transfers use 8 MiB requests, offset validation and progress. Limit: 600 MiB; interrupted browser transfers expire after 30 minutes and must be selected again after an app restart.
- Long UI actions return task IDs to avoid proxy timeouts. If the app restarts, inspect the durable job state before retrying.
- The resumable YouTube session is saved before media transmission, and a returned video ID is saved before readback. An existing upload/session cannot silently create a second video.
- An exact privacy/schedule mismatch or readback failure retains the video ID and media for recovery. Use **Verify existing upload** when an ID exists; a transfer without an ID resumes through its original action. Expired/ambiguous sessions require operator reconciliation.
- Transient job videos are deleted only after confirmed upload state, privacy and schedule. Metadata/history remain. Fixed brand/gameplay assets are preserved.
- Relevant edits invalidate render/approval fingerprints. Approve the current package and file after rendering again.

## Integrations and security

Settings configure Gemini, the YouTube Data API, the Google OAuth client and the gameplay background. Secret values are never included in dashboard state. `data/secrets.json` is written atomically with mode 0600 under a private data directory. Do not put credentials in Git or logs.

Mutation requests require the dashboard's signed CSRF context and matching origin. OAuth uses signed, expiring state bound to a cookie and validates the intended YouTube channel before retaining tokens. Scripts are external under a strict CSP. The app's public URL is controlled by deployment rather than an open settings form.

## Services and backups

Operational definitions live in `ops/`. The app has a systemd drop-in at `/etc/systemd/system/silent-narratives-v1.service.d/20-audit-hardening.conf`: two CPU cores, 1.5 GiB soft memory, 2 GiB maximum memory, private creation mask and filesystem restrictions.

`silent-narratives-backup.timer` runs at 03:30 UTC with up to five minutes of jitter. Its service performs a consistent SQLite backup, copies credentials privately, verifies a separate restored database copy, and retains the latest seven snapshots under `backups/`. Backups share the VPS disk; encrypted off-VPS copies are still needed for host failure. Fixed video/brand assets are not included in this database/credential backup.

Useful checks:

```bash
systemctl status silent-narratives-v1.service silent-narratives-cloudflare.service
systemctl list-timers silent-narratives-backup.timer
systemctl show silent-narratives-backup.service -p Result -p ExecMainStatus
curl --fail http://127.0.0.1:8400/health
sudo systemctl start silent-narratives-backup.service
```

To restore, first stop both the app and tunnel, preserve current data, and select a verified snapshot. Restore the database and credentials with mode 0600 under a directory with mode 0700; remove stale SQLite WAL/SHM files only while the app is stopped. Validate `PRAGMA quick_check` on the restored database, then start the app and tunnel and verify the local and Cloudflare health routes. Restore matching code/assets separately when needed. Never restore fixture data to production.

The private pre-deployment code/database/credential rollback snapshot is at `/home/ubuntu/workspace/silent-narratives-audit-20261003/rollback-20261003T165740Z`.

## Verification and handoff

Node 26 and FFmpeg are installed on this VPS. No runtime dependencies were added for this release. From the project directory:

```bash
npm test
```

Tests use temporary directories and mocked upload/model APIs; the media suite invokes real FFmpeg. The isolated browser fixture in `ops/ui-fixture.mjs` refuses to run outside a directory named `stage`. `ops/browser-verify.mjs` uses the existing VPS Playwright installation with `SN_PLAYWRIGHT_PACKAGE` pointing to its `package.json`; it renders fixture media but never clicks scheduling.

See `HANDOFF.md` for the authoritative current state and `docs/AUDIT-2026-10-03.md` for completed fixes, verification limits and next improvements. Audit evidence is private at `/home/ubuntu/workspace/silent-narratives-audit-20261003/evidence/`.
