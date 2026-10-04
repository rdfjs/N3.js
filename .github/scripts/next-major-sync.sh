#!/usr/bin/env bash
# Keeps next-major rebased on main, so it stays main plus one commit per breaking change.
#
#   next-major-sync.sh sync <main sha>
#     Rebases next-major onto <main sha>. A clean rebase is pushed straight away. A conflicting
#     one moves nothing: it pushes main merged into next-major, conflict markers included, as
#     sync/conflict-<main sha>-base, for a resolution pull request into that branch.
#   next-major-sync.sh apply <main sha> <approved sha>
#     After a maintainer merges that pull request, pushes sync/next-major-rebased as next-major,
#     but only if it has exactly the approved tree and the same commits on top of <main sha>.
#
# Run from a full clone whose origin can push to next-major, with GH_TOKEN for the gh CLI.
# semantic-release finds the last alpha through the tags reachable from next-major (see
# RELEASING.md), so before a rebased next-major is pushed, the newest alpha tag and its
# channel note move to main, and the commit it was published from is kept under refs/archive.
set -euo pipefail

mode=$1 main_sha=$2
if ! [[ $main_sha =~ ^[0-9a-f]{40}$ ]]; then
  echo "::error::Expected a full main commit sha, got '$main_sha'."
  exit 1
fi
repo=${GITHUB_REPOSITORY:-rdfjs/N3.js}
conflict_branch=sync/conflict-$main_sha

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git fetch --quiet origin '+refs/heads/main:refs/remotes/origin/main' \
  '+refs/heads/next-major:refs/remotes/origin/next-major' \
  '+refs/tags/*:refs/tags/*' '+refs/notes/*:refs/notes/*'
old=$(git rev-parse origin/next-major)

# The commits next-major has on top of main, as subjects, oldest first
own_subjects() { git log --reverse --format=%s "$(git merge-base "$1" origin/main)..$1"; }

# Moves the newest alpha tag off the old next-major, then pushes HEAD as next-major
publish() {
  local tag base
  tag=$(git tag -l 'v*-alpha.*' --sort=-v:refname | head -n 1)
  base=$(git merge-base origin/main HEAD)
  if [ -n "$tag" ] && ! git merge-base --is-ancestor "$tag" HEAD; then
    if ! git merge-base --is-ancestor "$tag" "$old"; then
      echo "::error::$tag is on neither the old nor the new next-major; fix the tags by hand."
      exit 1
    fi
    git push origin "$(git rev-parse "$tag^{commit}"):refs/archive/$tag"
    git tag -f "$tag" "$base"
    git notes --ref "semantic-release-$tag" add -f -m '{"channels":["alpha"]}' "$base"
    git push --force origin "refs/tags/$tag" "refs/notes/semantic-release-$tag"
  fi
  git push --force-with-lease="refs/heads/next-major:$old" origin HEAD:refs/heads/next-major
  rebase_pull_requests "$(git rev-parse HEAD)"
}

# Rebases open pull requests into next-major that were up to date with the old next-major
rebase_pull_requests() {
  local new=$1 number branch head
  gh pr list --repo "$repo" --base next-major --state open \
    --json number,headRefName,headRefOid,isCrossRepository \
    --jq '.[] | select(.isCrossRepository | not) | "\(.number) \(.headRefName) \(.headRefOid)"' |
  while read -r number branch head; do
    git fetch --quiet origin "$head"
    if ! git merge-base --is-ancestor "$old" "$head"; then
      echo "::warning::#$number is not based on the latest next-major, so it was not rebased."
    elif git checkout --quiet --detach "$head" && git rebase --quiet --onto "$new" "$old"; then
      git push --force-with-lease="refs/heads/$branch:$head" origin "HEAD:refs/heads/$branch"
    else
      git rebase --abort
      gh pr comment "$number" --repo "$repo" --body \
        "next-major was rebased onto main, and this branch no longer rebases cleanly onto it. Rebase it onto next-major: \`git rebase --onto origin/next-major $old\`."
    fi
  done
}

case $mode in
sync)
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
    echo "::error::A sync conflict is waiting for its resolution pull request; merge that first."
    exit 1
  fi
  git checkout --quiet --detach "$old"
  if git rebase --quiet "$main_sha"; then
    publish
    exit 0
  fi
  git rebase --abort
  # Show the conflicts as main merged into next-major, markers and all, so that a resolution
  # pull request into this branch contains nothing but the hand-resolved hunks
  git checkout --quiet --detach "$old"
  git merge --no-edit "$main_sha" > /dev/null || true
  git add --all
  git commit --quiet --no-verify -m "chore: merge main ${main_sha:0:7} into next-major, conflicts unresolved"
  git push origin "HEAD:refs/heads/$conflict_branch-base"
  echo "::error::next-major does not rebase cleanly onto main ${main_sha:0:7}. Resolve it in a pull request into $conflict_branch-base and push the rebased next-major to sync/next-major-rebased (see RELEASING.md)."
  exit 1
  ;;
apply)
  approved=$3
  git fetch --quiet origin '+refs/heads/sync/next-major-rebased:refs/remotes/origin/sync/next-major-rebased'
  rebased=$(git rev-parse origin/sync/next-major-rebased)
  # The approved resolution builds on the conflict shown for this next-major and main;
  # if next-major has moved since, start again
  if ! git rev-list --parents --merges "$approved" | grep -q " $old $main_sha\$"; then
    echo "::error::next-major has moved since the conflict was shown; run the sync again."
    exit 1
  fi
  if [ "$(git merge-base "$main_sha" "$rebased")" != "$main_sha" ] ||
     [ -n "$(git rev-list --merges "$main_sha..$rebased")" ] ||
     [ "$(git log --reverse --format=%s "$main_sha..$rebased")" != "$(own_subjects "$old")" ]; then
    echo "::error::sync/next-major-rebased must be next-major's own commits, unchanged in order and title, rebased onto ${main_sha:0:7}."
    exit 1
  fi
  if [ "$(git rev-parse "$rebased^{tree}")" != "$(git rev-parse "$approved^{tree}")" ]; then
    echo "::error::sync/next-major-rebased differs from the approved resolution."
    exit 1
  fi
  git checkout --quiet --detach "$rebased"
  publish
  git push origin --delete "$conflict_branch-base" "$conflict_branch" sync/next-major-rebased || true
  ;;
esac
