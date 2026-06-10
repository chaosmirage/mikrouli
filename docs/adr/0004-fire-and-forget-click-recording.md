# 0004 - Fire-and-Forget Click Recording

**Status:** Accepted

## Context

Every successful redirect should record a click event for analytics. The recording
involves an async write to ClickHouse via the Buffer engine. Two design
alternatives exist for how the redirect handler relates to this write:

1. **Await the analytics write** before sending the HTTP redirect response.
   The redirect latency then includes the ClickHouse insert time plus any
   network overhead to the analytics store.
2. **Dispatch the analytics write without awaiting it** (fire-and-forget).
   The redirect response is sent as soon as the URL is resolved; the analytics
   write proceeds in the background.

The redirect response carries no data derived from the analytics write; the two
operations are fully independent. Making the user wait for analytics would add
latency for no user-visible benefit.

Evidence:
- `apps/api/src/redirect/redirect.controller.ts`: the `recordStatsIfActive`
  helper calls `void stats.record(slug, req.ip, extractUa(req))`. The `void`
  operator explicitly discards the returned Promise, making the call
  fire-and-forget.
- `apps/api/src/stats/stats.service.ts`: `recordSafe` wraps the ClickHouse
  insert in a `try/catch` and calls `logger.error(...)` on failure, then
  returns normally. Errors are logged and swallowed; they do not propagate to
  the caller.

## Decision

Record click events in a fire-and-forget manner: the redirect controller
dispatches the analytics write without awaiting it, and the stats service
absorbs any insert error by logging it and returning. Redirect latency is
therefore bounded only by slug resolution, never by analytics write time.

## Alternatives Considered

- **Await the analytics write inline:** guarantees the click is recorded before
  the response is sent, but adds ClickHouse insert latency to every redirect.
  Rejected because the analytics write has no bearing on the redirect outcome.
- **Queue clicks in an in-process buffer and flush in batches:** reduces per-click
  overhead further, but requires managing queue state across process restarts
  and adds implementation complexity. The Buffer-engine table already provides
  batching at the ClickHouse layer (see ADR 0002).
- **Emit an event to a message broker:** maximally decoupled, but introduces a
  broker dependency for a path where best-effort delivery is already acceptable.

## Consequences

- Redirect p99 latency is not affected by ClickHouse availability or insert
  performance.
- Click events can be lost if the API process crashes between the redirect response
  and the ClickHouse write completing. This is an accepted trade-off: click
  analytics are best-effort by design.
- Insert errors are visible in application logs but do not surface to the user or
  affect the redirect result.
