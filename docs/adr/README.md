# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the Mikrouli
URL-shortener project. Each record documents a real technical decision
embodied in the codebase: the context that motivated it, the decision made,
the alternatives that were considered, and the consequences.

Records follow the Nygard lightweight format and are numbered sequentially.
Once accepted, an ADR is not rewritten; superseded records are marked
accordingly and a new record describes the replacement decision.

| Number | Title | Status |
| --- | --- | --- |
| [0001](0001-three-store-persistence-split.md) | Three-Store Persistence Split | Accepted |
| [0002](0002-clickhouse-for-click-analytics.md) | ClickHouse for Click Analytics with Buffer-Engine Ingestion | Accepted |
| [0003](0003-redis-cache-aside-redirect-hot-path.md) | Redis Cache-Aside on the Redirect Hot Path | Accepted |
| [0004](0004-fire-and-forget-click-recording.md) | Fire-and-Forget Click Recording | Accepted |
| [0005](0005-transactional-outbox-on-link-creation.md) | Transactional Outbox on Link Creation | Accepted |
| [0006](0006-contract-first-api-typespec-openapi-rfc9457.md) | Contract-First API via TypeSpec / OpenAPI with RFC 9457 Error Shape | Accepted |
| [0007](0007-dual-auth-jwt-and-hashed-api-keys.md) | Dual Authentication: JWT Sessions and Bcrypt-Hashed API Keys | Accepted |
| [0008](0008-k3s-hetzner-default-deny-network-policies.md) | k3s on Hetzner with Default-Deny Network Policies and a Cost Ceiling | Accepted |
| [0009](0009-opentelemetry-tracing.md) | End-to-End OpenTelemetry Tracing | Accepted |
| [0010](0010-expired-link-lifecycle-410-and-hourly-cleanup.md) | Expired-Link Lifecycle: 410 Gone and Hourly Batch Cleanup | Accepted |
