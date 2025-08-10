// Optional runtime config. You can set WEBHOOK_URL and AUTH_HEADER here.
// This file is intentionally empty by default. Create a new config.local.js if you want to avoid git commits.
window.REDACTED_FORM_CONFIG = window.REDACTED_FORM_CONFIG || {
  WEBHOOK_URL: null, // e.g., "https://n8n.example/webhook/..."
  AUTH_HEADER: null, // e.g., { name: "Authorization", value: "Bearer {{TOKEN}}" }
  THEME: "green", // or "amber"
  HEADER_ALT: "ASCII art image of the US Captial building",
  TYPE_SPEED: 22,           // ms per character
  TYPE_VARIANCE: 12,        // random +/- jitter in ms
  TYPE_PAUSE_MS: 600,       // pause before typing begins
  ALLOW_TYPE_SKIP: true,    // allow Enter to skip typing animation
  INPUT_AT_BOTTOM: true
};

