# GFM Autolinks

This file tests the four types of autolinks supported:
1. Angle autolinks (CommonMark): `<url>` and `<email>`
2. Raw URL autolinks (GFM): `http://` and `https://`
3. WWW autolinks (GFM): `www.`
4. Email autolinks (GFM): `user@domain` (TODO)

## Angle Autolinks - URL

Simple HTTP URL: <http://example.com>
                 12                 3
@1 AngleLinkOpen
@2 AngleLinkURL
@3 AngleLinkClose

HTTPS URL: <https://example.com>
           12                  3
@1 AngleLinkOpen
@2 AngleLinkURL
@3 AngleLinkClose

FTP URL: <ftp://files.example.com>
         12                      3
@1 AngleLinkOpen
@2 AngleLinkURL
@3 AngleLinkClose

URL with path: <http://example.com/path/to/page>
               12                              3
@1 AngleLinkOpen
@2 AngleLinkURL
@3 AngleLinkClose

URL with query: <http://example.com?query=value>
                12                             3
@1 AngleLinkOpen
@2 AngleLinkURL
@3 AngleLinkClose

Mailto URL: <mailto:user@example.com>
            12                      3
@1 AngleLinkOpen
@2 AngleLinkURL
@3 AngleLinkClose

## Angle Autolinks - Email

Simple email: <user@example.com>
              12               3
@1 AngleLinkOpen
@2 AngleLinkEmail
@3 AngleLinkClose

Email with dots: <first.last@example.com>
                 12                     3
@1 AngleLinkOpen
@2 AngleLinkEmail
@3 AngleLinkClose

Email with plus: <user+tag@example.com>
                 12                   3
@1 AngleLinkOpen
@2 AngleLinkEmail
@3 AngleLinkClose

Email with subdomain: <user@mail.example.com>
                      12                    3
@1 AngleLinkOpen
@2 AngleLinkEmail
@3 AngleLinkClose

## Raw URL Autolinks

HTTP URL: http://example.com
1         2
@1 InlineText
@2 RawURL

HTTPS URL: https://example.com
1          2
@1 InlineText
@2 RawURL

URL with path: http://example.com/path
1              2
@1 InlineText
@2 RawURL

URL with query: http://example.com?query=value
1               2
@1 InlineText
@2 RawURL

URL with fragment: http://example.com#section
1                  2
@1 InlineText
@2 RawURL

URL in parentheses: (http://example.com)
1                    2                 3
@1 InlineText
@2 RawURL
@3 InlineText

URL with balanced parens: http://example.com/path(1)
1                         2
@1 InlineText
@2 RawURL

URL with trailing period: http://example.com.
1                         2                 3
@1 InlineText
@2 RawURL
@3 InlineText

URL with trailing comma: http://example.com,
1                        2                 3
@1 InlineText
@2 RawURL
@3 InlineText

## WWW Autolinks

WWW link: www.example.com
1         2
@1 InlineText
@2 WWWAutolink

WWW with path: www.example.com/path
1              2
@1 InlineText
@2 WWWAutolink

WWW with subdomain: www.mail.example.com
1                   2
@1 InlineText
@2 WWWAutolink

WWW with trailing period: www.example.com.
1                         2              3
@1 InlineText
@2 WWWAutolink
@3 InlineText

## Not Autolinks

Not a URL (no scheme): example.com
1
@1 InlineText

Not a WWW (no dot after): www
1
@1 InlineText

Partial HTTP: http:example.com
1
@1 InlineText

Angle bracket but invalid: <not-a-url>
1                          23
@1 InlineText
@2 HTMLTagOpen
@3 HTMLTagName

## Comprehensive Edge Cases

### URL at start of line

http://example.com
1
@1 RawURL

### URL at end of sentence with period

Visit http://example.com.
1     2                 3
@1 InlineText
@2 RawURL
@3 InlineText

### URL at end of sentence with comma

Visit http://example.com, then leave.
1     2                 3
@1 InlineText
@2 RawURL
@3 InlineText

### URL at end of sentence with semicolon

Visit http://example.com; it's great.
1     2                 3
@1 InlineText
@2 RawURL
@3 InlineText

### URL at end of sentence with colon

Check this: http://example.com:
1           2                 3
@1 InlineText
@2 RawURL
@3 InlineText

### URL at end of sentence with exclamation

Amazing http://example.com!
1       2                 3
@1 InlineText
@2 RawURL
@3 InlineText

### URL at end of sentence with question mark

See http://example.com?
1   2                 3
@1 InlineText
@2 RawURL
@3 InlineText

### Multiple URLs in text

Visit http://first.com and http://second.com today.
1     2                3   4
@1 InlineText
@2 RawURL
@3 InlineText
@4 RawURL

### URL with balanced parentheses in path

Link: http://example.com/page(section)
1     2
@1 InlineText
@2 RawURL

### URL with multiple balanced parentheses

See http://example.com/path(a)(b)
1   2
@1 InlineText
@2 RawURL

### URL with unbalanced closing paren excluded

Link (http://example.com))
1     2                 3
@1 InlineText
@2 RawURL
@3 InlineText

### URL before entity reference

Visit http://example.com&nbsp;here
1     2                 3     4
@1 InlineText
@2 RawURL
@3 EntityNamed
@4 InlineText

### WWW at start of line

www.example.com
1
@1 WWWAutolink

### WWW after whitespace

Visit www.github.com now.
1     2              3
@1 InlineText
@2 WWWAutolink
@3 InlineText

### WWW with trailing punctuation trimmed

Visit www.example.com.
1     2              3
@1 InlineText
@2 WWWAutolink
@3 InlineText

### Not WWW when in middle of word

foo.www.bar.com
1
@1 InlineText

### Case insensitive WWW detection

WWW.example.com
1
@1 WWWAutolink

### URL with port number

http://example.com:8080/path
1
@1 RawURL

### URL with username

http://user@example.com/path
1
@1 RawURL

### URL with complex query string

http://example.com?a=1&b=2&c=3
1
@1 RawURL

### Angle URL with fragment

<http://example.com#section>
12                         3
@1 AngleLinkOpen
@2 AngleLinkURL
@3 AngleLinkClose

### Mixed autolink types

Visit http://example.com or www.example.org
1     2                  3  4
@1 InlineText
@2 RawURL
@3 InlineText
@4 WWWAutolink

### Angle and raw URLs

<http://example.com> and http://other.com
12                 3     4
@1 AngleLinkOpen
@2 AngleLinkURL
@3 AngleLinkClose
@4 RawURL

### Empty angle brackets

<>
12
@1 HTMLTagOpen
@2 InlineText

### Angle with just scheme

<http://>
12      3
@1 AngleLinkOpen
@2 AngleLinkURL
@3 AngleLinkClose

### Angle email without domain dot

<user@example>
01          2
@1 HTMLTagOpen
@2 HTMLTagName

### URL with only scheme (no //)

http:example.com
1
@1 InlineText

### Short www (only 2 chars)

ww.example.com
1
@1 InlineText

### www without second dot

www.example
1
@1 InlineText
