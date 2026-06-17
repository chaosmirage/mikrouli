# Redis replica-to-primary replication NetworkPolicy assertion.
#
# Asserts that a rendered bundle contains the redis replica-to-primary replication edge:
# - A NetworkPolicy with Egress that permits replica pods to send TCP 6379 to primary pods.
# - A NetworkPolicy with Ingress that permits primary pods to receive TCP 6379 from replica pods.
#
# Both selectors must use component labels (app.kubernetes.io/name: redis,
# app.kubernetes.io/component: replica|primary) to prevent widening redis exposure
# in the default-deny namespace posture. A bundle lacking EITHER half is denied.
#
# Used with --combine input shape: input is an ARRAY of {path, contents} objects,
# one per rendered YAML document. Iterate the array to collect all NetworkPolicy docs.
package redis_replication

import rego.v1

# Thresholds: the replication port and required pod labels.
redis_name_label := "app.kubernetes.io/name"
redis_name := "redis"
component_label := "app.kubernetes.io/component"
primary_component := "primary"
replica_component := "replica"
replication_port := 6379

# Extract all NetworkPolicy documents from the --combine input array.
network_policies := [policy | some doc in input; policy := doc.contents; policy.kind == "NetworkPolicy"]

# Predicate: a podSelector matches both the app.kubernetes.io/name and component labels.
labels_match(selector, app_name, component) if {
	selector.matchLabels[redis_name_label] == app_name
	selector.matchLabels[component_label] == component
}

# Predicate: a podSelector selects only by app.kubernetes.io/name (bare scope, security weakness).
bare_scope_selector(selector) if {
	selector.matchLabels[redis_name_label] == redis_name
	not selector.matchLabels[component_label]
}

# Predicate: an egress rule permits TCP 6379 to a podSelector.
permits_egress_to_pods(rule, to_selector) if {
	some port in rule.ports
	port.port == replication_port
	some to in rule.to
	labels_match(to.podSelector, redis_name, primary_component)
}

# Predicate: an ingress rule permits TCP 6379 from a podSelector.
permits_ingress_from_pods(rule, from_selector) if {
	some port in rule.ports
	port.port == replication_port
	some from in rule.from
	labels_match(from.podSelector, redis_name, replica_component)
}

# Predicate: some NetworkPolicy is an egress rule from replica to primary.
has_replica_egress_to_primary if {
	some policy in network_policies
	"Egress" in policy.spec.policyTypes
	labels_match(policy.spec.podSelector, redis_name, replica_component)
	some rule in policy.spec.egress
	permits_egress_to_pods(rule, rule.to)
}

# Predicate: some NetworkPolicy is an ingress rule to primary from replica.
has_primary_ingress_from_replica if {
	some policy in network_policies
	"Ingress" in policy.spec.policyTypes
	labels_match(policy.spec.podSelector, redis_name, primary_component)
	some rule in policy.spec.ingress
	permits_ingress_from_pods(rule, rule.from)
}

# Deny if replica egress to primary is missing.
deny contains msg if {
	not has_replica_egress_to_primary
	msg := "missing egress from redis replica to primary on TCP 6379"
}

# Deny if primary ingress from replica is missing.
deny contains msg if {
	not has_primary_ingress_from_replica
	msg := "missing ingress to redis primary from replica on TCP 6379"
}
