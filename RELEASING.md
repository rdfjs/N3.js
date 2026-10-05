# Releasing

N3.js releases from CI with [semantic-release](https://semantic-release.gitbook.io/).
The version comes from the commit messages, which are the squashed pull request titles,
read with the [Conventional Commits](https://www.conventionalcommits.org/) preset.

| Branch       | Publishes                        | npm dist-tag | Install           |
| ------------ | -------------------------------- | ------------ | ----------------- |
| `main`       | stable releases (`2.1.0`)        | `latest`     | `npm i n3`        |
| `next-major` | prereleases (`3.0.0-alpha.1`)    | `alpha`      | `npm i n3@alpha`  |

## Landing changes

- **Breaking changes target `next-major`.** Mark them in the pull request title with `!`
  (`feat!: drop Node 12`) or with a `BREAKING CHANGE:` footer. The first breaking change
  on the branch sets the alpha's version to the next major; each later push publishes
  the next `alpha.N`.
- **Everything else targets `main`.** It reaches `next-major` automatically. A
  non-breaking change merged straight into `next-major` before any breaking one would
  publish a confusing `2.x.y-alpha.1`.
- A `!` title on `main` publishes a major from `main`, so breaking changes go to `next-major`.

## Keeping `next-major` current

`next-major` is always `main` with one commit per breaking change on top, so pull requests into
it are squash-merged. [`sync-next-major.yml`](.github/workflows/sync-next-major.yml) rebases it
onto `main` once CI on `main`, including its release, has passed. That push runs CI on
`next-major`, which publishes the next alpha.

It pushes with the `NEXT_MAJOR_SYNC_TOKEN` secret, because pushes made with `GITHUB_TOKEN` don't
trigger CI. That secret is a fine-grained token for this repository with Contents, Pull requests
and Workflows write, owned by a maintainer the `next-major` ruleset lets force-push. Keep it as a
secret of the `next-major-sync` environment, with that environment's deployment branches limited to
`main`, so no workflow on another branch can read it. Without Workflows write, GitHub rejects any
sync that brings in a change to `.github/workflows`. When the token expires, the sync fails until
it is renewed.

The sync shares CI's release concurrency group for `next-major`, so no alpha is tagged on
`next-major` while it is being rebased. GitHub keeps only one pending job per group, so a sync or
release that was waiting can be cancelled by a newer one. Re-run a cancelled sync from the Actions
tab; a cancelled release is published by the next push to `next-major`, or by re-running it.

**Alpha tags.** semantic-release finds the last alpha through the tags reachable from the branch
(`git tag --merged`), and a rebase rewrites the commit the newest alpha tag points at. So the
rebased `next-major` is pushed in one atomic push, every ref leased to the value the sync checked,
that also moves that tag and its `refs/notes/semantic-release-<tag>` channel note to the same
commit's rebased counterpart. The first time a tag moves, the commit it was published from is kept
under `refs/archive/<tag>`, so the published source stays in the repository.

The tag never moves onto a commit on `main` or one that carries another tag: semantic-release
reads all the channel notes on a commit as one, so the alpha would read as a stable release.

What this means for releases:
- A sync on its own publishes no alpha. `main`'s changes sit below the moved tag, so they reach
  `@alpha` with the next release from `next-major` and are not listed in its notes.
- A clean sync moves the tag to its commit's counterpart in the sync's own rebase, checked commit
  for commit. After a conflict, only the tip of the hand-made history is proven, by its reviewed
  tree, so applying a resolution moves the tag only if it was on `next-major`'s tip. Otherwise
  it stops before anything moves; move the tag by hand, as in the first rebase.

**Open pull requests into `next-major`.** A rebase leaves them based on the old `next-major`.
Their branches are rebased by hand: `git rebase --onto origin/next-major <old next-major sha>`.

**Conflicts.** A conflicting rebase moves nothing. Every conflict resolution is reviewed by a
maintainer before it reaches `next-major`:

1. The sync pushes `main` merged into `next-major`, with the conflict markers committed, as
   `sync/conflict-<main sha>-base`, and fails.
2. Whoever resolves it:
   - commits only the resolution on a branch `sync/conflict-<main sha>`;
   - opens a pull request from it into `sync/conflict-<main sha>-base`, whose diff is exactly
     the hand-resolved hunks;
   - runs the same rebase locally (`git rebase <main sha>` on `next-major`), resolving it to the
     same code;
   - pushes the result to `sync/next-major-rebased`.
3. A maintainer reviews that pull request and merges it. It never auto-merges.
4. The maintainer then runs
   [`apply-next-major-resolution.yml`](.github/workflows/apply-next-major-resolution.yml) from
   `main`, with the pull request's number, its merge commit sha and the sha of
   `sync/next-major-rebased` they reviewed. Only an admin or maintainer can start or re-run it,
   and that run is the approval: whoever merged the pull request, nothing reaches `next-major`
   until a maintainer applies it.
   It pushes `sync/next-major-rebased` as `next-major`, but only if all of these hold:
   - the pull request was merged as that sha into the conflict the sync shows for the current
     `next-major` and `<main sha>`, which the workflow regenerates and compares, and `<main sha>`
     is on `main`;
   - the rebased branch has `next-major`'s commits, in order and with the same authors and full
     messages, on `<main sha>`;
   - it has exactly the merged pull request's tree.

   It then deletes the three `sync/` branches.

A resolution is part of the rebased commit, so the same conflict does not come back.

## Releasing the major

**When.** Merge once the breaking changes planned for the major have landed, at least
one alpha has been tried by the main downstream consumers, and the release notes
include a short migration guide. Then stop merging breaking changes for a week or two
and only fix what the alphas turn up.

**How.**

1. Merge or close every open pull request into `next-major`.
2. Land `next-major` on `main` as it is: as a fast-forward, or as a rebase merge, not a squash.
   It is already `main` plus its breaking commits, so `main` keeps one commit per breaking
   change.
3. CI on `main` publishes `vN.0.0` to `latest`, with one changelog entry per breaking change.
   Add the migration guide to the GitHub release.
4. `next-major` is now the same as `main`, so it is ready for the following major. If the major
   was squashed after all, the sync sees that `next-major` has nothing `main` lacks and resets it
   to `main`.

## Issues and announcements

- **Closing.** An issue closes as soon as a pull request with a closing keyword
  (`Closes #123`) lands on `main` or `next-major`. GitHub handles `main`;
  [`close-next-major-issues.yml`](.github/workflows/close-next-major-issues.yml) handles
  new changes on `next-major`, and skips force pushes such as the sync, which only
  replay changes that already landed.
- **Announcing.** semantic-release comments once on each issue and pull request, from the
  stable release that ships it, and labels it `released`. Alphas never comment, so a change
  made on `next-major` is announced by the major. Later releases skip anything that already
  carries a `released` or `released on @alpha` label, such as a squashed stacked pull
  request repeating its parent's `Closes #123`.
