# Autolinks

Autolink scanning recognizes URLs and email addresses per GFM (GitHub Flavored Markdown) specification. The scanner supports four types: angle URL autolinks, angle email autolinks, raw URL autolinks, and WWW autolinks.

The logic is implemented in [`scan-autolink.js`](../scan-autolink.js) and is invoked from the main scanner when trigger characters are encountered.

## Angle URL Autolinks (CommonMark)

Angle URL autolinks are enclosed in `<>` and use recognized URI schemes.

### HTTP URL

<http://example.com>
12                 3
@1 AutolinkAngleOpen
@2 AutolinkAngleURL
@3 AutolinkAngleClose

### HTTPS URL

<https://example.com>
12                  3
@1 AutolinkAngleOpen
@2 AutolinkAngleURL
@3 AutolinkAngleClose

### FTP URL

<ftp://ftp.example.com>
12                    3
@1 AutolinkAngleOpen
@2 AutolinkAngleURL
@3 AutolinkAngleClose

### URL with path

<http://example.com/path/to/page>
12                              3
@1 AutolinkAngleOpen
@2 AutolinkAngleURL
@3 AutolinkAngleClose

### URL with query string

<http://example.com?key=value>
12                           3
@1 AutolinkAngleOpen
@2 AutolinkAngleURL
@3 AutolinkAngleClose

### URL with fragment

<http://example.com#section>
12                         3
@1 AutolinkAngleOpen
@2 AutolinkAngleURL
@3 AutolinkAngleClose

## Angle Email Autolinks (CommonMark)

Angle email autolinks are email addresses enclosed in `<>`.

### Simple email

<user@example.com>
12               3
@1 AutolinkAngleOpen
@2 AutolinkAngleEmail
@3 AutolinkAngleClose

### Email with dots

<john.doe@example.com>
12                   3
@1 AutolinkAngleOpen
@2 AutolinkAngleEmail
@3 AutolinkAngleClose

### Email with plus

<user+tag@example.com>
12                   3
@1 AutolinkAngleOpen
@2 AutolinkAngleEmail
@3 AutolinkAngleClose

### Email with subdomain

<user@mail.example.com>
12                    3
@1 AutolinkAngleOpen
@2 AutolinkAngleEmail
@3 AutolinkAngleClose

### Mailto URL

<mailto:user@example.com>
12                      3
@1 AutolinkAngleOpen
@2 AutolinkAngleURL
@3 AutolinkAngleClose

## Invalid Angle Autolinks

These should NOT be recognized as autolinks due to invalid format.

### Space in URL

<http://example .com>
01    2
@1 HTMLTagOpen
@2 HTMLTagName
@3 InlineText

### Space in email

<user @example.com>
01   2
@1 HTMLTagOpen
@2 HTMLTagName

### No valid scheme

<not-a-url>
01  2
@1 HTMLTagOpen
@2 HTMLTagName

### Empty angle brackets

<>
01
@1 HTMLTagOpen
@2 InlineText

### Multiple @ in email

<user@@example.com>
01   2
@1 HTMLTagOpen
@2 HTMLTagName

## Raw URL Autolinks (GFM Extension)

Raw URLs starting with http:// or https:// are recognized without angle brackets.

### Simple HTTP URL

Visit http://example.com today.
0    56                  AB
@1 InlineText
@2 Whitespace
@3 AutolinkRawURL
@4 Whitespace
@5 InlineText

### Simple HTTPS URL

Check https://github.com now.
0    56                 AB
@1 InlineText
@2 Whitespace
@3 AutolinkRawURL
@4 Whitespace
@5 InlineText

### URL with path

See http://example.com/path/to/page here.
0  34                             AB
@1 InlineText
@2 Whitespace
@3 AutolinkRawURL
@4 Whitespace
@5 InlineText

### URL with query

Link: http://example.com?key=value&other=data
1     2
@1 InlineText
@2 AutolinkRawURL

### URL at start of line

http://example.com
1
@1 AutolinkRawURL

### Multiple URLs

http://first.com and http://second.com
0               1  23 4
@1 AutolinkRawURL
@2 Whitespace
@3 InlineText
@4 Whitespace
@5 AutolinkRawURL

### URL with trailing punctuation trimmed

See http://example.com.
0  34                 A
@1 InlineText
@2 Whitespace
@3 AutolinkRawURL
@4 InlineText

### URL with parentheses

Link (http://example.com) here.
0     1                 2
@1 InlineText
@2 AutolinkRawURL
@3 InlineText

## WWW Autolinks (GFM Extension)

WWW autolinks start with www. and are recognized without a scheme.

### Simple WWW link

Visit www.example.com today.
0    56              AB
@1 InlineText
@2 Whitespace
@3 AutolinkWWW
@4 Whitespace
@5 InlineText

### WWW link at start

www.example.com
0
@1 AutolinkWWW

### WWW link with path

See www.example.com/path here.
0  34                  AB
@1 InlineText
@2 Whitespace
@3 AutolinkWWW
@4 Whitespace
@5 InlineText

### WWW link after whitespace

Check www.github.com now.
0    56            AB
@1 InlineText
@2 Whitespace
@3 AutolinkWWW
@4 Whitespace
@5 InlineText

### Not WWW (in middle of domain)

foo.www.bar.com
0
@1 InlineText

### WWW with trailing dot trimmed

Visit www.example.com.
0    56              A
@1 InlineText
@2 Whitespace
@3 AutolinkWWW
@4 InlineText

## Mixed Content

### URL and email

<http://example.com> and <user@example.com>
0 1                AB  CD E F              G
@1 AutolinkAngleOpen
@2 AutolinkAngleURL
@3 AutolinkAngleClose
@4 Whitespace
@5 InlineText
@6 Whitespace
@7 AutolinkAngleOpen
@8 AutolinkAngleEmail
@9 AutolinkAngleClose

### Multiple autolink types

Visit http://example.com or www.example.org
0    56                  AB CD
@1 InlineText
@2 Whitespace
@3 AutolinkRawURL
@4 Whitespace
@5 InlineText
@6 Whitespace
@7 AutolinkWWW

## Edge Cases

### URL at end of text

http://example.com
1
@1 AutolinkRawURL

### Angle autolink with newline breaks it

Text before
1
@1 InlineText

### Short www (only 3 chars)

ww.example.com
1
@1 InlineText

### Case insensitive www

WWW.example.com
1
@1 AutolinkWWW

### HTTPS not HTTP

https://secure.example.com
1
@1 AutolinkRawURL
