# mikrouli docs

**mikrou.li** — URL shortener with click analytics: 6-character short
links with 302 redirects, per-link analytics, API keys. NestJS + React,
PostgreSQL + Redis (primary/replica) + ClickHouse. This tree is also built
into the local Backstage portal (TechDocs).

- [ARCHITECTURE](ARCHITECTURE.md) — full topology and rationale
- ADRs (`adr/`) — numbered architecture decision records, e.g.
  [0001 three-store persistence split](adr/0001-three-store-persistence-split.md),
  [0003 Redis cache-aside on the redirect hot path](adr/0003-redis-cache-aside-redirect-hot-path.md),
  [0007 dual auth: JWT + hashed API keys](adr/0007-dual-auth-jwt-and-hashed-api-keys.md)
