# base

Kubernetes manifests for the production-baseline deployment: namespace, three data stores (PostgreSQL, Redis with primary/replica replication, ClickHouse), two application tiers (API and web frontend), and the namespace-scoped security and networking policies. This is the lowest-level Kustomize bundle that every overlay (production, dev) patches.

## Commands

```sh
kubectl kustomize k8s/base                       # render the base bundle to stdout
kubectl kustomize k8s/overlays/production | kubectl apply -f -   # apply rendered manifests
conftest test --policy k8s/policy k8s/base       # OPA policy check (CI `manifests` job)
kubectl -n mikrouli get pods,svc,netpol          # inspect deployed topology
```

## Architecture

Two request paths share the data stores under one `mikrouli` namespace. Workloads are declared here as Deployments (API, web) and StatefulSets (PostgreSQL, Redis, ClickHouse) with headless Services for stable network identity. Redis runs a primary-replica topology: the replica pod dials the primary via the headless `redis-primary` Service to synchronize the dataset. The ingress Service exposes the web pod to the Traefik controller; the web pod proxies `/api` to the API Service. NetworkPolicies default-deny all ingress and egress, then allowlist each path (DNS to kube-system, web-to-api, api-to-databases, api-to-github-oauth, api-to-observability, and replica-to-primary TCP 6379).

Key resources:

- **Namespace and service accounts** (`namespace.yaml`, `serviceaccounts.yaml`): the `mikrouli` namespace and read-only RBAC identity for API, migration job, and web pods.
- **Data stores** (`postgres/`, `redis/`, `clickhouse/`): StatefulSets with persistent volumes and headless Services.
- **Workloads** (`api/`, `web/`): API Deployment with HPA + PodDisruptionBudget; web Deployment with HPA + nginx ConfigMap.
- **Network policies** (`network-policies.yaml`): default-deny plus per-path allowlists, including the two Redis-replication policies.

## Conventions

- Declare every new workload in its own subdirectory and register it in `kustomization.yaml`; let overlays patch image versions, replica counts, and resource limits rather than redefining the topology.
- Pair each new workload with a NetworkPolicy in `network-policies.yaml` that whitelists only the traffic it needs (DNS, database connections, peer-pod connections).
- Use the headless Service name (e.g. `redis-primary`) for intra-namespace peer discovery rather than pod IPs.

## Constraints

- Never widen an existing NetworkPolicy beyond its intended recipient pods when adding a data path; instead add a new, narrowly-scoped policy and verify the render with `conftest`.
- Never apply base manifests directly to a cluster; instead apply the rendered overlay so image tags and resource limits are pinned.
- Never tag images `:latest` here; instead let the production overlay pin them to the git SHA.
