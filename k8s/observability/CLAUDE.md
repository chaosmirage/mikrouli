# observability

Kustomize bundle that deploys the Jaeger all-in-one trace backend into the
`observability` namespace. The namespace enforces the `restricted` Pod Security
Standard, so every pod spec must carry `runAsNonRoot`, `readOnlyRootFilesystem`,
`drop: [ALL]`, and `seccompProfile: RuntimeDefault`.

## Commands

```sh
kubectl kustomize k8s/observability          # render manifests without applying
kubectl apply -k k8s/observability           # deploy or update the stack
kubectl -n observability get pods            # check pod health
kubectl -n observability logs deploy/jaeger  # inspect container logs
conftest test --policy k8s/policy rendered-observability.yaml  # run OPA policy
```

## Architecture

The bundle contains four manifests applied as a unit:

- `namespace.yaml` -- declares the `observability` namespace and pins its
  `pod-security.kubernetes.io/enforce` label to `restricted`.
- `jaeger-deployment.yaml` -- single-replica Jaeger all-in-one pod. Uses Badger
  on-disk storage (`SPAN_STORAGE_TYPE=badger`, `BADGER_EPHEMERAL=false`) mounted
  at `/badger/data` via an `emptyDir` volume. Memory limit is 1Gi; Badger TTL is
  capped at 24h to keep the working set within that ceiling.
- `jaeger-service.yaml` -- two Services: `otel-collector:4318` (OTLP/HTTP ingest,
  consumed by the API at `otel-collector.observability.svc.cluster.local:4318`)
  and `jaeger-ui:16686` (trace browser). Service names are a stable contract; do
  not rename them without updating `k8s/base/api/deployment.yaml` and the network
  policy in `k8s/base/network-policies.yaml`.
- `kustomization.yaml` -- lists all three resources with the `observability`
  namespace override.

CI renders the bundle with `kubectl kustomize`, validates schemas with
kubeconform, and gates it through the OPA policy in `k8s/policy/` before deploy.

## Conventions

- Keep `SPAN_STORAGE_TYPE`, `BADGER_DIRECTORY_KEY`, and `BADGER_DIRECTORY_VALUE`
  in sync: both Badger paths must land inside the single writable mount
  (`/badger/data`) because `readOnlyRootFilesystem: true` blocks all other writes.
- Size memory resources against the Badger TTL: a longer retention window grows
  the on-disk working set; the OPA policy enforces a 24h TTL cap and a 1Gi limit
  floor to keep them aligned.
- Pin image tags to explicit semver releases; never use `latest`.

## Constraints

- Do not weaken the Pod Security posture (`runAsNonRoot`, `readOnlyRootFilesystem`,
  `drop: [ALL]`, `seccompProfile: RuntimeDefault`); the namespace enforces
  `restricted` and will reject non-compliant pods at admission. Add writable
  `emptyDir` mounts instead of relaxing security context fields.
- Do not rename the `otel-collector` or `jaeger-ui` Services without updating
  every consumer; the API deployment and egress network policy reference them by
  name. Change both together or introduce an alias first.
- Do not set `BADGER_EPHEMERAL=true` in this manifest; use the Compose override
  for ephemeral dev runs instead, keeping k8s persistent by default.

## How to extend safely

Add a new writable path for Jaeger by mounting a second `emptyDir` at the
required path and listing it in `volumeMounts` -- do not widen `readOnlyRootFilesystem`.
To change image version, update the tag in `jaeger-deployment.yaml`, render with
`kubectl kustomize`, validate with kubeconform and conftest, then let CI deploy.
To increase retention, raise the TTL and the memory limit together so the
working set stays within the ceiling; both changes must satisfy the OPA policy
thresholds in `k8s/policy/jaeger.rego`.
