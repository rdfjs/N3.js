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
and Workflows write, owned by a maintainer the `next-major` ruleset lets force-push. Without
Workflows write, GitHub rejects any sync that brings in a change to `.github/workflows`. When the
token expires, the sync fails until it is renewed.

**Alpha tags.** semantic-release finds the last alpha through the tags reachable from the branch
(`git tag --merged`), and a rebase rewrites the commit the newest alpha tag points at. So before
pushing a rebased `next-major`, the sync:

1. keeps that commit under `refs/archive/<tag>`, so the published source stays in the repository;
2. moves the tag and its `refs/notes/semantic-release-<tag>` channel note to the `main` commit
   the branch now starts from.

Each alpha's release notes therefore list every breaking change in the major so far.

**Open pull requests into `next-major`.** After a rebase, the sync rebases each open pull request
from this repository that was up to date with the old `next-major`. It comments on any that no
longer rebase cleanly. Their authors run `git rebase --onto origin/next-major <old next-major sha>`.

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
   [`apply-next-major-resolution.yml`](.github/workflows/apply-next-major-resolution.yml) then
   pushes `sync/next-major-rebased` as `next-major`, but only if all of these hold:
   - it has `next-major`'s commits, in order and with the same titles, on `<main sha>`;
   - it has exactly the merged pull request's tree;
   - `next-major` hasn't moved since.

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
