# 0008 - k3s on Hetzner with Default-Deny Network Policies and a Cost Ceiling

**Status:** Accepted

## Context

The application needs a production Kubernetes environment that is:

- **Cost-bounded:** the project is a small, self-hosted application; uncapped
  cloud spend is not acceptable.
- **Secure at the network level:** services in the same namespace should not
  be able to reach each other arbitrarily; every allowed communication path
  should be explicit.
- **Manageable without a managed control plane:** a managed Kubernetes offering
  (e.g. GKE, EKS) adds cost and cloud-provider lock-in. A self-managed
  lightweight distribution keeps the infrastructure under version control.

A flat namespace with no network policies would allow any pod to reach any
other pod on any port, making lateral movement trivially easy if one workload
is compromised.

Evidence:
- `k8s/cluster/hetzner-k3s.yaml`: declares a k3s cluster on Hetzner Cloud,
  cost-capped at approximately EUR 15.73/month (below the stated EUR 30 ceiling),
  with a private network subnet and `schedule_workloads_on_masters: true`.
- `k8s/base/network-policies.yaml`: opens with a `default-deny-all` policy
  (`podSelector: {}`, `policyTypes: [Ingress, Egress]`), then adds explicit
  allow policies for each required communication path (DNS, API-to-databases,
  nginx-to-api, nginx-to-web, etc.).
- `k8s/README.md` documents the cost ceiling, replica policy, and the
  single-master trade-off.
- Kustomize overlays are in `k8s/overlays/` for environment-specific
  configuration.

## Decision

Deploy on Hetzner Cloud using k3s (lightweight Kubernetes) managed by the
`hetzner-k3s` tool. The cluster configuration is committed to `k8s/cluster/`.

Network security uses a zero-trust posture at the namespace level:

1. A `default-deny-all` NetworkPolicy blocks all ingress and egress for every
   pod in the `mikrouli` namespace by default.
2. Explicit `NetworkPolicy` resources allowlist each required communication path
   (e.g. API pods may reach Postgres, Redis, and ClickHouse; nginx may reach API
   and web pods; all pods may query CoreDNS).

The cluster runs a single control-plane node with `schedule_workloads_on_masters:
true` to stay within the EUR 30/month cost ceiling. This is an explicit
availability trade-off documented in `k8s/cluster/hetzner-k3s.yaml` and
`k8s/README.md`.

Infrastructure configuration is managed with Kustomize overlays.

## Alternatives Considered

- **Managed Kubernetes (GKE, EKS, AKS):** removes the burden of control-plane
  management but costs significantly more and ties the project to a specific
  cloud provider's tooling.
- **Single VM with Docker Compose:** simpler than Kubernetes, but provides no
  resource isolation, no declarative rollout mechanism, and no NetworkPolicy
  equivalent. The existing production Docker Compose profiles are used for local
  development.
- **Three-master HA control plane on Hetzner:** provides control-plane redundancy
  but would require approximately EUR 25/month for three `cpx11` masters alone,
  leaving little headroom for worker and storage costs within the EUR 30 ceiling.
- **Default-allow networking (no NetworkPolicy):** no operational overhead, but
  any compromised pod can reach any other service in the namespace.

## Consequences

- The single-master control plane means a control-plane node failure halts new
  deployments and cluster API operations until the node is replaced; running
  workloads continue serving via the worker node. This is an accepted trade-off
  for a cost-capped personal project.
- Every new service that requires network access must have an explicit allow
  policy added to `k8s/base/network-policies.yaml`; there is no implicit
  connectivity.
- The Hetzner private network (`10.0.0.0/16`) isolates inter-node traffic from
  the public internet.
- Infrastructure changes are version-controlled alongside application code,
  enabling review and rollback via git.
