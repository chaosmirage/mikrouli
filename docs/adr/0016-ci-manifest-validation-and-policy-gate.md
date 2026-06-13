# 0016 - CI Manifest Validation and Policy Gate

**Status:** Accepted

## Context

The observability stack (`k8s/observability/`) deploys a single-replica Jaeger
all-in-one pod that opens an on-disk Badger span store at startup. When the
container memory ceiling was too low, Badger's startup working set exceeded the
limit and the pod was OOM-killed (exit 137) into a CrashLoopBackOff; a long
retention window made the problem recurring, because the on-disk working set
grows as spans accumulate until it crosses the ceiling again. Memory sizing and
span retention are therefore coupled, and a regression in either one silently
breaks tracing only after deploy.

The same Deployment runs in the `observability` namespace, which enforces the
`restricted` Pod Security Standard. A sizing edit that touches the container or
pod spec can accidentally drop a required hardening field
(`runAsNonRoot`, `readOnlyRootFilesystem`, `drop: [ALL]`,
`seccompProfile: RuntimeDefault`), which the cluster would only reject at
admission time.

Before this change, k8s manifests were applied directly by the deploy workflow
with no pre-merge validation: a schema mistake or an undersized resource block
was caught at deploy, on the live cluster, rather than at review time.

Evidence:
- `k8s/observability/jaeger-deployment.yaml`: memory request `256Mi`, limit
  `1Gi`, and `BADGER_SPAN_STORAGE_TTL` `24h`, with persistent Badger storage
  (`BADGER_EPHEMERAL=false`) mounted at `/badger/data`.
- `k8s/policy/jaeger.rego`: an Open Policy Agent policy that parses the rendered
  Deployment and denies it when the memory limit is below the 1Gi floor, the
  request is below the 256Mi floor, the TTL exceeds the 24h cap, or any
  restricted-PSS field is missing. Quantities and durations are compared by
  parsed magnitude, so `1024Mi` and `1Gi` are treated as equal.
- `k8s/policy/jaeger_test.rego`: fixtures proving the policy rejects an
  undersized, over-retentive, or de-hardened Deployment and passes a correctly
  sized, hardened one.
- `.github/workflows/ci.yml`: a `manifests` job that renders
  `k8s/observability` with `kubectl kustomize`, validates the result against
  Kubernetes schemas with kubeconform, runs the policy unit tests with
  `conftest verify`, and gates the rendered manifest with `conftest test`.

## Decision

Add a pre-merge `manifests` job to CI that renders the observability bundle and
validates it on two axes before it can reach the cluster:

- **Schema validation (kubeconform):** the rendered manifest is checked against
  the Kubernetes API schemas in strict mode, catching malformed or unknown
  fields.
- **Policy enforcement (Open Policy Agent / conftest):** a sizing-and-hardening
  policy denies the rendered Jaeger Deployment when the memory limit drops below
  1Gi, the request drops below 256Mi, the Badger TTL exceeds 24h, or any
  restricted-PSS field is absent. The policy's own unit tests run first with
  `conftest verify`.

The rendered bundle that the gate checks is the same bundle the deploy workflow
applies (`kubectl apply -k k8s/observability`), so the values that are validated
are the values that ship. The Jaeger Deployment is sized to a 1Gi limit / 256Mi
request with a 24h Badger TTL, which sits within the policy floors and keeps the
startup and steady-state working set inside the memory ceiling.

## Alternatives Considered

- **No pre-merge gate (deploy-time only):** the prior state. Schema and sizing
  errors surface on the live cluster, where a CrashLoopBackOff blocks tracing
  until a follow-up fix is merged and redeployed. The gate moves the failure to
  review time.
- **Schema validation only (kubeconform, no policy):** catches structural
  mistakes but cannot express domain constraints such as a memory floor or a
  retention cap, which are exactly the conditions that caused the OOM-kill.
- **Hard-coded resource values with no enforcement:** relies on every future
  edit remembering the coupling between memory and retention, and on not
  dropping a PSS field; an executable policy makes the contract explicit and
  self-checking.
- **Admission-time policy on the cluster only:** rejects bad manifests but only
  after they are applied, and only for the PSS fields the namespace already
  enforces; it does not cover sizing and runs too late to inform a reviewer.

## Consequences

- A manifest change that undersizes Jaeger, over-extends its retention, or drops
  a restricted-PSS field fails CI before merge, with a message naming the
  violated threshold.
- The policy compares parsed quantities and durations, so equivalent spellings
  of the same value are accepted and only genuine magnitude regressions are
  rejected.
- The policy targets the Jaeger Deployment by kind and name; other resources in
  the rendered bundle pass through untouched, so the gate is scoped to what it
  guards.
- kubeconform and conftest are pinned to explicit release versions in the
  workflow, keeping the gate reproducible across runs.
- Extending coverage to other manifests means adding their render-and-gate steps
  to the `manifests` job before the deploy workflow applies them, so the gate
  always precedes the deploy.
