# mikrouli — Kubernetes Runbook

This document covers the complete operational lifecycle of the mikrouli cluster on Hetzner Cloud.
All manifests live under `k8s/` and are managed via Kustomize overlays.

## Cost ceiling — €30 / month

The cluster is sized to fit a strict €30/month total budget on Hetzner Cloud:

| Item                                          | Monthly cost |
| --------------------------------------------- | -----------: |
| 1 × cx22 control-plane (with workloads)       |        €4.51 |
| 1 × cx22 worker                               |        €4.51 |
| 30 GB volumes (postgres + clickhouse + redis) |        €1.32 |
| 1 × Hetzner Load Balancer (LB11)              |        €5.39 |
| 1 × IPv4 (primary, included with LB)          |        €0.00 |
| **Total**                                     |   **~€15.7** |

**Replica policy** (cost-capped):

- `api` Deployment: **2 replicas** (HA backend).
- `web`, `postgres`, `redis-primary`, `redis-replica`, `clickhouse`: **1 replica each**.

**Trade-off**: `schedule_workloads_on_masters: true` is enabled because a 3-master HA control-plane would push the budget over €30. With one master, a control-plane node failure stops new deployments; running workloads continue serving via the worker. To upgrade to HA control-plane: change `instance_type` to `cpx11` (3 nodes ≈ €12.4) and set `schedule_workloads_on_masters: false`. Total stays under €30.

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
| `SEALED_SECRETS_CERT`   | Public cert from `kubeseal --fetch-cert`        |

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

# Provision 1 control-plane node + 1 worker in Nuremberg (~€16/mo)
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

### 5. Install sealed-secrets controller

See `k8s/cluster/sealed-secrets-controller.md` for full instructions.

Short version:

```bash
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm install sealed-secrets sealed-secrets/sealed-secrets \
  --namespace kube-system \
  --set fullnameOverride=sealed-secrets-controller

# Export the public cert for local sealing
kubeseal --fetch-cert \
  --controller-name=sealed-secrets-controller \
  --controller-namespace=kube-system \
  > k8s/sealed-secrets.crt
```

### 6. Create the namespace

```bash
kubectl apply -f k8s/base/namespace.yaml
```

---

## Secrets

### Sealing secrets for the first time

```bash
# Create the raw secret (NEVER commit this file)
kubectl create secret generic mikrouli-secrets \
  --namespace mikrouli \
  --dry-run=client -o yaml \
  --from-literal=DB_USER=mikrouli \
  --from-literal=DB_PASS="$(openssl rand -hex 32)" \
  --from-literal=DB_NAME=mikrouli \
  --from-literal=JWT_SECRET="$(openssl rand -hex 64)" \
  --from-literal=JWT_REFRESH_SECRET="$(openssl rand -hex 64)" \
  --from-literal=S3_ACCESS_KEY=your-access-key \
  --from-literal=S3_SECRET_KEY=your-secret-key \
  --from-literal=S3_ENDPOINT=https://your-s3-endpoint \
  --from-literal=S3_BUCKET=mikrouli-backups \
  --from-literal=CLICKHOUSE_PASSWORD="$(openssl rand -hex 32)" \
  > /tmp/raw-secret.yaml

# Seal with the controller's public key
kubeseal --cert k8s/sealed-secrets.crt \
  -o yaml < /tmp/raw-secret.yaml \
  > k8s/base/secrets.sealed.yaml

# Destroy the plaintext
rm /tmp/raw-secret.yaml

# Commit the sealed secret (safe to commit — encrypted asymmetrically)
git add k8s/base/secrets.sealed.yaml
git commit -m "chore: update sealed secrets"
```

### Rotating the sealed-secrets controller certificate

If the controller key is compromised:

```bash
# Mark the active key as compromised
kubectl label secret -n kube-system \
  -l sealedsecrets.bitnami.com/sealed-secrets-key=active \
  sealedsecrets.bitnami.com/sealed-secrets-key=compromised

# Restart to generate a new key
kubectl rollout restart deployment/sealed-secrets-controller -n kube-system

# Re-export the new cert and re-seal all secrets with the new cert
kubeseal --fetch-cert \
  --controller-name=sealed-secrets-controller \
  --controller-namespace=kube-system \
  > k8s/sealed-secrets.crt
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
2. Install cert-manager, Traefik, sealed-secrets (see Provisioning section).
3. Apply namespace and secrets: `kubectl apply -f k8s/base/namespace.yaml && kubectl apply -f k8s/base/secrets.sealed.yaml`
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
