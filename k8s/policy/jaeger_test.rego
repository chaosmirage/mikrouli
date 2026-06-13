# Executable proof for the jaeger sizing/hardening policy.
#
# Two fixtures stand in for the rendered Deployment so the proof does not depend
# on live render timing: an undersized/over-retentive fixture that MUST be
# rejected, and a correctly sized, hardened fixture that MUST pass clean.
package main

import rego.v1

# An undersized, over-retentive container: memory below the floor and a
# retention window past the cap. Every threshold rule should reject it.
undersized_input := {
	"kind": "Deployment",
	"metadata": {"name": "jaeger"},
	"spec": {"template": {"spec": {
		"securityContext": {
			"runAsNonRoot": true,
			"seccompProfile": {"type": "RuntimeDefault"},
		},
		"containers": [{
			"name": "jaeger",
			"env": [{"name": "BADGER_SPAN_STORAGE_TTL", "value": "72h"}],
			"securityContext": {
				"readOnlyRootFilesystem": true,
				"capabilities": {"drop": ["ALL"]},
			},
			"resources": {
				"limits": {"memory": "512Mi"},
				"requests": {"memory": "128Mi"},
			},
		}],
	}}},
}

# A correctly sized, restricted-PSS-hardened container. No rule should fire.
hardened_input := {
	"kind": "Deployment",
	"metadata": {"name": "jaeger"},
	"spec": {"template": {"spec": {
		"securityContext": {
			"runAsNonRoot": true,
			"seccompProfile": {"type": "RuntimeDefault"},
		},
		"containers": [{
			"name": "jaeger",
			"env": [{"name": "BADGER_SPAN_STORAGE_TTL", "value": "24h"}],
			"securityContext": {
				"readOnlyRootFilesystem": true,
				"capabilities": {"drop": ["ALL"]},
			},
			"resources": {
				"limits": {"memory": "1Gi"},
				"requests": {"memory": "256Mi"},
			},
		}],
	}}},
}

# Fails-on-old: the undersized fixture must produce a non-empty deny set.
test_undersized_is_denied if {
	count(deny) > 0 with input as undersized_input
}

# The undersized fixture trips the memory-limit, request, and TTL rules at once;
# naming each guards against a single over-broad rule masking the others.
test_undersized_limit_denied if {
	deny["jaeger memory limit 512Mi is below the 1Gi floor"] with input as undersized_input
}

test_undersized_request_denied if {
	deny["jaeger memory request 128Mi is below the 256Mi floor"] with input as undersized_input
}

test_undersized_ttl_denied if {
	deny["jaeger BADGER_SPAN_STORAGE_TTL 72h exceeds the 24h cap"] with input as undersized_input
}

# Passes-on-new: the hardened fixture must produce an empty deny set.
test_hardened_is_allowed if {
	count(deny) == 0 with input as hardened_input
}

# A request raised but a limit left too low must still be rejected: the floor is
# absolute, not relative to the request.
test_limit_floor_independent_of_request if {
	count(deny) > 0 with input as object.union(hardened_input, {"spec": {"template": {"spec": {"containers": [{
		"name": "jaeger",
		"env": [{"name": "BADGER_SPAN_STORAGE_TTL", "value": "24h"}],
		"securityContext": {
			"readOnlyRootFilesystem": true,
			"capabilities": {"drop": ["ALL"]},
		},
		"resources": {
			"limits": {"memory": "512Mi"},
			"requests": {"memory": "256Mi"},
		},
	}]}}}})
}

# Dropping any restricted-PSS guarantee must be rejected even when sizing is fine,
# so a sizing edit cannot silently weaken the security posture.
test_pss_regression_is_denied if {
	count(deny) > 0 with input as object.union(hardened_input, {"spec": {"template": {"spec": {"containers": [{
		"name": "jaeger",
		"env": [{"name": "BADGER_SPAN_STORAGE_TTL", "value": "24h"}],
		"securityContext": {
			"readOnlyRootFilesystem": false,
			"capabilities": {"drop": ["ALL"]},
		},
		"resources": {
			"limits": {"memory": "1Gi"},
			"requests": {"memory": "256Mi"},
		},
	}]}}}})
}

# Equivalent spellings of the same quantity must be treated as equal, so a valid
# 1024Mi render is not falsely rejected against a 1Gi floor.
test_equivalent_quantity_spelling_allowed if {
	count(deny) == 0 with input as object.union(hardened_input, {"spec": {"template": {"spec": {"containers": [{
		"name": "jaeger",
		"env": [{"name": "BADGER_SPAN_STORAGE_TTL", "value": "24h"}],
		"securityContext": {
			"readOnlyRootFilesystem": true,
			"capabilities": {"drop": ["ALL"]},
		},
		"resources": {
			"limits": {"memory": "1024Mi"},
			"requests": {"memory": "256Mi"},
		},
	}]}}}})
}

# Non-jaeger resources in the rendered bundle must be ignored, so the policy
# gates only the Deployment it targets.
test_unrelated_resource_ignored if {
	count(deny) == 0 with input as {"kind": "Service", "metadata": {"name": "jaeger-ui"}}
}
