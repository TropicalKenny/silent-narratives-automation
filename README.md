# Silent Narratives Automation V1

Self-hosted workflow for Silent Narratives:
competitor discovery -> Gemini analysis -> scene upload/processing -> Silent Narratives render -> approval -> YouTube upload -> immediate cleanup after upload confirmation.

## Safety and storage
- Source, intermediate, and final rendered videos are transient.
- Fixed brand/background assets are preserved.
- If YouTube returns a successful upload response with a video ID, transient video files for that job are deleted immediately.
- Failed uploads keep their files for retry.
- V1 defaults YouTube uploads to private until explicitly changed.

## Integrations
Configure from Settings:
- YouTube Data API key for competitor discovery
- Gemini API key
- Google OAuth client ID/secret for authenticated YouTube uploads

No secrets are committed to Git.
