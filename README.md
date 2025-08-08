# REDACTED // Asset Intake Terminal

A self-contained, static web app that collects responses through a sequential, CLI-style interface with an 80s CRT terminal aesthetic. Prompts are phrased like a terse handler addressing an asset, and the flow is fully config-driven with conditional branching.

## Features
- Authentic CRT look: scanlines, glow, ASCII header and border; green or amber theme
- Sequential prompt engine (one question at a time)
- Input types: boolean (Y/N), text, textarea, and system messages
- Conditional branching via JSON (terminate early or continue based on answers)
- Keyboard-only UX with back and help commands
- Live character-remaining counter for text/textarea
- Responsive layout for mobile and desktop
- Submission:
  - If WEBHOOK_URL is set: POSTs JSON payload
  - Otherwise: saves to localStorage as an offline fallback

## Quick start
1) Open locally (simple):
- Open index.html directly in your browser; or

2) Serve with a static server (recommended to avoid local file CORS):
- Python: `python3 -m http.server 8080`
- Node: `npx http-server -p 8080`
Then visit http://localhost:8080

## Configuration
All runtime config is in config.js (or you can create an ignored config.local.js if desired).

Example config.js:
```
window.REDACTED_FORM_CONFIG = {
  WEBHOOK_URL: null, // e.g., "https://n8n.example/webhook/..."
  AUTH_HEADER: null, // e.g., { name: "Authorization", value: "Bearer {{TOKEN}}" }
  THEME: "green" // or "amber"
};
```

- Theme: Set THEME to "amber" for amber phosphor.
- Webhook: Set WEBHOOK_URL to your endpoint. The app POSTs JSON:
```
{
  "submissionId": "uuid",
  "timestamp": "ISO-8601",
  "answers": [ { "id": "received_pkg", "value": true }, ... ],
  "meta": { "userAgent": "...", "theme": "green", "title": "Asset Intake" }
}
```
- Auth header: Provide AUTH_HEADER with `{ name, value }` to attach to the request. Never hardcode secrets into version control—use a local config not committed to git.

## Flow and copy editing
The entire interaction flow lives in questions.json. Nodes are evaluated in order, with optional conditions that gate visibility.

Supported node types:
- `boolean`: Y/N answers
- `text` | `textarea`: freeform answers with optional `maxLength` and `required`
- `system`: prints a message; if `end: true`, the session is submitted immediately

Conditional rendering:
- Add a `conditions` array with objects of shape `{ "if": { key: expectedValue, ... } }`.
- A node is shown if any of its conditions match the current `answers` map (logical OR across conditions, and logical AND across key/value pairs within a single `if`).

Example node:
```
{
  "id": "received_pkg",
  "type": "boolean",
  "prompt": "Asset, have you received the package? [Y/N]"
}
```

Example conditional end:
```
{
  "id": "final_end",
  "type": "system",
  "message": "You will be contacted should we deem necessary at a time of our choosing.\n…Session Ended.",
  "conditions": [{ "if": { "received_pkg": true, "played_game": true, "acceptable": true } }],
  "end": true
}
```

## Keyboard commands
- `back`: return to the previous prompt (clears its saved answer)
- `help`: display available commands
- For boolean prompts: `Y/N` (case-insensitive), also accepts `yes/no`

## Accessibility & UX notes
- Respects keyboard-only input
- Reduced motion can be supported if heavier CRT effects are added later
- Color contrast and font size are optimized for readability; mobile layout reduces base font-size slightly

## Development
- No build step required; vanilla HTML/CSS/JS
- Files:
  - index.html: app shell and DOM
  - style.css: CRT theme and responsive styles
  - app.js: prompt engine and submission logic
  - questions.json: flow configuration
  - config.js: runtime configuration (optional; safe defaults applied)

### Suggestions for future enhancements
- Optional keyclick/beep audio with mute toggle
- Theme toggle via keypress (e.g., `t`)
- Heavier CRT effects (curvature, bloom, vignette) gated by user preference
- Offline queue and retry when webhook is unavailable
- Export submission as a downloadable .json file when offline
- Custom ASCII logo/seal and title from config

## Deployment
This is a static site and can be served by any static host (Vercel, Netlify, GitHub Pages, S3/CloudFront, etc.). Ensure config.js points WEBHOOK_URL at your production workflow and that secrets are not committed.

## License
Copyright © 2025. All rights reserved. Update this section with the license of your choice.

