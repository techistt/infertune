# Security

## Reporting a vulnerability

Please report security problems privately, not in a public issue. Use
**Security → Report a vulnerability** on this repository's GitHub page.

Include what you found, how to reproduce it, and which version you tested.

## What InferTune touches

- It runs on your computer and only contacts the AI servers you configure.
- Server addresses and API keys are stored unencrypted in the app's local storage.
- The optional local API server listens on `127.0.0.1` only, refuses requests
  addressed to other hostnames, and uses an access token by default.
- Release installers are not code-signed, so Windows SmartScreen may warn on first run.
