# Silent Narratives improvements completed

Version 0.3.0 is deployed on the existing VPS. The dashboard is healthy, production remains paused, password sign-in remains disabled, and all five existing job IDs, YouTube IDs and publishing slots were preserved. No new production videos were generated, uploaded, scheduled or published. Cloudflare's hostname, configuration and running service were left unchanged as requested.

[Open the dashboard](https://vps-0868c90c.vps.ovh.ca/silent-narratives/).

| Improvement | Result |
| --- | --- |
| Shorter hooks | Future generated packages target one accurate on-screen sentence of 8–14 words. Hooks over 14 words cannot render, approve or upload. Film/year/context move to the description when needed. Review shows word count, approximate reading time and a warning when the clip may be too brief. Existing published packages and the paused Job 5 were not rewritten. |
| Factual sourcing | Factual confirmation requires a source type, an independent URL and notes explaining what the source supports. Alternate links to the competitor's own video cannot serve as independent evidence. Personal testimony must be attributed. These controls record human verification; they do not establish truth automatically. |
| Clear scene payoff | Exact-scene confirmation records a visible payoff as well as the film/timecode/action. Relevant edits invalidate confirmation or approval. The established charcoal card, avatar, rounded movie window, silent gameplay and scene-only audio stay intact. |
| Better measurements | Added engaged views, average view duration/percentage and selectable retention curves from YouTube Analytics. Missing metrics stay unknown and replay percentages above 100% are supported. Equal-age checkpoint comparisons now distinguish compact hooks from earlier packages, preserving exclusions for private/late captures and displaying sample counts. |
| Encrypted recovery | Daily backups now build an authenticated encrypted application recovery bundle containing database, credentials, current code, fixed gameplay/avatar assets and referenced unfinished media, with a SHA256 manifest. Only the public RSA recipient certificate is on the VPS. The private recovery key was generated separately and is included in your offline recovery kit. |
| Off-VPS copy | Saved the actual encrypted production snapshot to an owner-only Google Drive folder, downloaded it again, matched its SHA256, authenticated/decrypted it and verified all 45 file hashes. No private recovery key or plaintext credentials were uploaded to Drive. |
| Backup controls | Added **Back up now**, external-delivery status and **Connect automatic Drive backups**. Automatic delivery is implemented with resumable transfers, private-folder checks and completed-upload size verification; it still needs the one-time Google permission described below. |

**Validation**

The full isolated suite passed 36 JavaScript checks and five Python checks. This includes actual FFmpeg output/audio routing, interrupted YouTube transfer recovery, stale approval rejection, paused/rejected work, duplicate screening, dense-hook rejection, independent-source checks, Analytics parsing/access failures, backup decryption/tamper rejection and Drive resumption/privacy.

The mobile browser flow started its fixture batch through the UI, verified facts/scene, transferred media, rendered the real preview, checked approval gating and reading-load guidance, displayed a retention curve and saved settings. It had no page errors or horizontal overflow at 390×844. Scheduling was never clicked. Live desktop and mobile checks also had no page errors, inline handlers or horizontal overflow. Homepage, health and session passed through the existing Cloudflare connection. Password-required status remains false.

The actual encrypted snapshot was created at **2026-10-03 18:56:33 UTC**. Size: **1,240,215 bytes**. SHA256: `76547712b7e1e2052a0b94bdbcfc4a2c60218ca81371137e6a08761492c0f767`. Google Drive readback confirmed owner-only permissions and the full file size; the downloaded bytes matched the hash and decrypted successfully with the separate key. A database restore check passed on the VPS before encryption. A complete temporary extraction also passed SQLite integrity, all five job records, fixed assets, the recipient certificate’s runtime path and private file permissions; the temporary plaintext copy was removed. This verifies application data/source/assets recovery, not restoration of an entire operating system or a full VPS reboot.

**One-time Google setup still needed**

1. **Analytics:** Google returned HTTP 403 `accessNotConfigured`; YouTube Analytics is disabled in the existing OAuth project. Use [Enable Analytics API](https://console.developers.google.com/apis/api/youtubeanalytics.googleapis.com/overview?project=399805383895), then choose **Connect read-only analytics** in the dashboard and **Refresh analytics**. Existing upload access stays saved until a valid same-channel consent completes. The VPS has no Google Cloud CLI/admin configuration to activate this API directly.
2. **Daily external delivery:** The initial encrypted Drive snapshot is verified. To authorize future automatic deliveries, choose **Connect automatic Drive backups**, grant its `drive.file` permission and enable the [Drive API](https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=399805383895) in that OAuth project if needed. This grant uses the existing registered callback. The connected Drive plugin enabled this session's off-VPS copy; its access is separate from the VPS's unattended OAuth credentials.
3. **Recovery key:** Download the separate recovery kit and keep it offline or in protected storage separate from Drive. Losing this key makes encrypted snapshots unrecoverable. The VPS deliberately has no private copy.

**Your recovery copy**

- [Verified encrypted snapshot in Google Drive](https://drive.google.com/file/d/1W98y1lv_py9a18YdpKDcxjCbTdK3MluB/view?usp=drivesdk)
- [Private backup folder](https://drive.google.com/drive/folders/1tzSJPyl6mBQBrHfiExI4p5X7MNZ86FD3)
- Local artifacts: `recovery/silent-narratives-20261003.tar.gz.cms` and `silent-narratives-recovery-kit.zip`.

The helper in the kit verifies/decrypts without extraction by default. To extract, use `--destination` with a new empty directory; it refuses to overwrite live files. Restore the required Node/FFmpeg/runtime environment separately and stop services before a deliberate live database restoration. The complete operating instructions are in the updated VPS README and handoff.

Daily backups remain scheduled at 03:30 UTC plus up to five minutes of jitter. Seven local snapshots are retained. Drive copies are append-only, with no automatic remote pruning. Unassigned raw downloads are excluded from the bundle; referenced unfinished scene/render/preview files are included. No live Google Analytics data or unattended Drive consent was available during testing; those integration paths were tested with mocks and clearly labeled in the live UI. Shorts feed exposure and viewed-versus-swiped-away still require YouTube Studio.

The next production batch should use one verified surprise, an immediate readable scene and the existing visual format. Compare new compact hooks at the same 24-hour/48-hour checkpoint as other videos; use actual retention and engaged views once Google reporting is connected. Reading-time guidance is an editorial hypothesis, not evidence of a performance uplift.
