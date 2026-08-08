#!/usr/bin/env bash
# Regenerate payloads/payload-index.json with live counts.
set -euo pipefail
cd "$(dirname "$0")/../.."
node scripts/collector/build-index.mjs
