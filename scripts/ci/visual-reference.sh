#!/usr/bin/env bash
# CI (e2e job): takes the @visual screenshots on the base commit and keeps them in
# $RUNNER_TEMP/reference as the reference for the commit under test. The next step checks the
# commit under test out again, whatever happens here.
# Inputs: BASE, HEAD_SHA.
set -euo pipefail

reference="${RUNNER_TEMP:?}/reference"
rm -rf "$reference"
git checkout --force --quiet "$BASE"
# Older commits still had committed Linux baselines; the reference must be drawn, not copied.
find e2e -path '*-snapshots/*-linux.png' -delete
if ! git diff --quiet "$BASE" "$HEAD_SHA" -- package-lock.json; then
  npm ci
  npx playwright install chromium
fi

# A failing test on the base commit only costs its reference; the rest still count.
if ! npx playwright test --grep @visual --update-snapshots=all --reporter=list; then
  echo "::warning::Some @visual tests failed on the base commit; their screenshots are not compared."
fi

mkdir -p "$reference"
find e2e -path '*-snapshots/*-linux.png' -exec cp --parents {} "$reference/" \;
count=$(find "$reference" -name '*.png' | wc -l)
echo "Reference screenshots from $(git log -1 --format=%h "$BASE"): $count"
if [ "$count" -eq 0 ]; then
  echo "::warning::The base commit has no @visual tests (or none passed); nothing to compare with."
fi
