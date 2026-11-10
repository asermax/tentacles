#!/usr/bin/env bash
# Builds the Claude plugin and force-pushes it as the root of the orphan
# claude-marketplace branch, which `claude plugin marketplace add
# asermax/tentacles` reads.
#
# The commit is made from a separate index over build/out/claude, so the
# checkout's own index, branch and working tree stay as they were. The remote
# defaults to origin, which CI's checkout already authenticates with
# GITHUB_TOKEN; pass another remote (an absolute path to a bare repository
# works) to try the layout without pushing to GitHub.
set -euo pipefail

remote="${1:-origin}"
plugin="$(cd "$(dirname "$0")/.." && pwd)"
tree="$plugin/build/out/claude"

pnpm --filter @tentacles/plugin build

cd "$tree"

version="$(node -p "require('$tree/.claude-plugin/plugin.json').version")"

GIT_INDEX_FILE="$(git rev-parse --absolute-git-dir)/claude-marketplace-index"
export GIT_INDEX_FILE
trap 'rm -f "$GIT_INDEX_FILE"' EXIT
rm -f "$GIT_INDEX_FILE"

# build/out is ignored in the checkout; -f adds it anyway.
git --work-tree=. add -A -f .

export GIT_AUTHOR_NAME="${GIT_AUTHOR_NAME:-github-actions[bot]}"
export GIT_AUTHOR_EMAIL="${GIT_AUTHOR_EMAIL:-github-actions[bot]@users.noreply.github.com}"
export GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME"
export GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"

commit="$(git commit-tree "$(git write-tree)" -m "chore(marketplace): regenerate @ $version")"

git push --force "$remote" "$commit:refs/heads/claude-marketplace"
