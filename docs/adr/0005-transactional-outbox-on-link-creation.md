# 0005 - Transactional Outbox on Link Creation

**Status:** Accepted

## Context

When a link is created, the application needs to notify downstream consumers
(for example, to propagate the new link to other systems or trigger follow-on
processing). The naive approach is to write the link to Postgres and then
publish an event to a broker or external system. This creates a dual-write
problem: if the publish step fails after the Postgres commit, the event is
lost; if the Postgres commit fails after a successful publish, a ghost event
is emitted for a link that does not exist.

The transactional outbox pattern solves the dual-write problem by writing the
event record into the same Postgres transaction as the link row. The outbox row
is either committed with the link or rolled back with it, guaranteeing atomicity.
A separate process (or the application itself) can then relay the outbox row to
downstream consumers and mark it processed.

Evidence:
- `apps/api/src/links/links.service.ts`: `insertLinkWithOutbox` uses
  `dataSource.transaction(manager => ...)` to insert both a `Link` row and an
  `Outbox` row in a single transaction.
- `apps/api/src/outbox/entities/outbox.entity.ts`: the `Outbox` entity stores
  `aggregateType`, a `payload` JSONB column, and a nullable `processedAt`
  timestamp.
- `apps/api/src/migrations/1700000000003-CreateLinksAndOutbox.ts` provisions
  both tables in the same migration.

## Decision

Write a transactional outbox row atomically with every link creation.
The `Link` insert and the `Outbox` insert share a single Postgres transaction.
If either fails the entire transaction rolls back, guaranteeing that an outbox
row is never created without its corresponding link, and vice versa.

The outbox table records `aggregateType` (e.g. `link_created`), a JSONB
`payload` (slug + original URL), and a `processedAt` nullable timestamp for
relay tracking.

## Alternatives Considered

- **Publish directly to a message broker during the HTTP request:** fast but
  introduces the dual-write hazard; a broker failure or network partition after
  the Postgres commit loses the event permanently.
- **Periodic Postgres polling without an outbox column:** polling
  `links` for new rows achieves similar at-least-once semantics but requires
  a cursor or watermark, does not generalize to other event types, and
  complicates the relay logic.
- **Event sourcing (append-only event log as the source of truth):** stronger
  guarantees but a significant architectural shift and much higher implementation
  complexity for this scale.

## Consequences

- Link creation events cannot be lost due to a post-commit broker failure; the
  outbox row survives until a relay process marks it processed.
- The Postgres transaction wrapping both inserts means that any database error
  during outbox row insertion causes the entire link creation to roll back,
  preserving consistency.
- A relay process is required to consume and forward outbox rows; that component
  is outside the current scope but the outbox table is ready for it.
- Postgres becomes the single dependency for link creation atomicity; there is
  no broker required in the write path.
