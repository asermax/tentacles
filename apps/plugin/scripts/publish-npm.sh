#!/usr/bin/env bash
# Builds the pi package and publishes it to npm when its version is not on the
# registry yet, so a release is a version bump in package.json.
#
# npm authenticates with GitHub's OIDC token when a trusted publisher is set up
# for the package and falls back to NODE_AUTH_TOKEN otherwise.
set -euo pipefail

plugin="$(cd "$(dirname "$0")/.." && pwd)"
tree="$plugin/build/out/pi"

pnpm --filter @tentacles/plugin build

cd "$tree"

name="$(node -p "require('./package.json').name")"
version="$(node -p "require('./package.json').version")"

# npm view exits 0 when the version exists and fails with E404 both when the
# version is missing and when the package has never been published.
if output="$(npm view "$name@$version" version 2>&1)"; then
  echo "$name@$version is already on npm; nothing to publish."
  exit 0
fi

if ! grep -q E404 <<<"$output"; then
  echo "$output" >&2
  exit 1
fi

npm publish --provenance --access public
