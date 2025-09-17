// @ts-check

import { isAsciiAlpha } from './scan-core.js';
import { EntityDecimal, EntityHex, EntityNamed } from './scan-tokens.js';

import entityMap from './scan-entity-map.json' with { type: 'json' };

/**
 * Build runtime buckets from the compact on-disk `scan-entity-map.json`.
 * The on-disk format is compact: each bucket value is a concatenated string
 * containing alternating name/replacement pieces.
 * We parse it left-to-right using the rules described in docs/2-entity-parsing.md.
 * Specifically the named entities are matched to a canonical WATWG list,
 * some legacy names can omit semicolons.
 * Numeric entities always require a semicolon.
 */
const ENTITY_BUCKETS = buildEntityBuckets(entityMap);

/**
 * Try to parse an entity starting at `start` (expected to point at '&').
 * If a valid entity is found that ends with a semicolon, return its total length
 * (including the leading '&' and trailing ';'), otherwise return 0.
 *
 * Supports:
 *  - Named entities: &name;
 *  - Decimal numeric entities: &#1234;
 *  - Hex numeric entities: &#x1A3F; or &#X1A3F;
 *
 * Note: This is a conservative parser that requires the terminating ';'.
 *
 * @param {string} input
 * @param {number} start  Index of '&'
 * @param {number} end  Exclusive end index to not read past buffer
 * @returns {import('./scan0.js').ProvisionalToken} object with length and token kind, or null if not a valid entity
 */
export function scanEntity(input, start, end) {
  if (start < 0 || start >= end) return 0;
  if (input.charCodeAt(start) !== 38 /* & */) return 0;

  let offset = start + 1;
  if (offset >= end) return 0;

  const ch = input.charCodeAt(offset);

  // Numeric entity: &#... or &#x...
  if (ch === 35 /* # */) {
    offset++;
    if (offset >= end) return 0;

    // hex?
    const cc = input.charCodeAt(offset);
    let isHex = false;
    if (cc === 120 /* x */ || cc === 88 /* X */) {
      isHex = true;
      offset++;
      if (offset >= end) return 0;
    }

    const digitsStart = offset;
    while (offset < end) {
      const d = input.charCodeAt(offset);
      if (isHex) {
        const isHexDigit = (d >= 48 && d <= 57) || (d >= 65 && d <= 70) || (d >= 97 && d <= 102);
        if (!isHexDigit) break;
      } else {
        if (!(d >= 48 && d <= 57)) break;
      }
      offset++;
    }

    // require at least one digit
    if (offset === digitsStart) return 0;
    // require terminating semicolon
    if (offset < end && input.charCodeAt(offset) === 59 /* ; */) {
      const length = offset - start + 1;
      const kind = isHex ? EntityHex : EntityDecimal;
      return length | kind;
    }
    return 0;
  }

  // Named entity: &name;
  // Only letters start named entities (not digits). Use case-preserving bucket lookup.
  if (!isAsciiAlpha(ch)) return 0;

  const firstChar = input.charAt(offset);
  const bucket = ENTITY_BUCKETS[firstChar];
  if (!bucket || bucket.length === 0) return 0;

  // Compare each candidate k (the remainder after the first letter) against input
  // starting at offset+1 (the character after the first letter). Zero-allocation
  // charCode comparisons only.
  const nameSecondIndex = offset + 1; // index where remainder comparison starts

  for (let i = 0; i < bucket.length; i++) {
    const entry = bucket[i];
    const k = entry.k;
    let j = 0;
    const klen = k.length;

    // Compare all characters of k against input
    let matched = true;
    while (j < klen) {
      const needIdx = nameSecondIndex + j;
      if (needIdx >= end) { matched = false; break; }
      if (input.charCodeAt(needIdx) !== k.charCodeAt(j)) { matched = false; break; }
      j++;
    }

    if (matched && j === klen) {
      // Full candidate matched. Consumed length = '&' + first letter + klen
      const length = klen + 2;
      const kind = EntityNamed;
      return length | kind;
    }
  }

  return 0;
}

/**
 * @param {{[k:string]: string}} raw
 * @returns {{[k:string]: {k:string,v:string}[]}}
 */
function buildEntityBuckets(raw) {
  const buckets = Object.create(null);

  /**
   * Parse a compact bucket string into {k,v} entries.
   * @param {string} s
   * @returns {{k:string,v:string}[]}
   */
  function parseBucketString(s) {
    const entries = [];
    let pos = 0;
    const len = s.length;

    while (pos < len) {
      // Find next ASCII name start
      let nameStart = -1;
      while (pos < len) {
        const cc = s.charCodeAt(pos);
        if ((cc >= 65 && cc <= 90) || (cc >= 97 && cc <= 122) || (cc >= 48 && cc <= 57)) { nameStart = pos; break; }
        pos++;
      }
      if (nameStart === -1) break;

      // Read ASCII run for name
      let i = nameStart;
      while (i < len) {
        const cc = s.charCodeAt(i);
        if (!((cc >= 65 && cc <= 90) || (cc >= 97 && cc <= 122) || (cc >= 48 && cc <= 57))) break;
        i++;
      }

      // Include trailing semicolon in name if present
      let nameEnd = i;
      if (nameEnd < len && s.charCodeAt(nameEnd) === 59 /* ; */) {
        nameEnd++;
      }

      const name = s.slice(nameStart, nameEnd);

      // Value runs until the next ASCII alnum (start of next name) or end
      let valueStart = nameEnd;
      let valueEnd = valueStart;
      while (valueEnd < len) {
        const cc = s.charCodeAt(valueEnd);
        if ((cc >= 65 && cc <= 90) || (cc >= 97 && cc <= 122) || (cc >= 48 && cc <= 57)) break;
        valueEnd++;
      }

      const value = valueEnd > valueStart ? s.slice(valueStart, valueEnd) : '';
      pos = valueEnd;

      if (name.length > 0) entries.push({ k: name, v: value });
    }

    return entries;
  }

  // Build buckets and fold two-letter buckets into parent bucket
  for (const key of Object.keys(raw)) {
    const val = String(raw[key] || '');
    if (key.length === 1) {
      buckets[key] = parseBucketString(val);
    }
  }

  // Handle two-letter buckets by folding into first-letter buckets
  for (const key of Object.keys(raw)) {
    if (key.length === 2) {
      const parent = key[0];
      const second = key[1];
      const list = parseBucketString(String(raw[key] || ''));
      if (!buckets[parent]) buckets[parent] = [];
      for (const e of list) {
        // prefix the second-letter to the parsed remainder
        buckets[parent].push({ k: second + e.k, v: e.v });
      }
    }
  }

  // Sort each bucket: lexicographically, but if one key startsWith another, the longest goes first
  /**
   * @param {{k:string,v:string}} a
   * @param {{k:string,v:string}} b2
   */
  function compareEntityEntries(a, b2) {
    if (a.k === b2.k) return 0;
    if (a.k.startsWith(b2.k)) return -1; // longer (a) before shorter (b2)
    if (b2.k.startsWith(a.k)) return 1;
    return a.k < b2.k ? -1 : 1;
  }

  for (const b of Object.keys(buckets)) {
    buckets[b].sort(compareEntityEntries);
  }

  return buckets;
}
