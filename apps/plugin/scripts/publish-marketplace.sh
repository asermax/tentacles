#!/usr/bin/env bash
# Force-pushes the built Claude plugin as the root of the orphan
# claude-marketplace branch, which `claude plugin marketplace add
# asermax/tentacles@claude-marketplace` reads.
#
# semantic-release runs it after the build, so build/out/claude already holds
# the plugin at the released version. The commit is made in a throwaway
# repository, so the checkout's index, branch and working tree stay as they
# were: the git plugin still has to commit VERSION and CHANGELOG.md there.
#
# The remote defaults to the repository's GitHub URL, authenticated with
# GITHUB_TOKEN; pass another remote (an absolute path to a bare repository
# works) to try the layout without pushing to GitHub.
set -euo pipefail

version="${1:?usage: publish-marketplace.sh <version> [remote]}"
remote="${2:-https://x-access-token:${GITHUB_TOKEN:-}@github.com/${GITHUB_REPOSITORY:-}.git}"

tree="$(cd "$(dirname "$0")/.." && pwd)/build/out/claude"
work="$(mktemp -d)"
trap 'rm -r "$work"' EXIT

cp -r "$tree/." "$work"

git -C "$work" init --quiet --initial-branch claude-marketplace
git -C "$work" config user.name "${GIT_AUTHOR_NAME:-github-actions[bot]}"
git -C "$work" config user.email "${GIT_AUTHOR_EMAIL:-github-actions[bot]@users.noreply.github.com}"
git -C "$work" add -A
git -C "$work" commit --quiet -m "chore(marketplace): regenerate @ $version"

git -C "$work" push --force --quiet "$remote" claude-marketplace:claude-marketplace
