# Sealed Secrets Controller — Installation

## Prerequisites

- `helm` CLI installed
- `kubeseal` CLI installed (`brew install kubeseal` on macOS)
- kubectl configured to the target cluster

## Install via Helm

```bash
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm repo update
helm install sealed-secrets sealed-secrets/sealed-secrets \
  --namespace kube-system \
  --set fullnameOverride=sealed-secrets-controller \
  --version 2.15.3
```

## Export the public certificate

After installation, export the controller's public certificate. Operators use this
certificate locally to encrypt secrets without cluster access:

```bash
kubeseal --fetch-cert \
  --controller-name=sealed-secrets-controller \
  --controller-namespace=kube-system \
  > k8s/sealed-secrets.crt
```

Commit `k8s/sealed-secrets.crt` to the repository (it is public-key only — safe to commit).

## Sealing a new secret

1. Create a raw secret manifest (NEVER commit this file):

   ```bash
   kubectl create secret generic mikrouli-secrets \
     --namespace mikrouli \
     --dry-run=client -o yaml \
     --from-literal=DB_PASS=... \
     --from-literal=JWT_SECRET=... \
     > /tmp/raw-secret.yaml
   ```

2. Seal it with the controller cert:

   ```bash
   kubeseal --cert k8s/sealed-secrets.crt \
     -o yaml < /tmp/raw-secret.yaml \
     > k8s/base/secrets.sealed.yaml
   rm /tmp/raw-secret.yaml
   ```

3. Commit `k8s/base/secrets.sealed.yaml`.

## Rotating the controller certificate

```bash
# 1. Trigger rotation
kubectl label secret -n kube-system \
  -l sealedsecrets.bitnami.com/sealed-secrets-key=active \
  sealedsecrets.bitnami.com/sealed-secrets-key=compromised

# 2. Restart controller to generate new key
kubectl rollout restart deployment/sealed-secrets-controller -n kube-system

# 3. Re-export new cert and re-seal all secrets
kubeseal --fetch-cert ... > k8s/sealed-secrets.crt
# Re-run sealing steps above for each secret
```
