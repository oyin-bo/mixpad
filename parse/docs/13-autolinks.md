# GFM Autolinks

This document describes the implementation of GFM (GitHub Flavored Markdown) autolinks in MixPad.

## Overview

GFM autolinks are a Markdown extension that automatically converts certain text patterns into clickable links without requiring explicit link syntax. MixPad implements four types of autolinks:

1. **Angle Autolinks** (CommonMark standard)
   - URL autolinks: `<http://example.com>`
   - Email autolinks: `<user@example.com>`

2. **Raw URL Autolinks** (GFM extension)
   - HTTP/HTTPS: `http://example.com` or `https://example.com`

3. **WWW Autolinks** (GFM extension)
   - WWW prefix: `www.example.com`

4. **Email Autolinks** (GFM extension)
   - Email addresses: `user@example.com`

## Token Kinds

The autolink scanner emits three token kinds defined in `scan-tokens.js`:

- `AutolinkURL` (0x2E0000): For URL autolinks (angle, raw HTTP/HTTPS, WWW)
- `AutolinkEmail` (0x2F0000): For email autolinks (angle and raw)
- `AutolinkWWW` (0x300000): For WWW autolinks specifically

## Scanner Module

The autolink scanner is implemented in `scan-autolink.js` and exports a single function:

```javascript
scanAutolink(input, start, end)
```

This function:
- Takes the input string and position range
- Returns a packed token (kind | length) or 0 if no autolink matched
- Handles all four types of autolinks with appropriate validation

## Integration with scan0

The autolink scanner is integrated into `scan0.js` at multiple points:

1. **For `<` character**: Angle autolinks are checked before HTML tag parsing
2. **For `h/H` and `w/W` characters**: Raw URL and WWW autolinks are checked
3. **In default case**: Email autolinks are checked for alphanumeric starts

This integration ensures autolinks are recognized early in the scanning process while preserving the priority of other Markdown constructs.

## Angle Autolinks

### URL Autolinks

Format: `<scheme:rest>`

- Must start with `<`
- Scheme must begin with ASCII letter followed by alphanumeric, `+`, `-`, or `.`
- Scheme must be followed by `:`
- No spaces or `<` characters allowed in the URL
- Must end with `>`

Valid examples:
- `<http://example.com>`
- `<https://example.com/path?query=value#fragment>`
- `<ftp://files.example.com>`

### Email Autolinks

Format: `<local@domain>`

- Must start with `<`
- Local part: alphanumeric, `.`, `-`, `_`, `+`
- Must contain `@`
- Domain part: alphanumeric, `-`, `_`, with segments separated by `.`
- No spaces or `<` characters allowed
- Must end with `>`

Valid examples:
- `<user@example.com>`
- `<first.last@example.com>`
- `<user+tag@example.com>`

## Raw URL Autolinks

Format: `http://domain...` or `https://domain...`

- Must start with `http://` or `https://` (case-insensitive)
- Followed by valid URL characters (anything except space, `<`, `>`)
- Trailing punctuation rules apply

Valid examples:
- `http://example.com`
- `https://example.com/path?query=value`

## WWW Autolinks

Format: `www.domain...`

- Must start with `www.` (case-insensitive)
- Followed by valid URL characters
- Trailing punctuation rules apply

Valid examples:
- `www.example.com`
- `www.sub.example.com/page`

## Email Autolinks

Format: `local@domain`

- Local part: one or more characters from alphanumeric, `.`, `-`, `_`, `+`
- Must contain `@`
- Domain: segments separated by `.`
- Last segment must be at least 2 alphabetic characters
- Trailing punctuation rules apply

Valid examples:
- `user@example.com`
- `first.last@example.com`
- `user@mail.example.com`

## Trailing Punctuation Rules

For raw URL, WWW, and email autolinks, GFM specifies trailing punctuation handling:

### Stripped Characters

The following characters are stripped from the end:
- `?`, `!`, `.`, `,`, `:`, `*`, `_`, `~`

Example: `http://example.com.` → autolink is `http://example.com`, `.` is separate

### Balanced Parentheses

- Opening `(` and closing `)` within the URL are counted
- Trailing `)` is only removed if there are more closing than opening parentheses
- This allows URLs with balanced parentheses to work correctly

Examples:
- `http://example.com/page_(info)` → entire URL is the autolink
- `http://example.com/page)` → autolink is `http://example.com/page`, `)` is separate
- `(http://example.com)` → autolink is `http://example.com`, parentheses are separate

### Entity References

If the URL ends with a pattern that looks like an HTML entity reference (`&...;`), the entity is excluded from the autolink.

Example: `http://example.com&amp;` → autolink is `http://example.com`, `&amp;` is separate

## Validation Rules

### URL Validation

For raw URLs and WWW autolinks:
- Must have at least one valid URL character after the prefix
- Valid URL characters are any character except space, `<`, `>`

### Email Validation

For email autolinks:
- Local part cannot be empty
- Domain cannot be empty
- Last domain segment must be at least 2 characters
- Last domain segment must be all alphabetic characters

### Negative Cases

The scanner correctly rejects:
- Incomplete schemes: `http:/example.com`
- Missing domain: `www.`
- Invalid emails: `user@`, `@example.com`, `user@example.c`
- Malformed angle autolinks: `<example.com>`, `<http://example .com>`

## Testing

Comprehensive tests are provided in `parse/tests/12-autolinks.md` covering:
- All four autolink types
- Valid and invalid cases
- Trailing punctuation handling
- Balanced parentheses
- Entity reference handling
- Mixed content scenarios

Run tests with:
```bash
npm test
```

To run only autolink tests:
```bash
node --test --test-name-pattern="autolinks" parse/tests/test-produce-annotated.js
```

## Performance Considerations

The autolink scanner follows MixPad's zero-allocation philosophy:
- No string allocations during scanning
- Character-by-character validation using character codes
- Early returns for invalid patterns
- Packed 32-bit token representation

## Compliance

The implementation follows:
- CommonMark 0.30 specification for angle autolinks
- GitHub Flavored Markdown specification for extended autolinks
- Trailing punctuation rules as specified in GFM

## Future Enhancements

Potential areas for enhancement:
- Support for additional schemes (mailto:, tel:, etc.)
- More sophisticated URL validation
- Internationalized domain names (IDN) support
- Punycode handling for international emails
