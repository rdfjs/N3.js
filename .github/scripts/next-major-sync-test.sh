#!/usr/bin/env bash
# Tests the commit check of next-major-sync.sh (same_commits) on small throwaway repositories.
# Run it with `bash .github/scripts/next-major-sync-test.sh`; it prints one line per case and
# exits non-zero if any case gives the wrong answer.
set -uo pipefail

script=$(cd "$(dirname "$0")" && pwd)/next-major-sync.sh
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cd "$work"
git init --quiet
git config user.name test
git config user.email test@example.org
git config commit.gpgSign false
eval "$(sed -n '/^commit_record()/,/^}/p;/^files_of()/,/^}/p;/^same_change()/,/^}/p;/^compare_change()/,/^}/p;/^same_commits()/,/^}/p;/^compare_commits()/,/^}/p' "$script")"

failures=0
lines() { printf '%s\n' "$@"; }
# Commits the given files (name, then content) on HEAD with the given message
commit() {
  local message=$1
  shift
  while [ $# -gt 0 ]; do
    if [ "$2" = - ]; then git rm --quiet "$1"; else printf '%s\n' "$2" > "$1" && git add "$1"; fi
    shift 2
  done
  git commit --quiet --allow-empty --cleanup=verbatim -m "$message"
}
# Recommits the commit given first on HEAD with the same author, date and message
recommit() {
  local original=$1
  shift
  GIT_AUTHOR_DATE=$(git log -1 --format=%aD "$original") commit "$(git log -1 --format=%B "$original")" "$@"
}
expect() { # <accepted|refused> <description> <command...>
  local want=$1 description=$2 got
  shift 2
  if "$@" 2> /dev/null; then got=accepted; else got=refused; fi
  if [ "$got" = "$want" ]; then echo "ok: $description ($got)"; else echo "FAIL: $description ($got)"; failures=1; fi
}

# A base with next-major's commit on it, and main moving on with an unrelated edit
commit base f "$(lines L A x x x R)" g "$(lines g1)"
base=$(git rev-parse HEAD)
commit 'feat!: move A' f "$(lines L x x x A R)"
moved=$(git rev-parse HEAD)
git checkout --quiet --detach "$base"
commit 'fix: main' f "$(lines L A x x x R y y y B x x x Z)"
main=$(git rev-parse HEAD)

git checkout --quiet --detach "$main"
git cherry-pick --quiet "$moved" > /dev/null
expect accepted 'the same change on a newer main' same_commits "$base..$moved" "$main..HEAD"

# A repeated block: the same lines removed and added, but A moved into the other block
git checkout --quiet --detach "$main"
recommit "$moved" f "$(lines L x x x R y y y B x x x A Z)"
expect refused 'the same lines moved to another place' same_commits "$base..$moved" "$main..HEAD"

# A deletion dropped where main changed the deleted file, with only another path resolved
git checkout --quiet --detach "$base"
commit 'feat!: drop f, change g' f - g "$(lines g2)"
dropped=$(git rev-parse HEAD)
git checkout --quiet --detach "$main"
recommit "$dropped" g "$(lines g2)"
expect refused 'a deletion left out outside the resolved paths' same_commits "$base..$dropped" "$main..HEAD" g

# Content from a resolved path carried into another path by a rename and back
git checkout --quiet --detach "$base"
commit 'feat!: A' f "$(lines L A x x x R a)"
commit 'feat!: B' bar "$(lines L A x x x R a)" f -
commit 'feat!: C' f "$(lines L A x x x R a)" bar -
renamed=$(git rev-parse HEAD)
git checkout --quiet --detach "$main"
recommit "$renamed~2" f EVIL
recommit "$renamed~1" bar EVIL f -
recommit "$renamed" f "$(lines L A x x x R a)" bar -
expect refused 'resolved content carried into another path' same_commits "$base..$renamed" "$main..HEAD" f

# The same history rebased honestly, with f resolved by hand
git checkout --quiet --detach "$main"
recommit "$renamed~2" f "$(lines L A x x x R y y y B x x x Z a)"
recommit "$renamed~1" bar "$(lines L A x x x R a)" f -
recommit "$renamed" f "$(lines L A x x x R a)" bar -
expect accepted 'an honest rebase with a resolved path' same_commits "$base..$renamed" "$main..HEAD" f

# An extra line, a changed message and a whitespace change are all refused
git checkout --quiet --detach "$main"
recommit "$moved" f "$(lines L x x x A R y y y B x x x Z)" g "$(lines g1 extra)"
expect refused 'an extra change' same_commits "$base..$moved" "$main..HEAD"
git checkout --quiet --detach "$main"
GIT_AUTHOR_DATE=$(git log -1 --format=%aD "$moved") commit 'feat!: move A ' f "$(lines L x x x A R y y y B x x x Z)"
expect refused 'a changed message' same_commits "$base..$moved" "$main..HEAD"
git checkout --quiet --detach "$main"
recommit "$moved" f "$(lines L x x x 'A ' R y y y B x x x Z)"
expect refused 'a whitespace change' same_commits "$base..$moved" "$main..HEAD"

# A range git cannot list is refused, even when the other one cannot be listed either
expect refused 'ranges that cannot be listed' same_commits "$base..no-such-commit" "$main..no-such-commit"

# Two identical blocks, and main changes a context line of the block next-major changed: the
# change must stay in its own block, even where its patch would also apply to the other one
git checkout --quiet --detach "$base"
commit 'chore: blocks' h "$(lines c1 c2 c3 A c4 c5 c6 c1 c2 c3 A c4 c5 c6)"
blocks=$(git rev-parse HEAD)
commit 'feat!: A to B in the first block' h "$(lines c1 c2 c3 B c4 c5 c6 c1 c2 c3 A c4 c5 c6)"
first=$(git rev-parse HEAD)
git checkout --quiet --detach "$blocks"
commit 'fix: main changes the first block' h "$(lines c1 C2 c3 A c4 c5 c6 c1 c2 c3 A c4 c5 c6)"
blocks_main=$(git rev-parse HEAD)
recommit "$first" h "$(lines c1 C2 c3 A c4 c5 c6 c1 c2 c3 B c4 c5 c6)"
expect refused 'the change applied to the other identical block' same_commits "$blocks..$first" "$blocks_main..HEAD"
git checkout --quiet --detach "$blocks_main"
recommit "$first" h "$(lines c1 C2 c3 B c4 c5 c6 c1 c2 c3 A c4 c5 c6)"
expect accepted 'the change kept in its own block' same_commits "$blocks..$first" "$blocks_main..HEAD"

# Main changes a line next to next-major's change: the rebase merges both, so the check must too
git checkout --quiet --detach "$base"
commit 'chore: letters' k "$(lines A B C D E F G H)"
letters=$(git rev-parse HEAD)
commit 'feat!: d' k "$(lines A B C d E F G H)"
lower=$(git rev-parse HEAD)
git checkout --quiet --detach "$letters"
commit 'fix: b' k "$(lines A b C D E F G H)"
git rebase --quiet HEAD "$lower" 2> /dev/null || git cherry-pick --quiet "$lower" > /dev/null
expect accepted 'a clean rebase next to a change on main' same_commits "$letters..$lower" "HEAD~1..HEAD"

exit "$failures"
