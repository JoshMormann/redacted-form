#!/usr/bin/env bash
set -euo pipefail

# netlify-build.sh
# If NETLIFY_WEBHOOK_URL is defined in Netlify env, write a config override file.
# Optionally set AUTH header and THEME via env as well.

: "${NETLIFY_WEBHOOK_URL:=}"
: "${NETLIFY_AUTH_HEADER_NAME:=}"
: "${NETLIFY_AUTH_HEADER_VALUE:=}"
: "${NETLIFY_THEME:=}"

cat > config.deploy.js <<'EOF'
window.REDACTED_FORM_CONFIG = Object.assign(window.REDACTED_FORM_CONFIG || {}, {
  // Values below will be replaced by this build script if env vars are present
});
EOF

append_js() {
  echo "$1" >> config.deploy.js
}

if [ -n "$NETLIFY_WEBHOOK_URL" ]; then
  append_js "window.REDACTED_FORM_CONFIG.WEBHOOK_URL = '${NETLIFY_WEBHOOK_URL//"/\"}';"
fi

if [ -n "$NETLIFY_AUTH_HEADER_NAME" ] && [ -n "$NETLIFY_AUTH_HEADER_VALUE" ]; then
  # Escape single quotes in value
  val_escaped=${NETLIFY_AUTH_HEADER_VALUE//"/\"}
  append_js "window.REDACTED_FORM_CONFIG.AUTH_HEADER = { name: '${NETLIFY_AUTH_HEADER_NAME}', value: '${val_escaped}' };"
fi

if [ -n "$NETLIFY_THEME" ]; then
  append_js "window.REDACTED_FORM_CONFIG.THEME = '${NETLIFY_THEME}';"
fi

# Place the generated file alongside config.js so index.html picks it up.
# We load config.js, then config.local.js (ignored), then app.js.
# We'll add a reference to config.deploy.js in index.html so deploy overrides apply.

# Insert the script tag if not already present
echo "Netlify build: config.deploy.js generated with webhook/auth/theme if provided."

