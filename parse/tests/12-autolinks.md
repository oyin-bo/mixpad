# GFM Autolinks

This document tests GFM autolink scanning including:
1. Angle autolinks (URL and email)
2. Raw URL autolinks (http:// and https://)
3. WWW autolinks (www.)
4. Email autolinks

## Angle Autolinks - URL

Simple URL autolink: <http://example.com>
1                    2
@1 InlineText
@2 AutolinkURL

HTTPS URL: <https://example.com>
1          2
@1 InlineText
@2 AutolinkURL

URL with path: <http://example.com/path>
1              2
@1 InlineText
@2 AutolinkURL

URL with query: <http://example.com?query=value>
1               2
@1 InlineText
@2 AutolinkURL

URL with fragment: <http://example.com#section>
1                  2
@1 InlineText
@2 AutolinkURL

URL with port: <http://example.com:8080>
1              2
@1 InlineText
@2 AutolinkURL

FTP scheme: <ftp://files.example.com>
1           2
@1 InlineText
@2 AutolinkURL

## Angle Autolinks - Email

Simple email: <user@example.com>
1             2
@1 InlineText
@2 AutolinkEmail

Email with dots: <first.last@example.com>
1                2
@1 InlineText
@2 AutolinkEmail

Email with plus: <user+tag@example.com>
1                2
@1 InlineText
@2 AutolinkEmail

Email with dash: <user-name@example.com>
1                2
@1 InlineText
@2 AutolinkEmail

Email with underscore: <user_name@example.com>
1                      2
@1 InlineText
@2 AutolinkEmail

## Raw URL Autolinks

Simple http: http://example.com
1            2
@1 InlineText
@2 AutolinkURL

Simple https: https://example.com
1             2
@1 InlineText
@2 AutolinkURL

With path: https://example.com/path/to/page
1          2
@1 InlineText
@2 AutolinkURL

With query: http://example.com?foo=bar&baz=qux
1           2
@1 InlineText
@2 AutolinkURL

With fragment: https://example.com#section
1              2
@1 InlineText
@2 AutolinkURL

## WWW Autolinks

Simple www: www.example.com
1           2
@1 InlineText
@2 AutolinkWWW

With path: www.example.com/page
1          2
@1 InlineText
@2 AutolinkWWW

With subdomain: www.sub.example.com
1               2
@1 InlineText
@2 AutolinkWWW

## Email Autolinks

Simple email: user@example.com
1             2
@1 InlineText
@2 AutolinkEmail

With subdomain: user@mail.example.com
1               2
@1 InlineText
@2 AutolinkEmail

## Trailing Punctuation

URL with trailing period: http://example.com.
1                         2                 3
@1 InlineText
@2 AutolinkURL
@3 InlineText

URL with trailing comma: http://example.com,
1                        2                 3
@1 InlineText
@2 AutolinkURL
@3 InlineText

URL with trailing question mark: http://example.com?
1                                2                 3
@1 InlineText
@2 AutolinkURL
@3 InlineText

URL with trailing exclamation: http://example.com!
1                              2                 3
@1 InlineText
@2 AutolinkURL
@3 InlineText

URL with multiple trailing punctuation: http://example.com?!.
1                                       2                 3
@1 InlineText
@2 AutolinkURL
@3 InlineText

## Balanced Parentheses

URL with balanced parens: http://example.com/page_(info)
1                         2
@1 InlineText
@2 AutolinkURL

URL with unbalanced closing paren: http://example.com/page)
1                                  2                      3
@1 InlineText
@2 AutolinkURL
@3 InlineText

URL in parentheses: (http://example.com)
1                    2                 3
@1 InlineText
@2 AutolinkURL
@3 InlineText

## Entity References at End

URL ending with entity: http://example.com&amp;
1                       2                 3
@1 InlineText
@2 AutolinkURL
@3 EntityNamed

## Negative Tests - Invalid Angle Autolinks

Angle brackets without scheme: <example.com>
1                            
@1 InlineText

Empty angle brackets: <>
1                   
@1 InlineText

Unclosed angle bracket: <http://example.com
1                      
@1 InlineText

Space in angle autolink: <http://example .com>
1                       
@1 InlineText

## Negative Tests - Invalid Raw URLs

Incomplete http: http:/example.com
1               
@1 InlineText

No slashes: http:example.com
1          
@1 InlineText

## Negative Tests - Invalid WWW

WWW without domain: www.
1                  
@1 InlineText

## Negative Tests - Invalid Emails

Email without domain: user@
1                    
@1 InlineText

Email without at: user.example.com
1                
@1 InlineText

Email with single letter TLD: user@example.c
1                            
@1 InlineText

Empty local part: @example.com
1                
@1 InlineText

## Mixed Content

Text before and after URL: Visit http://example.com today
1                                2                  3
@1 InlineText
@2 AutolinkURL
@3 InlineText

Multiple URLs: http://a.com and https://b.com
1              2            3   4
@1 InlineText
@2 AutolinkURL
@3 InlineText
@4 AutolinkURL

Email in sentence: Contact user@example.com for info
1                          2                3
@1 InlineText
@2 AutolinkEmail
@3 InlineText

WWW in text: Check www.example.com for details
1                  2               3
@1 InlineText
@2 AutolinkWWW
@3 InlineText
