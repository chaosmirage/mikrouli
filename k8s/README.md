# mikrouli — Kubernetes Runbook

This document covers the complete operational lifecycle of the mikrouli cluster on Hetzner Cloud.
All manifests live under `k8s/` and are managed via Kustomize overlays.

## Cost and topology

The cluster runs on Hetzner Cloud (Nuremberg, `nbg1`) and is designed for low steady-state cost with on-demand burst capacity.

### Topology

| Role | Instance | Always on |
| ---- | -------- | --------- |
| Control-plane (runs all workloads) | cax11 (ARM, 2 vCPU / 4 GB) | yes |
| Burst worker pool | cax11 (ARM, 2 vCPU / 4 GB) | no — autoscales 0 → 1 |

- `schedule_workloads_on_masters: true` is set; the control-plane node runs all pods at steady state.
- The burst worker pool is managed by hetzner-k3s built-in autoscaling (hard cap: 2 nodes total, i.e. 1 control-plane + 1 burst worker at most).
- **Stateful pods** (postgres, clickhouse, redis) and the **cooking tenant** are pinned to the control-plane node via node affinity. Only stateless `api` and `web` pods overflow to the burst worker.
- Both `mikrou.li` and `cooking.mikrou.li` route through the same lb11 load balancer.
- **metrics-server** is the k3s-bundled one; it enables HPA. Cluster autoscaling is provided by hetzner-k3s built-in autoscaling — no separate cluster-autoscaler deployment is needed.

### Cost breakdown (gross, incl. VAT)

| Item                                          | Monthly cost |
| --------------------------------------------- | -----------: |
| 1 × cax11 control-plane (ARM, always-on)      |      EUR 5.34 |
| 1 × lb11 load balancer                        |      EUR 8.91 |
| 1 × IPv4 primary                              |      EUR 0.60 |
| Volumes (postgres + clickhouse + redis)       |      EUR 2.83 |
| **Baseline total**                            |  **~EUR 17.7** |
| + 1 × cax11 burst worker (worst case)         |      EUR 5.34 |
| **Worst-case total**                          |  **~EUR 23.0** |

**Replica policy** (cost-capped):

- `api` Deployment: **2 replicas** (HA backend).
- `web`, `postgres`, `redis-primary`, `redis-replica`, `clickhouse`: **1 replica each**.

---

**Image registry placeholder**: every image reference uses `ghcr.io/OWNER/mikrouli-{api,web}`.
Replace `OWNER` with your GitHub organization or username before the first deploy:

```bash
grep -rl 'ghcr.io/OWNER' k8s/ | xargs sed -i 's|ghcr.io/OWNER|ghcr.io/your-org|g'
```

**Required GitHub secrets** (Settings → Secrets and variables → Actions):

| Secret                  | Description                                     |
| ----------------------- | ----------------------------------------------- |
| `KUBECONFIG_PRODUCTION` | Full kubeconfig YAML for the production cluster |

---

## Provisioning

### 1. Install hetzner-k3s

```bash
brew install vitobotta/tap/hetzner-k3s   # or download from GitHub releases
```

### 2. Create the cluster

```bash
# Set your Hetzner Cloud API token
export HCLOUD_TOKEN=your-hetzner-api-token

# Provision 1 cax11 control-plane node in Nuremberg (burst worker pool autoscales from 0)
hetzner-k3s create --config k8s/cluster/hetzner-k3s.yaml
```

The kubeconfig is written to `~/.kube/mikrouli.yaml`. Export it:

```bash
export KUBECONFIG=~/.kube/mikrouli.yaml
kubectl get nodes
```

### 3. Install cert-manager

```bash
helm repo add jetstack https://charts.jetstack.io && helm repo update
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true \
  --version v1.14.5

# Apply the Let's Encrypt ClusterIssuer
kubectl apply -f k8s/cluster/cert-issuer.yaml
```

### 4. Install Traefik

```bash
helm repo add traefik https://traefik.github.io/charts && helm repo update
helm install traefik traefik/traefik \
  --namespace kube-system \
  --set ports.web.redirectTo.port=websecure \
  --version 27.0.2
```

### 5. Create the namespace

```bash
kubectl apply -f k8s/base/namespace.yaml
```

---

## Secrets

Application secrets are **never** committed to git and **never** stored in
GitHub Secrets. The only credential GitHub holds is `KUBECONFIG_PRODUCTION`
(needed for the workflow to reach the cluster).

Application credentials (`DB_USER`, `DB_PASS`, `JWT_SECRET`, etc.) live as a
Kubernetes `Secret` named `mikrouli-secrets` in the `mikrouli` namespace. The
operator creates this Secret **manually**, **once**, from a trusted machine
with `kubectl` access. The deploy workflow never sees plaintext.

### First-time creation (replacing url-shortener — same credentials)

If you are taking over `url-shortener`'s data, copy its existing Secret
verbatim so mikrouli's postgres pod uses the same DB credentials and
`pg_restore` accepts the dump's role grants:

```bash
kubectl create namespace mikrouli --dry-run=client -o yaml | kubectl apply -f -

kubectl -n url-shortener get secret url-shortener-secrets -o json \
  | jq '
      .metadata = { name: "mikrouli-secrets", namespace: "mikrouli" }
      | del(.metadata.creationTimestamp, .metadata.resourceVersion,
            .metadata.uid, .metadata.ownerReferences, .metadata.managedFields)
    ' \
  | kubectl apply -n mikrouli -f -
```

Plaintext exists only in kernel pipes between processes, never on disk,
never as a CLI argument.

### First-time creation (greenfield — no existing data)

```bash
kubectl create namespace mikrouli --dry-run=client -o yaml | kubectl apply -f -

# Read values from your password manager (1Password CLI, pass, …) into shell
# vars; or paste interactively. Then:
kubectl -n mikrouli create secret generic mikrouli-secrets \
  --from-literal=DB_USER="$DB_USER" \
  --from-literal=DB_PASS="$DB_PASS" \
  --from-literal=DB_NAME="$DB_NAME" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET" \
  --from-literal=GITHUB_CLIENT_ID="$GITHUB_CLIENT_ID" \
  --from-literal=GITHUB_CLIENT_SECRET="$GITHUB_CLIENT_SECRET" \
  --from-literal=CLICKHOUSE_PASSWORD="$CLICKHOUSE_PASSWORD" \
  --from-literal=S3_ACCESS_KEY="$S3_ACCESS_KEY" \
  --from-literal=S3_SECRET_KEY="$S3_SECRET_KEY" \
  --from-literal=S3_ENDPOINT="$S3_ENDPOINT" \
  --from-literal=S3_BUCKET="$S3_BUCKET"

# Clear shell vars from history
unset DB_PASS JWT_SECRET JWT_REFRESH_SECRET GITHUB_CLIENT_SECRET CLICKHOUSE_PASSWORD S3_SECRET_KEY
history -c 2>/dev/null || true
```

### Rotating a secret

```bash
kubectl -n mikrouli edit secret mikrouli-secrets   # update base64 values
kubectl rollout restart deployment/api -n mikrouli
```

---

## Observability

The API emits OpenTelemetry traces via the OTLP/HTTP protocol.
An OTel collector deployment is **out of scope** for this project — operators bring their own
(Jaeger, Tempo, SigNoz, Honeycomb, …) and point the env var at it.

### Environment variables

| Variable                      | Default (in k8s)                                             | Description                                 |
| ----------------------------- | ------------------------------------------------------------ | ------------------------------------------- |
| `OTEL_ENABLED`                | `true` (api Deployment) / `false` (migration Job)            | Enable/disable the SDK                      |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otel-collector.observability.svc.cluster.local:4318` | OTLP/HTTP collector endpoint                |
| `OTEL_SERVICE_NAME`           | `mikrouli-api`                                               | Resource attribute `service.name`           |
| `SERVICE_VERSION`             | pod label `app.kubernetes.io/version`                        | Resource attribute `service.version`        |
| `DEPLOYMENT_ENVIRONMENT`      | `production`                                                 | Resource attribute `deployment.environment` |

SDK reference: <https://opentelemetry.io/docs/languages/js/getting-started/nodejs/>

---

## Deploy

### Prerequisites

- `kubectl` configured to the target cluster
- Sealed secrets already applied (see above)

### Production

```bash
# CI deploys via the Build, Test, Scan, and Deploy workflow (workflow_dispatch only).
# Manual deploy — always specify an exact git SHA, never :latest:
SHA=$(git rev-parse HEAD)
sed "s/GITSHA-PLACEHOLDER/$SHA/g" k8s/overlays/production/kustomization.yaml \
  | kubectl apply -k -

kubectl rollout status deployment/api -n mikrouli --timeout=10m
kubectl rollout status deployment/web -n mikrouli --timeout=10m
```

### Pre-deploy migration job

```bash
# Run migrations before the Deployment rolls out
kubectl apply -f k8s/base/api/migration-job.yaml
kubectl wait --for=condition=complete job/api-migration -n mikrouli --timeout=5m
```

### Cutover from `url-shortener`

Replacing the legacy `url-shortener` deployment on the same cluster while preserving production data (users, links, click stats) follows a separate runbook with its own pre-flight checklist, dump-and-restore sequence, and rollback path:

See [`k8s/CUTOVER.md`](./CUTOVER.md).

---

## Rollback

### API or web deployment

```bash
# View rollout history
kubectl rollout history deployment/api -n mikrouli
kubectl rollout history deployment/web -n mikrouli

# Roll back to the previous image SHA
kubectl rollout undo deployment/api -n mikrouli
kubectl rollout undo deployment/web -n mikrouli

# Roll back to a specific revision
kubectl rollout undo deployment/api --to-revision=3 -n mikrouli
```

Image SHA pinning in the production overlay ensures every rollback targets a known-good
artifact. The SHA appears in `kubectl rollout history` output and can be verified against
the GitHub commit log.

### StatefulSet (postgres, redis, clickhouse)

StatefulSets do not support `rollout undo`. Roll back by editing the image tag:

```bash
kubectl set image statefulset/postgres postgres=postgres:16-alpine -n mikrouli
```

---

## Backup

### Schedule

| Job                 | Schedule        | Destination                                   |
| ------------------- | --------------- | --------------------------------------------- |
| `postgres-backup`   | Daily 02:00 UTC | `s3://$S3_BUCKET/postgres/YYYY/MM/DD/`        |
| `clickhouse-backup` | Daily 03:00 UTC | `s3://$S3_BUCKET/clickhouse/YYYYMMDD-HHmmss/` |

**Retention**: configure a 30-day lifecycle policy on the S3 bucket. Use your provider's
console or the `aws s3api put-bucket-lifecycle-configuration` command with `Expiration.Days: 30`.

### Manual on-demand backup

```bash
# PostgreSQL
kubectl run pg-backup --rm -it --restart=Never \
  --namespace mikrouli \
  --image=postgres:16-alpine \
  --env-from=secret/mikrouli-secrets \
  -- sh -c 'pg_dump -h postgres -U "$DB_USER" "$DB_NAME"' | gzip > manual-backup.sql.gz

# ClickHouse — uses the native BACKUP DATABASE SQL statement
kubectl exec -it clickhouse-0 -n mikrouli -- \
  clickhouse-client --query \
  "BACKUP DATABASE mikrouli TO S3('$S3_ENDPOINT/$S3_BUCKET/clickhouse/manual', '$S3_ACCESS_KEY', '$S3_SECRET_KEY')"
```

---

## Restore

### PostgreSQL restore

```bash
# 1. Download the backup from S3
aws s3 cp s3://mikrouli-backups/postgres/2026/04/25/backup-20260425-020000.sql.gz \
  /tmp/restore.sql.gz --endpoint-url $S3_ENDPOINT

# 2. Restore into the running database
zcat /tmp/restore.sql.gz | kubectl exec -i postgres-0 -n mikrouli -- \
  psql -U postgres -d mikrouli

# 3. Verify row counts
kubectl exec -it postgres-0 -n mikrouli -- \
  psql -U postgres -d mikrouli \
  -c "SELECT COUNT(*) FROM links; SELECT COUNT(*) FROM users;"
```

### ClickHouse restore

```bash
# Restore using the RESTORE DATABASE SQL command
kubectl exec -it clickhouse-0 -n mikrouli -- \
  clickhouse-client --query \
  "RESTORE DATABASE mikrouli FROM S3('$S3_ENDPOINT/$S3_BUCKET/clickhouse/20260425-030000', '$S3_ACCESS_KEY', '$S3_SECRET_KEY')"
```

### Disaster recovery

If the entire cluster is lost:

1. Re-provision via `hetzner-k3s create` (takes ~10 minutes).
2. Install cert-manager and Traefik (see Provisioning section).
3. Recreate `mikrouli-secrets` from your password manager (see § Secrets — first-time creation).
4. Run the migration job: `kubectl apply -f k8s/base/api/migration-job.yaml`
5. Restore PostgreSQL from the latest S3 backup (see above).
6. Deploy: `kubectl apply -k k8s/overlays/production`
7. Verify: `kubectl get pods -n mikrouli && curl https://mikrou.li/api/health`

---

## Incident response

### Check pod status

```bash
kubectl get pods -n mikrouli
kubectl describe pod <pod-name> -n mikrouli
kubectl logs <pod-name> -n mikrouli --previous
kubectl logs <pod-name> -n mikrouli -f
```

### Check recent events

```bash
kubectl get events -n mikrouli --sort-by='.lastTimestamp' | tail -30
```

### Scale down a misbehaving deployment

```bash
kubectl scale deployment/api --replicas=0 -n mikrouli
# investigate logs and events, then restore
kubectl scale deployment/api --replicas=2 -n mikrouli
```

### Check TLS certificate status

```bash
kubectl get certificates -n mikrouli
kubectl describe certificate mikrouli-tls -n mikrouli
kubectl get certificaterequests -n mikrouli
```

### Check ingress and Traefik

```bash
kubectl describe ingress mikrouli -n mikrouli
kubectl logs -l app.kubernetes.io/name=traefik -n kube-system --tail=50
```

### Force migration re-run

```bash
kubectl delete job api-migration -n mikrouli --ignore-not-found
kubectl apply -f k8s/base/api/migration-job.yaml
kubectl wait --for=condition=complete job/api-migration -n mikrouli --timeout=5m
kubectl logs -l app.kubernetes.io/name=api-migration -n mikrouli
```

### Network policy connectivity test

```bash
# Verify api can reach postgres
kubectl exec -it <api-pod> -n mikrouli -- nc -zv postgres 5432

# Verify web can reach api
kubectl exec -it <web-pod> -n mikrouli -- nc -zv api 3000
```
