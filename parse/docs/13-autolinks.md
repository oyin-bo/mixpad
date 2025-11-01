# GFM Autolinks

This document describes the implementation of GitHub Flavored Markdown (GFM) autolinks in MixPad's scanner.

## Overview

Autolinks are URLs and email addresses that are automatically converted to clickable links. GFM supports four types of autolinks:

1. **Angle Autolinks** (CommonMark standard)
   - URL autolinks: `<http://example.com>`
   - Email autolinks: `<user@example.com>`

2. **Raw URL Autolinks** (GFM extension)
   - HTTP/HTTPS URLs: `http://example.com` or `https://example.com`

3. **WWW Autolinks** (GFM extension)
   - WWW-prefixed URLs: `www.example.com`

4. **Email Autolinks** (GFM extension)
   - Email addresses: `user@example.com` (not yet implemented)

## Token Types

The scanner emits the following token types for autolinks:

### Angle Autolinks
- `AngleLinkOpen` (0x2E0000): The opening `<` bracket
- `AngleLinkURL` (0x2F0000): The URL content (for URL autolinks)
- `AngleLinkEmail` (0x300000): The email content (for email autolinks)
- `AngleLinkClose` (0x310000): The closing `>` bracket

### GFM Extension Autolinks
- `RawURL` (0x320000): Raw HTTP/HTTPS URL without angle brackets
- `WWWAutolink` (0x330000): WWW-prefixed URL
- `EmailAutolink` (0x340000): Email address (not yet implemented)

## Implementation

### Angle Autolinks (`scan-autolink-angle.js`)

Angle autolinks are enclosed in angle brackets `<...>` and come in two forms:

**URL Autolinks:**
- Must start with a valid URI scheme (letters, digits, `+`, `-`, `.`)
- Scheme must be followed by `:`
- Content after `:` must not contain spaces
- No line breaks or unescaped `<` or `>` allowed inside
- Common schemes: `http`, `https`, `ftp`, `mailto`

**Email Autolinks:**
- Match pattern: `local-part@domain-part`
- Local part: alphanumeric and special chars (`.`, `-`, `_`, `+`)
- Domain part: alphanumeric, dots, hyphens
- Must have at least one dot in domain
- Domain must not end with a dot or hyphen

The scanner tries to determine if the content is a URL or email by looking for:
1. A colon (`:`) before any `@` → likely a URL
2. An `@` with valid email pattern → likely an email

### Raw URL Autolinks (`scan-autolink-raw.js`)

Raw URL autolinks are automatically recognized URLs starting with `http://` or `https://`:

**Recognition:**
- Must start with literal `http://` or `https://` (case-sensitive)
- Must have at least one character after the scheme
- Must contain at least one dot in the domain portion

**Boundary Detection:**
- Stops at whitespace, line breaks, or `<` character
- Handles balanced parentheses (e.g., `http://example.com/path(1)`)
- Excludes trailing punctuation: `.`, `,`, `:`, `;`, `!`, `?`
- Unmatched closing parenthesis `)` is excluded

**Examples:**
```
Valid: http://example.com
Valid: https://example.com/path?query=value
Valid: http://example.com/page(section)
Excluded: http://example.com.  (period excluded)
```

### WWW Autolinks (`scan-autolink-www.js`)

WWW autolinks are URLs starting with `www.`:

**Recognition:**
- Must start with literal `www.` (case-sensitive)
- Must be preceded by start of line or non-alphanumeric character
- Must have at least one more dot after `www.`

**Boundary Detection:**
- Same rules as raw URL autolinks
- Handles balanced parentheses
- Excludes trailing punctuation

**Examples:**
```
Valid: www.example.com
Valid: www.example.com/path
Invalid: awww.example.com  (preceded by alphanumeric)
Invalid: www  (no dot after www.)
```

### Email Autolinks (`scan-autolink-email.js`)

Email autolinks are recognized at `@` signs (currently not integrated):

**Recognition:**
- Must not be preceded by alphanumeric or hyphen
- Must not be followed by alphanumeric, hyphen, or underscore
- Scans backwards from `@` to find start of local part
- Scans forward from `@` to find end of domain part

**Note:** The email autolink scanner exists but is not yet fully integrated into `scan0.js` due to its complexity (requires backward scanning).

## Integration in scan0.js

The autolink scanners are integrated into the main scanner dispatch:

### Angle Autolinks (case 60: `<`)
- Tried **before** HTML tag scanning to avoid conflicts
- If recognized as valid autolink, emits 3 tokens and continues
- If not valid, falls through to HTML tag scanning

### Raw URL Autolinks (case 104: `h`)
- Tried when encountering 'h' character
- Checks for `http://` or `https://` prefix
- Emits single `RawURL` token if valid
- Falls back to `InlineText` if not valid

### WWW Autolinks (case 119: `w`)
- Tried when encountering 'w' character
- Checks for `www.` prefix and valid preceding character
- Emits single `WWWAutolink` token if valid
- Falls back to `InlineText` if not valid

### Email Autolinks (case 64: `@`)
- Currently stubbed out
- Falls back to `InlineText` handling
- Future implementation will handle backward scanning

## Pattern Classification

The scanners follow MixPad's scanner patterns:

- **Pattern A (Primitive)**: Returns token directly
  - `scanRawURLAutolink`: Returns `RawURL | length` or 0
  - `scanWWWAutolink`: Returns `WWWAutolink | length` or 0
  - `scanEmailAutolink`: Returns `EmailAutolink | length` or 0 (not integrated)

- **Pattern B (Orchestration)**: Emits tokens, returns consumed length
  - `scanAngleAutolink`: Emits 3 tokens, returns total consumed length or 0

## Testing

All autolink implementations are tested in `parse/tests/12-autolinks.md` using the annotated markdown test format:

- Angle autolinks (URL and email): 10 test cases
- Raw URL autolinks: 9 test cases  
- WWW autolinks: 4 test cases
- Edge cases: invalid/boundary cases

Each test case verifies:
- Correct token type emission
- Correct token boundaries
- Proper handling of edge cases (trailing punctuation, parentheses, etc.)

## Performance Considerations

Autolink scanning is designed to be fast and allocation-free:

- No string allocations during scanning
- Simple character-by-character inspection
- Early rejection of non-matching patterns
- Inline character code comparisons (no string methods)

## Future Work

1. **Email Autolinks**: Integrate the email scanner into `scan0.js` with proper backward scanning support
2. **Extended URL Schemes**: Consider supporting additional schemes beyond http/https
3. **Unicode Support**: Handle international domain names (IDN)
4. **Performance Optimization**: Profile and optimize hot paths if needed

## References

- [CommonMark Specification - Autolinks](https://spec.commonmark.org/0.30/#autolinks)
- [GFM Specification - Autolinks (extension)](https://github.github.com/gfm/#autolinks-extension-)
