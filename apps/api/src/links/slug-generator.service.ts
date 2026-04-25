import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';

/**
 * Slug alphabet — exactly 61 characters:
 *   digits(10) + lowercase(26, all letters) + uppercase(24, exclude O and I) + underscore(1)
 *
 * The visually-ambiguous uppercase letters O (resembles 0) and I (resembles 1 / l)
 * are excluded so a printed or hand-typed slug is unambiguous. Lowercase l is kept
 * because the lowercase set is committed to be exhaustive (a-z)
 */
export const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ_';
export const SLUG_LENGTH = 6;
const MAX_BYTE = ALPHABET.length * Math.floor(256 / ALPHABET.length); // 244 — bias-free ceiling
const REJECTION_BUFFER = 2; // extra bytes absorb the ~4.7% rejection rate per byte

/** Maps one random byte to an alphabet index. Returns null when the byte must be rejected. */
function byteToIndex(byte: number): number | null {
  if (byte >= MAX_BYTE) return null;
  return byte % ALPHABET.length;
}

/** Appends accepted chars from buffer to acc until acc reaches SLUG_LENGTH. */
function takeChars(buffer: Buffer, acc: string): string {
  let next = acc;
  for (let i = 0; i < buffer.length && next.length < SLUG_LENGTH; i++) {
    const idx = byteToIndex(buffer[i]!);
    if (idx !== null) next += ALPHABET[idx];
  }
  return next;
}

/** Builds a SLUG_LENGTH-character slug via bias-free rejection sampling. */
function buildSlug(): string {
  let slug = '';
  while (slug.length < SLUG_LENGTH) slug = takeChars(randomBytes(SLUG_LENGTH - slug.length + REJECTION_BUFFER), slug);
  return slug;
}

@Injectable()
export class SlugGeneratorService {
  generate(): string {
    return buildSlug();
  }
}
