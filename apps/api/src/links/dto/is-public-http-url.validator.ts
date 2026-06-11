import { registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import ipaddr = require('ipaddr.js');

// Ranges that must never be a redirect target — private, loopback, and link-local
// IPv4 and IPv6 ranges per RFC 1918, RFC 3927, RFC 4193, and RFC 4291.
const BLOCKED_IPV4_RANGES: string[] = ['private', 'loopback', 'linkLocal', 'unspecified'];
const BLOCKED_IPV6_RANGES: string[] = ['loopback', 'linkLocal', 'uniqueLocal', 'unspecified'];

/** Returns true when the given parsed address is in a blocked range. */
function isBlockedAddress(addr: ReturnType<typeof ipaddr.parse>): boolean {
  if (addr.kind() === 'ipv6') {
    const v6 = addr as ipaddr.IPv6;
    // Unwrap IPv4-mapped IPv6 (::ffff:x.x.x.x) and check the embedded IPv4 range.
    if (v6.isIPv4MappedAddress()) {
      return BLOCKED_IPV4_RANGES.includes(v6.toIPv4Address().range());
    }
    return BLOCKED_IPV6_RANGES.includes(v6.range());
  }
  return BLOCKED_IPV4_RANGES.includes((addr as ipaddr.IPv4).range());
}

/** Returns true when the URL's host is a literal IP address in a blocked range. */
function hostIsBlockedLiteralIp(urlHost: string): boolean {
  // Strip brackets from IPv6 literals (e.g. [::1] -> ::1).
  const host = urlHost.startsWith('[') && urlHost.endsWith(']') ? urlHost.slice(1, -1) : urlHost;
  if (!ipaddr.isValid(host)) return false;
  try {
    return isBlockedAddress(ipaddr.parse(host));
  } catch {
    return false;
  }
}

@ValidatorConstraint({ name: 'isPublicHttpUrl', async: false })
export class IsPublicHttpUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      return false;
    }

    // Only http and https are permitted link targets.
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

    return !hostIsBlockedLiteralIp(parsed.hostname);
  }

  defaultMessage(): string {
    return 'url must be a public http(s) URL (private, loopback, and link-local addresses are not allowed)';
  }
}

/** Validates that the value is an http(s) URL whose host is not a private, loopback, or link-local IP address. */
export function IsPublicHttpUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPublicHttpUrlConstraint,
    });
  };
}
