#!/usr/bin/env bash
# CI (e2e job): which commit the @visual screenshots are compared with. Writes `sha` (empty when
# there is none) and `head` (the commit under test) to $GITHUB_OUTPUT.
# Inputs: EVENT, PR_BASE, BEFORE, REF (from the GitHub event).
set -euo pipefail

head=$(git rev-parse HEAD)
base=''
is_commit() { [ -n "$1" ] && git cat-file -e "$1^{commit}" 2>/dev/null; }

case "$EVENT" in
  pull_request)
    is_commit "$PR_BASE" && base=$(git merge-base "$PR_BASE" "$head") ;;
  push)
    # BEFORE is all zeros for a new branch, and unknown after a force push.
    if [[ "$BEFORE" =~ ^0+$ ]] || ! is_commit "$BEFORE"; then
      if [ "$REF" != refs/heads/main ] && is_commit origin/main; then
        base=$(git merge-base origin/main "$head")
      fi
    else
      base=$BEFORE
    fi ;;
esac
# Otherwise (manual run, new branch without main, …) the parent commit.
if [ -z "$base" ] && is_commit "$head^"; then base=$(git rev-parse "$head^"); fi
if [ "$base" = "$head" ]; then base=''; fi

if [ -z "$base" ]; then
  echo "::warning::No base commit to compare screenshots with; @visual tests only write new ones."
else
  echo "Comparing screenshots with $(git log -1 --format='%h %s' "$base")"
fi
{
  echo "sha=$base"
  echo "head=$head"
} >> "${GITHUB_OUTPUT:-/dev/stdout}"
