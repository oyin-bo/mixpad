# Autolinks

Autolinks are URLs and email addresses that are automatically recognized and converted to clickable links in rendered Markdown. MixPad implements full GFM (GitHub Flavored Markdown) autolink support, including CommonMark angle autolinks and GFM extended autolinks.

## Types of Autolinks

GFM specifies four types of autolinks:

### 1. Angle URL Autolinks (CommonMark)

URL autolinks are enclosed in angle brackets and use recognized URI schemes:

```markdown
<http://example.com>
<https://example.com/path>
<ftp://ftp.example.com>
```

**Rules:**
- Must start with a valid scheme: `http://`, `https://`, `ftp://`, or `mailto:`
- No spaces allowed inside the angle brackets
- Must end with `>`
- The scheme and rest of URI must meet basic validity requirements

### 2. Angle Email Autolinks (CommonMark)

Email autolinks are also enclosed in angle brackets:

```markdown
<user@example.com>
<john.doe+tag@subdomain.example.org>
```

**Rules:**
- Must contain exactly one `@` character
- Local part (before `@`) can contain alphanumeric, `.`, `!`, `#`, `$`, `%`, `&`, `'`, `*`, `+`, `-`, `/`, `=`, `?`, `^`, `_`, `` ` ``, `{`, `|`, `}`, `~`
- Domain part must be valid (alphanumeric and hyphens, with dots separating labels)
- No spaces allowed
- Must end with `>`

### 3. Raw URL Autolinks (GFM Extension)

Raw URLs are recognized without angle brackets if they start with `http://` or `https://`:

```markdown
Visit http://example.com for details.
Check out https://github.com/example/repo.
```

**Rules:**
- Must start with `http://` or `https://`
- Followed by valid domain and optional path
- Terminated by whitespace, `<`, or end of input
- Trailing punctuation is handled specially:
  - Trailing `.`, `,`, `:`, `*`, `_`, `~` are excluded unless they're part of a balanced construct
  - Parentheses must be balanced (closing `)` inside the URL requires matching `(`)

### 4. WWW Autolinks (GFM Extension)

WWW autolinks start with `www.` and are recognized without a scheme:

```markdown
Visit www.example.com for more information.
```

**Rules:**
- Must start with `www.` (case-insensitive)
- Followed by valid domain and optional path
- Same termination and punctuation rules as raw URL autolinks
- The implied scheme is `http://` (added during rendering)

**Important:** WWW autolinks must be preceded by the start of line or whitespace to avoid matching in the middle of words or domains (e.g., `foo.www.bar.com` should not trigger a WWW autolink).

### 5. Extended Email Autolinks (GFM Extension)

Plain email addresses are recognized without angle brackets:

```markdown
Contact us at support@example.com
```

**Rules:**
- Must contain exactly one `@` 
- Local part can contain: `a-z`, `A-Z`, `0-9`, `.`, `-`, `_`, `+`
- Domain must be valid (alphanumeric and hyphens with dots separating labels)
- Must be preceded by start of line, whitespace, or certain punctuation
- Terminated by end of line, whitespace, or certain punctuation
- Trailing punctuation (`.`, `,`, `:`, `;`) is excluded

## Token Types

The scanner emits these token types for autolinks:

- `AutolinkAngleOpen` — The opening `<` of an angle autolink
- `AutolinkAngleURL` — The URL content inside angle brackets
- `AutolinkAngleEmail` — The email content inside angle brackets
- `AutolinkAngleClose` — The closing `>` of an angle autolink
- `AutolinkRawURL` — A raw URL (http:// or https://) 
- `AutolinkWWW` — A WWW autolink (www.example.com)
- `AutolinkEmail` — A plain email address

## Token Flags

Autolink tokens may carry these flags:

- `IsAutolinkHTTP` — URL uses http:// scheme
- `IsAutolinkHTTPS` — URL uses https:// scheme  
- `IsAutolinkFTP` — URL uses ftp:// scheme
- `IsAutolinkMailto` — Email uses mailto: scheme

## Scanner Implementation

The autolink scanner (`scan-autolink.js`) is invoked from `scan0.js` at these trigger points:

1. **`<` character**: Attempts to scan angle autolinks (both URL and email)
2. **`h` character**: Checks for `http://` or `https://` raw URL autolinks
3. **`w` character**: Checks for `www.` WWW autolinks
4. **`@` character**: Scans backward to check for extended email autolinks

The scanner uses lookahead to validate autolink patterns without allocating strings, following the zero-allocation principle. All validation is performed via character code comparisons and position tracking.

## Examples

### Valid Autolinks

```markdown
Angle URL: <http://example.com>
Angle email: <user@example.com>
Raw URL: http://example.com/path
WWW: www.example.com
Email: user@example.com
```

### Invalid/Non-Autolinks

```markdown
<http://example .com> (space in URL)
<user @example.com> (space before @)
<not-a-url> (no valid scheme)
http:/ /example.com (space in scheme)
ww.example.com (missing one 'w')
user@@example.com (double @)
```

## Interaction with Other Features

- Autolinks take precedence over regular inline text
- Autolinks cannot contain other inline constructs (emphasis, code spans, etc.)
- Inside code spans and code blocks, autolink detection is disabled
- Inside HTML tags, autolink detection is disabled
- Autolinks are valid inside emphasis and other container inlines

## Performance Considerations

The autolink scanner maintains the zero-allocation property:
- All pattern matching uses character code comparisons
- No string extraction during scanning
- Token values are materialized lazily only when needed
- Position and length are packed into 31-bit integers
