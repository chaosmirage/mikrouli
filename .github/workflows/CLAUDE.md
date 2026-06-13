# workflows

GitHub Actions workflow definitions for CI and deployment. Three pipelines run
on this repository: application CI (test, lint, build), manifest validation
(schema + OPA policy), and production deployment to the k3s cluster on Hetzner.

## Commands

```sh
gh workflow list                              # list all workflows and their status
gh run list --workflow ci.yml                # recent CI runs
gh run view <run-id> --log                   # stream logs for a specific run
gh workflow run deploy.yml                   # trigger deploy manually (requires auth)
```

## Architecture

Four workflow files serve distinct roles:

- `ci.yml` -- runs on every pull request to `main`. Two parallel jobs: `test`
  (pnpm install, TypeSpec recompile, spec/type drift check, lint, test, build for
  both `api` and `web`) and `manifests` (render `k8s/observability` with
  `kubectl kustomize`, validate schemas with kubeconform, run OPA unit tests with
  `conftest verify`, gate rendered manifests with `conftest test`). Both jobs must
  pass before merge.
- `deploy.yml` -- runs on push to `main`. Applies the k8s manifests to the
  production cluster in dependency order: cluster-scoped resources, then namespace
  workloads, then the observability stack (`kubectl apply -k k8s/observability`).
  Images are tagged with `GITSHA-PLACEHOLDER` (replaced at deploy time with the
  current git SHA).
- `build-and-deploy.yml` -- builds and pushes Docker images, then triggers the
  deploy job; images are pinned to the git SHA, never to `latest`.
- `storybook-pages.yml` -- builds the static Storybook catalog and publishes it
  to GitHub Pages on every push to `main`.

The `manifests` job in `ci.yml` gates the same kustomize render that `deploy.yml`
later applies, so schema and policy violations are caught before merge rather than
at deploy time.

## Conventions

- Pin every `uses:` action and every tool download to an explicit version tag;
  floating references break reproducibility across runs.
- Set `concurrency` with `cancel-in-progress: true` on CI jobs so stale runs do
  not consume runner capacity when a new push supersedes them.
- Use the `OBSERVABILITY_DIR` and `POLICY_DIR` env vars in `ci.yml` to keep the
  render and gate commands DRY; update the vars, not individual steps, when paths
  change.

## Constraints

- Do not tag images with `latest` anywhere in workflow files; pin to the git SHA
  so every deployed image is traceable. Use the `GITSHA-PLACEHOLDER` substitution
  pattern already in place.
- Do not add steps that bypass the `manifests` job gates (kubeconform, conftest);
  any k8s manifest change must pass schema validation and OPA policy before it can
  reach the cluster.
- Do not store secrets in workflow files; reference them via `${{ secrets.* }}`
  and register them in the repository Settings.

## How to extend safely

To add a new job to `ci.yml`, declare it alongside `test` and `manifests`, set
`needs` dependencies explicitly if ordering matters, and ensure it runs in
`ubuntu-latest` with pinned tool versions. To add a new manifest bundle to the
deploy pipeline, add a corresponding render-and-gate step in `ci.yml`'s
`manifests` job before adding the `kubectl apply` step in `deploy.yml`, so the
gate always precedes the deploy.
