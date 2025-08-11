// netlify-build.cjs - Node build script to generate config.deploy.js from env vars
const fs = require('fs');

const WEBHOOK = process.env.NETLIFY_WEBHOOK_URL || '';
const AUTH_NAME = process.env.NETLIFY_AUTH_HEADER_NAME || '';
const AUTH_VALUE = process.env.NETLIFY_AUTH_HEADER_VALUE || '';
const THEME = process.env.NETLIFY_THEME || '';

let out = `window.REDACTED_FORM_CONFIG = Object.assign(window.REDACTED_FORM_CONFIG || {}, {});\n`;
if (WEBHOOK) {
  out += `window.REDACTED_FORM_CONFIG.WEBHOOK_URL = ${JSON.stringify(WEBHOOK)};\n`;
}
if (AUTH_NAME && AUTH_VALUE) {
  out += `window.REDACTED_FORM_CONFIG.AUTH_HEADER = { name: ${JSON.stringify(AUTH_NAME)}, value: ${JSON.stringify(AUTH_VALUE)} };\n`;
}
if (THEME) {
  out += `window.REDACTED_FORM_CONFIG.THEME = ${JSON.stringify(THEME)};\n`;
}

fs.writeFileSync('config.deploy.js', out);
console.log('Netlify build: wrote config.deploy.js');

