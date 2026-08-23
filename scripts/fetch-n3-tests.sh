#!/bin/sh
set -eu

checkout=.n3-tests
revision=$(awk '$1 == "n3" { print $2; exit }' spec/cache-key.txt)

if ! printf '%s\n' "$revision" | grep -Eq '^[0-9a-f]{40}$'; then
  echo "Invalid N3 test-suite revision: '$revision'" >&2
  exit 1
fi

if test -d "$checkout/.git"; then
  test "$(git -C "$checkout" rev-parse HEAD)" = "$revision" && exit 0
else
  rm -rf "$checkout"
  git init --quiet "$checkout"
  git -C "$checkout" remote add origin https://github.com/w3c-cg/N3.git
  git -C "$checkout" sparse-checkout set --no-cone tests/N3Tests
fi

git -C "$checkout" fetch --quiet --depth 1 --filter=blob:none origin "$revision"
git -C "$checkout" checkout --quiet --detach FETCH_HEAD
