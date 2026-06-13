# Sizing and restricted-PSS policy for the jaeger tracing Deployment.
#
# The jaeger all-in-one pod opens its on-disk span store at startup; too small a
# memory ceiling OOM-kills it into a crashloop, and too long a retention window
# lets the working set outgrow the ceiling again as data accumulates. These rules
# assert the rendered Deployment grants enough memory and bounds retention, and
# that the restricted-PSS hardening a sizing edit must not weaken stays intact.
# Thresholds compare parsed quantities/durations, not raw strings, so equivalent
# spellings (1024Mi == 1Gi) are treated as equal.
package main

import rego.v1

# Memory floors in bytes and the retention cap in minutes -- the contract the
# rendered manifest must satisfy.
limit_floor_bytes := 1073741824 # 1Gi

request_floor_bytes := 268435456 # 256Mi

ttl_cap_minutes := 1440 # 24h

ttl_env_name := "BADGER_SPAN_STORAGE_TTL"

# The jaeger container of the rendered jaeger Deployment, or undefined when the
# input document is some other resource (so the bundle's other manifests pass).
jaeger_container := container if {
	input.kind == "Deployment"
	input.metadata.name == "jaeger"
	some container in input.spec.template.spec.containers
	container.name == "jaeger"
}

pod_security_context := input.spec.template.spec.securityContext

deny contains msg if {
	bytes := quantity_to_bytes(jaeger_container.resources.limits.memory)
	bytes < limit_floor_bytes
	msg := sprintf("jaeger memory limit %s is below the 1Gi floor", [jaeger_container.resources.limits.memory])
}

deny contains msg if {
	bytes := quantity_to_bytes(jaeger_container.resources.requests.memory)
	bytes < request_floor_bytes
	msg := sprintf("jaeger memory request %s is below the 256Mi floor", [jaeger_container.resources.requests.memory])
}

deny contains msg if {
	some env in jaeger_container.env
	env.name == ttl_env_name
	duration_to_minutes(env.value) > ttl_cap_minutes
	msg := sprintf("jaeger %s %s exceeds the 24h cap", [ttl_env_name, env.value])
}

deny contains msg if {
	jaeger_container.securityContext.readOnlyRootFilesystem != true
	msg := "jaeger container must set securityContext.readOnlyRootFilesystem to true"
}

deny contains msg if {
	jaeger_container
	pod_security_context.runAsNonRoot != true
	msg := "jaeger pod must set securityContext.runAsNonRoot to true"
}

deny contains msg if {
	jaeger_container
	not drops_all_capabilities
	msg := "jaeger container must drop ALL capabilities"
}

deny contains msg if {
	jaeger_container
	pod_security_context.seccompProfile.type != "RuntimeDefault"
	msg := "jaeger pod must set seccompProfile.type to RuntimeDefault"
}

drops_all_capabilities if {
	some capability in jaeger_container.securityContext.capabilities.drop
	capability == "ALL"
}

# Convert a Kubernetes memory quantity (e.g. "512Mi", "1Gi", "1024Mi") to bytes
# so thresholds compare magnitudes rather than spellings.
quantity_to_bytes(value) := bytes if {
	endswith(value, "Gi")
	bytes := to_number(trim_suffix(value, "Gi")) * 1073741824
} else := bytes if {
	endswith(value, "Mi")
	bytes := to_number(trim_suffix(value, "Mi")) * 1048576
} else := bytes if {
	endswith(value, "Ki")
	bytes := to_number(trim_suffix(value, "Ki")) * 1024
} else := to_number(value)

# Convert a Badger TTL duration (e.g. "72h", "24h", "90m") to whole minutes so
# the retention window can be compared against the cap.
duration_to_minutes(value) := minutes if {
	endswith(value, "h")
	minutes := to_number(trim_suffix(value, "h")) * 60
} else := minutes if {
	endswith(value, "m")
	minutes := to_number(trim_suffix(value, "m"))
}
