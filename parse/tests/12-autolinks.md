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
1                        2                  3
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
1                          2         3
@1 InlineText
@2 HTMLTagOpen
@3 HTMLTagName
