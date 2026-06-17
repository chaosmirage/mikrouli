# Executable proof for the redis replica-to-primary replication policy.
#
# The policy asserts that a rendered bundle contains BOTH:
# - an egress rule from replica pods to primary pods on TCP 6379
# - an ingress rule to primary pods from replica pods on TCP 6379
#
# Two fixtures stand in for rendered bundles: the pre-fix bundle lacking the edge
# (MUST be denied), and the fixed bundle with both egress and ingress (MUST pass).
package redis_replication

import rego.v1

# Pre-fix bundle: no NetworkPolicy for redis replica-to-primary replication.
# This represents the old state; the policy MUST reject it.
missing_edge_bundle := [
	{
		"path": "base/namespace.yaml",
		"contents": {
			"apiVersion": "v1",
			"kind": "Namespace",
			"metadata": {"name": "mikrouli"},
		},
	},
	{
		"path": "base/redis-primary.yaml",
		"contents": {
			"apiVersion": "v1",
			"kind": "Pod",
			"metadata": {
				"name": "redis-primary",
				"namespace": "mikrouli",
				"labels": {
					"app.kubernetes.io/name": "redis",
					"app.kubernetes.io/component": "primary",
				},
			},
			"spec": {"containers": [{"name": "redis", "image": "redis:7"}]},
		},
	},
	{
		"path": "base/redis-replica.yaml",
		"contents": {
			"apiVersion": "v1",
			"kind": "Pod",
			"metadata": {
				"name": "redis-replica",
				"namespace": "mikrouli",
				"labels": {
					"app.kubernetes.io/name": "redis",
					"app.kubernetes.io/component": "replica",
				},
			},
			"spec": {"containers": [{"name": "redis", "image": "redis:7"}]},
		},
	},
	{
		"path": "base/network-policies.yaml",
		"contents": {
			"apiVersion": "networking.k8s.io/v1",
			"kind": "NetworkPolicy",
			"metadata": {
				"name": "allow-database-internal",
				"namespace": "mikrouli",
			},
			"spec": {
				"podSelector": {"matchLabels": {"app.kubernetes.io/name": "postgres"}},
				"policyTypes": ["Ingress", "Egress"],
				"ingress": [{"from": [{"podSelector": {"matchLabels": {"role": "backend"}}}]}],
				"egress": [{"to": [{"podSelector": {"matchLabels": {"app.kubernetes.io/name": "postgres"}}}]}],
			},
		},
	},
]

# Fixed bundle: contains both egress (replica->primary) and ingress (primary<-replica)
# NetworkPolicy rules with proper component labels. The policy MUST accept it.
fixed_bundle := [
	{
		"path": "base/namespace.yaml",
		"contents": {
			"apiVersion": "v1",
			"kind": "Namespace",
			"metadata": {"name": "mikrouli"},
		},
	},
	{
		"path": "base/redis-primary.yaml",
		"contents": {
			"apiVersion": "v1",
			"kind": "Pod",
			"metadata": {
				"name": "redis-primary",
				"namespace": "mikrouli",
				"labels": {
					"app.kubernetes.io/name": "redis",
					"app.kubernetes.io/component": "primary",
				},
			},
			"spec": {"containers": [{"name": "redis", "image": "redis:7"}]},
		},
	},
	{
		"path": "base/redis-replica.yaml",
		"contents": {
			"apiVersion": "v1",
			"kind": "Pod",
			"metadata": {
				"name": "redis-replica",
				"namespace": "mikrouli",
				"labels": {
					"app.kubernetes.io/name": "redis",
					"app.kubernetes.io/component": "replica",
				},
			},
			"spec": {"containers": [{"name": "redis", "image": "redis:7"}]},
		},
	},
	{
		"path": "base/network-policies.yaml",
		"contents": {
			"apiVersion": "networking.k8s.io/v1",
			"kind": "NetworkPolicy",
			"metadata": {
				"name": "allow-redis-replica-egress-to-primary",
				"namespace": "mikrouli",
			},
			"spec": {
				"podSelector": {
					"matchLabels": {
						"app.kubernetes.io/name": "redis",
						"app.kubernetes.io/component": "replica",
					},
				},
				"policyTypes": ["Egress"],
				"egress": [{
					"to": [{
						"podSelector": {
							"matchLabels": {
								"app.kubernetes.io/name": "redis",
								"app.kubernetes.io/component": "primary",
							},
						},
					}],
					"ports": [{"protocol": "TCP", "port": 6379}],
				}],
			},
		},
	},
	{
		"path": "base/network-policies-ingress.yaml",
		"contents": {
			"apiVersion": "networking.k8s.io/v1",
			"kind": "NetworkPolicy",
			"metadata": {
				"name": "allow-redis-primary-ingress-from-replica",
				"namespace": "mikrouli",
			},
			"spec": {
				"podSelector": {
					"matchLabels": {
						"app.kubernetes.io/name": "redis",
						"app.kubernetes.io/component": "primary",
					},
				},
				"policyTypes": ["Ingress"],
				"ingress": [{
					"from": [{
						"podSelector": {
							"matchLabels": {
								"app.kubernetes.io/name": "redis",
								"app.kubernetes.io/component": "replica",
							},
						},
					}],
					"ports": [{"protocol": "TCP", "port": 6379}],
				}],
			},
		},
	},
]

# Missing-edge bundle with bare name:redis selectors (security widening).
# This demonstrates that component-scoped selectors are enforced.
wrong_scope_bundle := [
	{
		"path": "base/namespace.yaml",
		"contents": {
			"apiVersion": "v1",
			"kind": "Namespace",
			"metadata": {"name": "mikrouli"},
		},
	},
	{
		"path": "base/redis-primary.yaml",
		"contents": {
			"apiVersion": "v1",
			"kind": "Pod",
			"metadata": {
				"name": "redis-primary",
				"namespace": "mikrouli",
				"labels": {
					"app.kubernetes.io/name": "redis",
					"app.kubernetes.io/component": "primary",
				},
			},
			"spec": {"containers": [{"name": "redis", "image": "redis:7"}]},
		},
	},
	{
		"path": "base/redis-replica.yaml",
		"contents": {
			"apiVersion": "v1",
			"kind": "Pod",
			"metadata": {
				"name": "redis-replica",
				"namespace": "mikrouli",
				"labels": {
					"app.kubernetes.io/name": "redis",
					"app.kubernetes.io/component": "replica",
				},
			},
			"spec": {"containers": [{"name": "redis", "image": "redis:7"}]},
		},
	},
	{
		"path": "base/network-policies.yaml",
		"contents": {
			"apiVersion": "networking.k8s.io/v1",
			"kind": "NetworkPolicy",
			"metadata": {
				"name": "allow-redis-replication-bad-scope",
				"namespace": "mikrouli",
			},
			"spec": {
				"podSelector": {"matchLabels": {"app.kubernetes.io/name": "redis"}},
				"policyTypes": ["Egress", "Ingress"],
				"egress": [{
					"to": [{"podSelector": {"matchLabels": {"app.kubernetes.io/name": "redis"}}}],
					"ports": [{"protocol": "TCP", "port": 6379}],
				}],
				"ingress": [{
					"from": [{"podSelector": {"matchLabels": {"app.kubernetes.io/name": "redis"}}}],
					"ports": [{"protocol": "TCP", "port": 6379}],
				}],
			},
		},
	},
]

# Fails on pre-fix: the missing-edge bundle must produce a non-empty deny set.
test_missing_edge_denied if {
	count(deny) > 0 with input as missing_edge_bundle
}

# Passes on fix: the fixed bundle must produce an empty deny set.
test_fixed_bundle_allowed if {
	count(deny) == 0 with input as fixed_bundle
}

# Wrong scope (bare name:redis) must also be denied: only component-scoped policies pass.
test_bare_scope_denied if {
	count(deny) > 0 with input as wrong_scope_bundle
}
