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

[`sync-next-major.yml`](.github/workflows/sync-next-major.yml) merges `main` into
`next-major` once CI on `main`, including its release, has passed. That push runs CI on
`next-major`, which publishes a new alpha whenever the merge brought in a `fix` or
`feat`. It pushes with the `NEXT_MAJOR_SYNC_TOKEN` secret, because pushes made with
`GITHUB_TOKEN` don't trigger CI. That secret is a fine-grained token for this repository
with Contents, Pull requests and Workflows write, owned by a maintainer the `next-major`
ruleset lets bypass. Without Workflows write, GitHub rejects any sync that brings in a
change to `.github/workflows`. When the token expires, the sync fails until it is renewed.

It merges rather than rebases, for two reasons:

1. semantic-release finds the last alpha through the tags reachable from the branch
   (`git tag --merged`). A rebase rewrites the commits those tags point at, so the
   next run restarts at `alpha.1`, finds that tag already exists, and fails. Every
   later alpha fails the same way until someone repairs the tags by hand.
2. A rebase force-pushes a shared branch. Every open pull request against
   `next-major` and every local checkout of it then has to be rebased as well.

The cost of merging is a merge commit per sync in `next-major`'s history. It doesn't
reach `main`'s changelog, because those commits carry no `fix` or `feat`.

When `main` conflicts with `next-major`, the workflow opens a pull request from
`sync/main-into-next-major` and stops syncing until it is resolved. Resolve it locally
with a merge, never a squash.

## Releasing the major

**When.** Merge once the breaking changes planned for the major have landed, at least
one alpha has been tried by the main downstream consumers, and the release notes
include a short migration guide. Then stop merging breaking changes for a week or two
and only fix what the alphas turn up.

**How.**

1. Merge or close every open pull request into `next-major`. Step 5 restarts the branch,
   so a pull request left open would show the whole old major in its diff. If one has to
   stay open, its author rebases it afterwards onto the new branch with
   `git rebase --onto origin/next-major <old next-major sha>`.
2. Open a pull request from `next-major` into `main`, titled `feat!: release N3.js vN`.
3. Merge it through the merge queue like any other pull request. `main` requires linear
   history, so the major lands as one squashed commit.
4. CI on `main` publishes `vN.0.0` to `latest`. Its generated notes cover only the one
   squashed commit, so edit the GitHub release to collect the changes from the alpha
   release notes, along with the migration guide.
5. Once that release has passed, the sync sees that `next-major` has nothing `main`
   lacks and resets it to `main`. Because `vN.0.0` is already tagged, this publishes
   nothing. Merging instead would count the old breaking commits again
   and publish a stray `vN+1.0.0-alpha.1`. The old alpha tags stay where they are.
   The branch is ready for the following major, whose first breaking change publishes
   `vN+1.0.0-alpha.1`.
