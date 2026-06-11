# dto

## Purpose

Defines and validates the request shapes for link creation. Enforces that
submitted URLs are syntactically valid http(s) URLs and that their host is not a
private, loopback, or link-local address (SSRF prevention).

## Key pieces

- `create-link.dto.ts` -- `CreateLinkDto`. Applies two validators to the `url`
  field: `@IsUrl` (from class-validator) for protocol and length constraints, and
  `@IsPublicHttpUrl` to block literal private / loopback / link-local IP
  addresses. The `expiresAt` field is optional.
- `is-public-http-url.validator.ts` -- `IsPublicHttpUrlConstraint`. Parses the
  URL with the WHATWG `URL` constructor, then uses `ipaddr.js` to check the
  hostname. Returns false for IPv4 ranges private / loopback / linkLocal /
  unspecified and IPv6 ranges loopback / linkLocal / uniqueLocal / unspecified.
  IPv4-mapped IPv6 addresses (`::ffff:x.x.x.x`) are unwrapped and checked as
  IPv4. Hostname-based URLs (non-IP) pass the IP check.

## How to extend safely

- The `@IsUrl` decorator handles protocol allow-list and length; `@IsPublicHttpUrl`
  handles IP-range blocking. Both must be present on the `url` field -- removing
  either weakens the combined guarantee.
- DNS-based SSRF (hostnames that resolve to private IPs at request time) is out
  of scope for this validator; it is a static check on the literal URL value.
- To add a new blocked range, update both `BLOCKED_IPV4_RANGES` and
  `BLOCKED_IPV6_RANGES` in `is-public-http-url.validator.ts` using the range
  names recognized by `ipaddr.js`.
- The validator does not reject hostname-based private addresses (e.g.
  `http://internal-host/`) -- only literal IP addresses are checked.
