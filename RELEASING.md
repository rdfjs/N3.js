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
`next-major` after every push to `main`. That push runs CI on `next-major`, which
publishes a new alpha whenever the merge brought in a `fix` or `feat`. It pushes with
the `DEPENDABOT_AUTOMERGE_TOKEN` PAT, because pushes made with `GITHUB_TOKEN` don't
trigger CI.

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
`sync/main-into-next-major` and stops syncing until it is resolved. Resolve it with a
merge, locally or with "Create a merge commit", never with a squash.

## Releasing the major

**When.** Merge once the breaking changes planned for the major have landed, at least
one alpha has been tried by the main downstream consumers, and the release notes
include a short migration guide. Then stop merging breaking changes for a week or two
and only fix what the alphas turn up.

**How.**

1. Open a pull request from `next-major` into `main`, titled `feat!: release N3.js vN`.
2. Merge it with **"Create a merge commit"**, not a squash. That keeps every change as
   its own commit, so the release notes list them individually, and it leaves the
   alpha tags in `main`'s history. If the repository only allows squash merges,
   allow merge commits for this one merge.
3. CI on `main` publishes `vN.0.0` to `latest`.
4. The sync then fast-forwards `next-major` to `main`, which publishes nothing.
   The branch is ready for the following major, whose first breaking change
   publishes `vN+1.0.0-alpha.1`.
