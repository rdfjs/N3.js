#!/usr/bin/env bash
# Keeps next-major rebased on main, so it stays main plus one commit per breaking change.
#
#   next-major-sync.sh sync <main sha>
#     Rebases next-major onto <main sha>. A clean rebase is pushed straight away. A conflicting
#     one moves nothing: it pushes main merged into next-major, conflict markers included, as
#     sync/conflict-<main sha>-base, for a resolution pull request into that branch.
#   next-major-sync.sh apply <pull request number> <merge commit sha> <rebased sha>
#     Run by a maintainer after merging that resolution pull request. Pushes
#     sync/next-major-rebased as next-major, but only if it is next-major's commits, unchanged,
#     on <main sha>, with exactly the merged tree, and the pull request resolved the conflict
#     this script showed for the current next-major.
#
# Run from a full clone whose origin can push to next-major, with GH_TOKEN for the gh CLI.
# semantic-release finds the last alpha through the tags reachable from next-major (see
# RELEASING.md), so a rebased next-major is pushed together with its newest alpha tag and channel
# note moved to the rebased commit, and the commit that alpha was published from kept under
# refs/archive.
set -euo pipefail

repo=${GITHUB_REPOSITORY:-rdfjs/N3.js}
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git config tag.gpgSign false
git config commit.gpgSign false
git config push.gpgSign false

fail() { echo "::error::$*"; exit 1; }
is_sha() { [[ $1 =~ ^[0-9a-f]{40}$ ]]; }
remote_ref() { git ls-remote origin "$1" | awk -v ref="$1" '$2 == ref { print $1 }'; }

fetch() {
  git fetch --quiet origin '+refs/heads/main:refs/remotes/origin/main' \
    '+refs/heads/next-major:refs/remotes/origin/next-major' \
    '+refs/tags/*:refs/tags/*' '+refs/notes/*:refs/notes/*' "$@"
  old=$(git rev-parse origin/next-major)
}

# A commit's raw object without what a rebase rewrites: tree, parents, committer and signature
commit_record() {
  git cat-file commit "$1" | perl -0777 -ne '
    my ($head, $body) = /\A(.*?)\n\n(.*)\z/s ? ($1, $2) : ($_, "");
    print join("\n", grep { !/^(?:tree|parent|committer|gpgsig|gpgsig-sha256) / } split /\n(?! )/, $head), "\n\n", $body'
}

# The lines a commit adds and removes, byte for byte and in order, outside the given paths. Only
# blob ids and hunk headers (line numbers and function context) are dropped, since a rebase onto
# a newer main changes those.
changes() {
  local commit=$1
  shift
  git diff --unified=0 --no-color --no-ext-diff --no-renames "$commit^" "$commit" -- . "${@/#/:(exclude,literal)}" |
    sed -E -e '/^index [0-9a-f]+\.\.[0-9a-f]+/d' -e 's/^@@ -[0-9]+(,[0-9]+)? \+[0-9]+(,[0-9]+)? @@.*/@@/'
}

# Succeeds if two ranges hold the same number of commits and each pair, compared on its own, has
# the same author, message and other raw fields, and changes the same lines outside the paths
# given after the ranges (the hand-resolved ones)
same_commits() {
  local -a a b
  local i
  mapfile -t a < <(git rev-list --reverse "$1")
  mapfile -t b < <(git rev-list --reverse "$2")
  shift 2
  [ "${#a[@]}" -eq "${#b[@]}" ] || return 1
  for i in "${!a[@]}"; do
    cmp -s <(commit_record "${a[$i]}") <(commit_record "${b[$i]}") &&
      cmp -s <(changes "${a[$i]}" "$@") <(changes "${b[$i]}" "$@") || return 1
  done
}

# main_sha merged into next-major, conflict markers committed as they are
show_conflicts() {
  git checkout --quiet --detach "$old"
  git merge --no-edit "$main_sha" > /dev/null || true
  git add --all
  # A rebase can conflict where the merge does not; the merge commit then stands as it is
  git diff --cached --quiet || git commit --quiet --no-verify -m "chore: merge main ${main_sha:0:7} into next-major, conflicts unresolved"
}

# Pushes HEAD, next-major's own commits rebased onto main_sha, as next-major in one atomic push,
# every ref leased to the value checked here. If next-major's newest alpha was published from one
# of its own commits, that tag and its channel note move with it to the same commit's rebased
# counterpart. Never to a commit on main: semantic-release reads all channel notes on a commit as
# one, so an alpha sharing a commit with a stable tag would read as stable. The first time a tag
# moves, the commit it was published from is kept under refs/archive. In apply mode, resolved
# lists the hand-resolved paths, where a rebased commit may differ from its original.
publish() {
  local new own_base tag tag_value tag_commit anchor note_ref old_note archive i
  local -a olds news
  new=$(git rev-parse HEAD)
  own_base=$(git merge-base "$old" origin/main)
  [ "$(git rev-list --count "$main_sha..$new")" = "$(git rev-list --count "$main_sha..$new" --not origin/main)" ] ||
    fail "the rebased next-major contains commits from main past ${main_sha:0:7}."
  same_commits "$own_base..$old" "$main_sha..$new" "${resolved[@]}" ||
    fail "the rebase changed next-major's commits, probably because one is already on main; rebase it by hand."
  local args=(--atomic "--force-with-lease=refs/heads/next-major:$old") refs=("$new:refs/heads/next-major")
  tag=$(git for-each-ref --count=1 --sort=-v:refname --format='%(refname:short)' 'refs/tags/v*-alpha.*')
  if [ -n "$tag" ] && ! git merge-base --is-ancestor "$tag" "$new"; then
    tag_commit=$(git rev-parse "$tag^{commit}")
    mapfile -t olds < <(git rev-list --reverse "$own_base..$old")
    mapfile -t news < <(git rev-list --reverse "$main_sha..$new")
    anchor=
    for i in "${!olds[@]}"; do
      [ "${olds[$i]}" != "$tag_commit" ] || anchor=${news[$i]}
    done
    [ -n "$anchor" ] || fail "$tag is not on one of next-major's own commits; fix the tags by hand."
    # The tips always correspond. Another commit is only proven by the sync's own rebase, which
    # same_commits checked change for change; a hand-made history in apply mode proves only its
    # tip, whose tree is the reviewed one.
    [ "$tag_commit" = "$old" ] || [ "$mode" = sync ] ||
      fail "$tag is not on next-major's tip, so it can only move with a sync's own rebase; move the tag by hand."
    ! git merge-base --is-ancestor "$anchor" origin/main || fail "$anchor is on main, so $tag cannot move there."
    [ -z "$(git tag --points-at "$anchor" | grep -vFx "$tag" || true)" ] ||
      fail "$anchor already carries another tag, so $tag cannot move there."
    tag_value=$(git rev-parse "refs/tags/$tag")
    note_ref=refs/notes/semantic-release-$tag
    old_note=$(git rev-parse --verify --quiet "$note_ref") || fail "$tag has no channel note."
    git notes --ref "semantic-release-$tag" show "$tag_commit" | grep '"alpha"' > /dev/null ||
      fail "$tag's note is not on the alpha channel."
    git update-ref "refs/tags/$tag" "$anchor"
    git notes --ref "semantic-release-$tag" add -f -m '{"channels":["alpha"]}' "$anchor"
    args+=("--force-with-lease=refs/tags/$tag:$tag_value" "--force-with-lease=$note_ref:$old_note")
    refs+=("refs/tags/$tag" "$note_ref")
    archive=refs/archive/$tag
    if [ -z "$(remote_ref "$archive")" ]; then
      args+=("--force-with-lease=$archive:")
      refs+=("$tag_commit:$archive")
    fi
  fi
  git push "${args[@]}" origin "${refs[@]}"
}

# Paths the reviewed resolution changed; empty for a clean rebase
resolved=()

mode=${1:-}
case $mode in
sync)
  main_sha=${2:-}
  is_sha "$main_sha" || fail "Expected a full main commit sha, got '$main_sha'."
  fetch
  git merge-base --is-ancestor "$main_sha" origin/main || fail "$main_sha is not on main."
  if git merge-base --is-ancestor "$main_sha" "$old"; then
    echo "next-major already contains main."
    exit 0
  fi
  # Once the major has landed on main, next-major has nothing main lacks: start it over from main
  if git diff --quiet "$main_sha" "$old"; then
    git push --force-with-lease="refs/heads/next-major:$old" origin "$main_sha:refs/heads/next-major"
    exit 0
  fi
  if [ -n "$(git ls-remote --heads origin 'sync/conflict-*-base')" ]; then
    fail "A sync conflict is waiting for its resolution pull request; finish that first."
  fi
  git checkout --quiet --detach "$old"
  if git rebase --quiet "$main_sha"; then
    publish
    exit 0
  fi
  git rebase --abort
  # A resolution pull request into this branch contains nothing but the hand-resolved hunks
  show_conflicts
  base_branch=sync/conflict-$main_sha-base
  git push --force-with-lease="refs/heads/$base_branch:" origin "HEAD:refs/heads/$base_branch"
  fail "next-major does not rebase cleanly onto main ${main_sha:0:7}. Resolve it in a pull request into $base_branch and push the rebased next-major to sync/next-major-rebased (see RELEASING.md)."
  ;;
apply)
  pr=${2:-} merge_sha=${3:-} expected_rebased=${4:-}
  [[ $pr =~ ^[0-9]+$ ]] || fail "Expected a pull request number, got '$pr'."
  is_sha "$merge_sha" || fail "Expected the full merge commit sha, got '$merge_sha'."
  is_sha "$expected_rebased" || fail "Expected the full sha of sync/next-major-rebased, got '$expected_rebased'."
  IFS=$'\t' read -r merged same_repo base_ref head_ref pr_merge_sha < <(gh api "repos/$repo/pulls/$pr" --jq \
    '[.merged, (.head.repo.full_name == .base.repo.full_name), .base.ref, .head.ref, .merge_commit_sha] | @tsv') ||
    fail "Could not read #$pr."
  [ "$merged" = true ] && [ "$same_repo" = true ] || fail "#$pr is not a merged pull request from this repository."
  [ "$pr_merge_sha" = "$merge_sha" ] || fail "#$pr was merged as $pr_merge_sha, not $merge_sha."
  [[ $base_ref =~ ^sync/conflict-([0-9a-f]{40})-base$ ]] || fail "#$pr does not target a sync/conflict-<main sha>-base branch."
  main_sha=${BASH_REMATCH[1]}
  fetch "+refs/heads/$base_ref:refs/remotes/origin/conflict-base" \
    '+refs/heads/sync/next-major-rebased:refs/remotes/origin/rebased'
  rebased=$(git rev-parse origin/rebased)
  [ "$rebased" = "$expected_rebased" ] || fail "sync/next-major-rebased is $rebased, not the $expected_rebased given."
  [ "$(git rev-parse origin/conflict-base)" = "$merge_sha" ] || fail "$base_ref has moved past the merge of #$pr."
  git merge-base --is-ancestor "$main_sha" origin/main || fail "$main_sha is not on main."
  # The pull request was merged into exactly the conflict this script shows for the current
  # next-major and main_sha, regenerated here rather than trusted from the branch
  conflict=$(git rev-parse "$merge_sha^1")
  [ "$(git rev-list --parents -n 1 "$conflict")" = "$conflict $old $main_sha" ] ||
    fail "#$pr was not merged into the conflict for the current next-major and main ${main_sha:0:7}; run the sync again."
  show_conflicts
  [ "$(git rev-parse "HEAD^{tree}")" = "$(git rev-parse "$conflict^{tree}")" ] ||
    fail "$base_ref is not the conflict the sync shows for next-major and main ${main_sha:0:7}."
  # Only in the paths the reviewed resolution changed may a rebased commit differ from its original
  mapfile -d '' -t resolved < <(git diff -z --name-only "$conflict" "$merge_sha")
  [ "$(git merge-base "$main_sha" "$rebased")" = "$main_sha" ] && [ -z "$(git rev-list --merges "$main_sha..$rebased")" ] &&
    same_commits "$(git merge-base "$old" origin/main)..$old" "$main_sha..$rebased" "${resolved[@]}" ||
    fail "sync/next-major-rebased must be next-major's own commits rebased onto ${main_sha:0:7}: the same authors, messages and changes, except in the resolved paths."
  [ "$(git rev-parse "$rebased^{tree}")" = "$(git rev-parse "$merge_sha^{tree}")" ] ||
    fail "sync/next-major-rebased differs from what #$pr merged."
  git checkout --quiet --detach "$rebased"
  publish
  # Tidy up, each branch leased to what was checked; a branch already deleted is skipped
  args=(--atomic "--force-with-lease=refs/heads/$base_ref:$merge_sha" "--force-with-lease=refs/heads/sync/next-major-rebased:$rebased")
  refs=(":refs/heads/$base_ref" ":refs/heads/sync/next-major-rebased")
  head_sha=$(remote_ref "refs/heads/$head_ref")
  if [ "$head_ref" = "sync/conflict-$main_sha" ] && [ -n "$head_sha" ]; then
    args+=("--force-with-lease=refs/heads/$head_ref:$head_sha")
    refs+=(":refs/heads/$head_ref")
  fi
  git push "${args[@]}" origin "${refs[@]}" || echo "::warning::next-major is published, but the sync branches were not deleted."
  ;;
*)
  fail "Usage: next-major-sync.sh sync <main sha> | apply <pull request number> <merge commit sha> <rebased sha>"
  ;;
esac
