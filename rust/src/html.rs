//! HTML / XML scanners. MixPad treats HTML as first-class syntax, so these emit
//! structured tokens (tag open/name/attributes/close) rather than opaque text.

use crate::scanners::scan_entity;
use crate::token::kind::*;
use crate::token::{token_len, ERROR_UNBALANCED};

fn matches_tag_name(input: &[u8], start: usize, length: usize, expected: &[u8]) -> bool {
    if length != expected.len() {
        return false;
    }
    for i in 0..length {
        let ch = input[start + i];
        let exp = expected[i];
        if ch != exp && ch != exp.wrapping_sub(32) {
            return false;
        }
    }
    true
}

/// Void (self-closing) HTML elements.
pub fn is_void_element(input: &[u8], start: usize, length: usize) -> bool {
    match length {
        2 => {
            matches_tag_name(input, start, length, b"br")
                || matches_tag_name(input, start, length, b"hr")
        }
        3 => {
            matches_tag_name(input, start, length, b"col")
                || matches_tag_name(input, start, length, b"img")
                || matches_tag_name(input, start, length, b"wbr")
        }
        4 => {
            matches_tag_name(input, start, length, b"area")
                || matches_tag_name(input, start, length, b"base")
                || matches_tag_name(input, start, length, b"link")
                || matches_tag_name(input, start, length, b"meta")
        }
        5 => {
            matches_tag_name(input, start, length, b"embed")
                || matches_tag_name(input, start, length, b"input")
                || matches_tag_name(input, start, length, b"param")
                || matches_tag_name(input, start, length, b"track")
        }
        6 => matches_tag_name(input, start, length, b"source"),
        _ => false,
    }
}

/// Raw-text HTML elements whose content is not parsed as Markdown.
pub fn is_raw_text_element(input: &[u8], start: usize, length: usize) -> bool {
    match length {
        5 => matches_tag_name(input, start, length, b"style"),
        6 => matches_tag_name(input, start, length, b"script"),
        8 => matches_tag_name(input, start, length, b"textarea"),
        _ => false,
    }
}

/// `<!-- comment -->`
pub fn scan_html_comment(input: &[u8], start: usize, end: usize, out: &mut Vec<u32>) -> usize {
    if start + 4 > end {
        return 0;
    }
    if input[start] != b'<' || input[start + 1] != b'!' || input[start + 2] != b'-' || input[start + 3] != b'-'
    {
        return 0;
    }
    let open_index = out.len();
    out.push(4 | HTML_COMMENT_OPEN);
    let content_start = start + 4;
    let mut offset = content_start;
    while offset < end {
        if input[offset] == b'-'
            && offset + 2 < end
            && input[offset + 1] == b'-'
            && input[offset + 2] == b'>'
        {
            let content_len = offset - content_start;
            if content_len > 0 {
                out.push(content_len as u32 | HTML_COMMENT_CONTENT);
            }
            out.push(3 | HTML_COMMENT_CLOSE);
            return offset - start + 3;
        }
        offset += 1;
    }
    out[open_index] |= ERROR_UNBALANCED;
    let content_len = end - content_start;
    if content_len > 0 {
        out.push(content_len as u32 | HTML_COMMENT_CONTENT | ERROR_UNBALANCED);
    }
    end - start
}

/// `<![CDATA[ ... ]]>`
pub fn scan_html_cdata(input: &[u8], start: usize, end: usize, out: &mut Vec<u32>) -> usize {
    if start + 9 > end {
        return 0;
    }
    if &input[start..start + 9] != b"<![CDATA[" {
        return 0;
    }
    let open_index = out.len();
    out.push(9 | HTML_CDATA_OPEN);
    let content_start = start + 9;
    let mut close_offset: i64 = -1;
    let mut i = content_start;
    while i < end {
        if input[i] == b']' && i + 2 < end && input[i + 1] == b']' && input[i + 2] == b'>' {
            close_offset = i as i64;
            break;
        }
        i += 1;
    }
    if close_offset >= 0 {
        let close_offset = close_offset as usize;
        let content_len = close_offset - content_start;
        if content_len > 0 {
            out.push(content_len as u32 | HTML_CDATA_CONTENT);
        }
        out.push(3 | HTML_CDATA_CLOSE);
        return close_offset - start + 3;
    }
    out[open_index] |= ERROR_UNBALANCED;
    let content_len = end - content_start;
    if content_len > 0 {
        out.push(content_len as u32 | HTML_CDATA_CONTENT | ERROR_UNBALANCED);
    }
    end - start
}

/// `<!DOCTYPE ...>`
pub fn scan_html_doctype(input: &[u8], start: usize, end: usize, out: &mut Vec<u32>) -> usize {
    if start + 2 > end || input[start] != b'<' || input[start + 1] != b'!' {
        return 0;
    }
    let mut offset = start + 2;
    let expected = b"DOCTYPE";
    if offset + 7 > end {
        return 0;
    }
    for (i, &exp) in expected.iter().enumerate() {
        let ch = input[offset];
        if ch != exp && ch != exp + 32 {
            let _ = i;
            return 0;
        }
        offset += 1;
    }
    let open_index = out.len();
    out.push(9 | HTML_DOCTYPE_OPEN);
    let content_start = offset;
    let mut bracket_depth: i64 = 0;
    while offset < end {
        let ch = input[offset];
        if ch == b'[' {
            bracket_depth += 1;
            offset += 1;
        } else if ch == b']' {
            bracket_depth -= 1;
            offset += 1;
        } else if ch == b'>' && bracket_depth == 0 {
            let content_len = offset - content_start;
            if content_len > 0 {
                out.push(content_len as u32 | HTML_DOCTYPE_CONTENT);
            }
            out.push(1 | HTML_DOCTYPE_CLOSE);
            return offset - start + 1;
        } else if ch == b'\n' || ch == b'\r' || ch == b'<' {
            let content_len = offset - content_start;
            if content_len > 0 {
                out.push(content_len as u32 | HTML_DOCTYPE_CONTENT | ERROR_UNBALANCED);
            }
            out[open_index] |= ERROR_UNBALANCED;
            return offset - start;
        } else {
            offset += 1;
        }
    }
    let content_len = offset - content_start;
    if content_len > 0 {
        out.push(content_len as u32 | HTML_DOCTYPE_CONTENT | ERROR_UNBALANCED);
    }
    out[open_index] |= ERROR_UNBALANCED;
    offset - start
}

/// `<?target ... ?>`
pub fn scan_xml_pi(input: &[u8], start: usize, end: usize, out: &mut Vec<u32>) -> usize {
    if start + 2 > end || input[start] != b'<' || input[start + 1] != b'?' {
        return 0;
    }
    let mut offset = start + 2;
    if offset >= end {
        return 0;
    }
    let open_index = out.len();
    out.push(2 | XML_PI_OPEN);

    let target_start = offset;
    let first = input[offset];
    if first.is_ascii_alphabetic() || first == b'_' {
        offset += 1;
        while offset < end {
            let ch = input[offset];
            if ch.is_ascii_alphanumeric() || ch == b'-' || ch == b'_' || ch == b'.' {
                offset += 1;
            } else {
                break;
            }
        }
    }
    let target_len = offset - target_start;
    if target_len > 0 {
        out.push(target_len as u32 | XML_PI_TARGET);
    }

    let content_start = offset;
    while offset < end {
        let ch = input[offset];
        if ch == b'?' && offset + 1 < end && input[offset + 1] == b'>' {
            let content_len = offset - content_start;
            if content_len > 0 {
                out.push(content_len as u32 | XML_PI_CONTENT);
            }
            out.push(2 | XML_PI_CLOSE);
            return offset - start + 2;
        }
        if ch == b'\n' || ch == b'\r' || ch == b'<' {
            let content_len = offset - content_start;
            if content_len > 0 {
                out.push(content_len as u32 | XML_PI_CONTENT);
            }
            out[open_index] |= ERROR_UNBALANCED;
            for t in out.iter_mut().skip(open_index + 1) {
                *t |= ERROR_UNBALANCED;
            }
            return offset - start;
        }
        offset += 1;
    }
    let content_len = offset - content_start;
    if content_len > 0 {
        out.push(content_len as u32 | XML_PI_CONTENT);
    }
    out[open_index] |= ERROR_UNBALANCED;
    for t in out.iter_mut().skip(open_index + 1) {
        *t |= ERROR_UNBALANCED;
    }
    offset - start
}

/// Full HTML tag (opening, closing, or self-closing) with attribute tokens.
#[allow(unused_assignments)]
pub fn scan_html_tag(input: &[u8], start: usize, end: usize, out: &mut Vec<u32>) -> usize {
    if start >= end || input[start] != b'<' {
        return 0;
    }
    let mut offset = start + 1;
    if offset >= end {
        out.push(1 | HTML_TAG_OPEN);
        return 1;
    }
    let is_closing = input[offset] == b'/';
    if is_closing {
        offset += 1;
        if offset >= end {
            return 0;
        }
    }

    let tag_name_start = offset;
    let first = input[offset];
    if !first.is_ascii_alphabetic() {
        if !is_closing {
            out.push(1 | HTML_TAG_OPEN);
            return 1;
        }
        return 0;
    }
    offset += 1;
    while offset < end {
        let ch = input[offset];
        if ch.is_ascii_alphanumeric() || ch == b'-' || ch == b':' {
            offset += 1;
        } else {
            break;
        }
    }
    let tag_name_len = offset - tag_name_start;
    if tag_name_len == 0 {
        return 0;
    }

    let open_index = out.len();
    if is_closing {
        out.push(2 | HTML_TAG_OPEN);
    } else {
        out.push(1 | HTML_TAG_OPEN);
    }
    out.push(tag_name_len as u32 | HTML_TAG_NAME);

    if is_closing {
        let ws_start = offset;
        let mut has_newline = false;
        while offset < end {
            let ch = input[offset];
            if ch == b'\t' || ch == b' ' || ch == b'\n' || ch == b'\r' {
                if ch == b'\n' || ch == b'\r' {
                    has_newline = true;
                }
                offset += 1;
            } else {
                break;
            }
        }
        let ws_len = offset - ws_start;
        if ws_len > 0 {
            out.push(ws_len as u32 | WHITESPACE);
        }
        if offset < end && input[offset] == b'>' {
            if has_newline {
                out[open_index] |= ERROR_UNBALANCED;
                out.push(1 | HTML_TAG_CLOSE | ERROR_UNBALANCED);
            } else {
                out.push(1 | HTML_TAG_CLOSE);
            }
            return offset - start + 1;
        }
        out[open_index] |= ERROR_UNBALANCED;
        return offset - start;
    }

    let mut has_error = false;
    let mut prev_ws_newline = false;

    while offset < end {
        let ws_start = offset;
        let mut ws_has_newline = false;
        while offset < end {
            let ch = input[offset];
            if ch == b'\t' || ch == b' ' || ch == b'\n' || ch == b'\r' {
                if ch == b'\n' || ch == b'\r' {
                    if prev_ws_newline {
                        let ws_len = offset - ws_start;
                        if ws_len > 0 {
                            out.push(ws_len as u32 | WHITESPACE);
                        }
                        out[open_index] |= ERROR_UNBALANCED;
                        return offset - start;
                    }
                    ws_has_newline = true;
                }
                offset += 1;
            } else {
                break;
            }
        }
        let ws_len = offset - ws_start;
        if ws_len > 0 {
            out.push(ws_len as u32 | WHITESPACE);
        }
        prev_ws_newline = ws_has_newline;

        if offset >= end {
            out[open_index] |= ERROR_UNBALANCED;
            break;
        }

        let ch = input[offset];
        if ch == b'<' {
            out[open_index] |= ERROR_UNBALANCED;
            return offset - start;
        }
        if ch == b'>' {
            out.push(1 | HTML_TAG_CLOSE);
            return offset - start + 1;
        }
        if ch == b'/' && offset + 1 < end && input[offset + 1] == b'>' {
            out.push(2 | HTML_TAG_SELF_CLOSING);
            return offset - start + 2;
        }

        prev_ws_newline = false;

        let attr_name_start = offset;
        let first_attr = input[offset];
        if !(first_attr.is_ascii_alphabetic() || first_attr == b'_' || first_attr == b':') {
            has_error = true;
            break;
        }
        offset += 1;
        let mut colon_pos: i64 = -1;
        while offset < end {
            let ac = input[offset];
            if ac.is_ascii_alphanumeric() || ac == b'-' || ac == b'_' || ac == b'.' {
                offset += 1;
            } else if ac == b':' && colon_pos == -1 {
                colon_pos = offset as i64;
                offset += 1;
            } else {
                break;
            }
        }

        if colon_pos != -1 {
            let colon_pos = colon_pos as usize;
            let prefix_len = colon_pos - attr_name_start;
            if prefix_len > 0 {
                out.push(prefix_len as u32 | HTML_ATTRIBUTE_NAME);
            }
            out.push(1 | HTML_ATTRIBUTE_COLON);
            let local_len = offset - colon_pos - 1;
            if local_len > 0 {
                out.push(local_len as u32 | HTML_ATTRIBUTE_NAME);
            }
        } else {
            let attr_name_len = offset - attr_name_start;
            out.push(attr_name_len as u32 | HTML_ATTRIBUTE_NAME);
        }

        let ws2 = offset;
        while offset < end {
            let wc = input[offset];
            if wc == b'\t' || wc == b' ' || wc == b'\n' || wc == b'\r' {
                offset += 1;
            } else {
                break;
            }
        }
        let ws2_len = offset - ws2;
        if ws2_len > 0 {
            out.push(ws2_len as u32 | WHITESPACE);
        }
        if offset >= end {
            break;
        }

        if input[offset] != b'=' {
            continue;
        }
        out.push(1 | HTML_ATTRIBUTE_EQUALS);
        offset += 1;

        let ws3 = offset;
        while offset < end {
            let wc = input[offset];
            if wc == b'\t' || wc == b' ' || wc == b'\n' || wc == b'\r' {
                offset += 1;
            } else {
                break;
            }
        }
        let ws3_len = offset - ws3;
        if ws3_len > 0 {
            out.push(ws3_len as u32 | WHITESPACE);
        }
        if offset >= end {
            break;
        }

        let quote = input[offset];
        if quote == b'"' || quote == b'\'' {
            out.push(1 | HTML_ATTRIBUTE_QUOTE);
            offset += 1;
            let mut attr_prev_ws_newline = false;
            while offset < end {
                let vc = input[offset];
                if vc == quote {
                    out.push(1 | HTML_ATTRIBUTE_QUOTE);
                    offset += 1;
                    break;
                }
                if vc == b'\n' || vc == b'\r' {
                    if attr_prev_ws_newline {
                        out[open_index] |= ERROR_UNBALANCED;
                        return offset - start;
                    }
                    let ws_start = offset;
                    if vc == b'\r' && offset + 1 < end && input[offset + 1] == b'\n' {
                        offset += 2;
                    } else {
                        offset += 1;
                    }
                    out.push((offset - ws_start) as u32 | WHITESPACE);
                    attr_prev_ws_newline = true;
                    continue;
                }
                if vc == b'<' || vc == b'>' {
                    out[open_index] |= ERROR_UNBALANCED;
                    return offset - start;
                }
                if vc != b' ' && vc != b'\t' {
                    attr_prev_ws_newline = false;
                }
                if vc == b'&' {
                    let entity = scan_entity(input, offset, end);
                    if entity != 0 {
                        out.push(entity);
                        offset += token_len(entity);
                        continue;
                    }
                }
                let text_start = offset;
                while offset < end {
                    let c = input[offset];
                    if c == quote || c == b'&' || c == b'\n' || c == b'\r' || c == b'<' || c == b'>' {
                        break;
                    }
                    if c == b'%' && offset + 2 < end {
                        let h1 = input[offset + 1];
                        let h2 = input[offset + 2];
                        if h1.is_ascii_hexdigit() && h2.is_ascii_hexdigit() {
                            break;
                        }
                    }
                    offset += 1;
                }
                let text_len = offset - text_start;
                if text_len > 0 {
                    out.push(text_len as u32 | HTML_ATTRIBUTE_VALUE);
                }
                if offset < end && input[offset] == b'%' && offset + 2 < end {
                    let h1 = input[offset + 1];
                    let h2 = input[offset + 2];
                    if h1.is_ascii_hexdigit() && h2.is_ascii_hexdigit() {
                        out.push(3 | PERCENT_ENCODING);
                        offset += 3;
                    }
                }
            }
            if offset >= end && (offset == 0 || input[offset - 1] != quote) {
                out[open_index] |= ERROR_UNBALANCED;
                has_error = true;
            }
        } else {
            let value_start = offset;
            while offset < end {
                let vc = input[offset];
                if vc == b'\t'
                    || vc == b' '
                    || vc == b'\n'
                    || vc == b'\r'
                    || vc == b'<'
                    || vc == b'>'
                    || vc == b'"'
                    || vc == b'\''
                    || vc == b'='
                    || vc == b'`'
                {
                    break;
                }
                offset += 1;
            }
            let value_len = offset - value_start;
            if value_len > 0 {
                out.push(value_len as u32 | HTML_ATTRIBUTE_VALUE);
            }
        }
    }

    if has_error || offset >= end {
        out[open_index] |= ERROR_UNBALANCED;
        return offset - start;
    }
    offset - start
}

/// Consume raw text after an opening `<script>`/`<style>`/`<textarea>` up to the
/// matching close tag. Emits a single `HTML_RAW_TEXT` content token.
pub fn scan_html_raw_text(
    input: &[u8],
    start: usize,
    end: usize,
    tag_name_start: usize,
    tag_name_len: usize,
    out: &mut Vec<u32>,
) -> usize {
    let mut offset = start;
    while offset < end {
        if input[offset] == b'<' && offset + 1 < end && input[offset + 1] == b'/' {
            let name_pos = offset + 2;
            if name_pos + tag_name_len <= end
                && matches_tag_name(
                    input,
                    name_pos,
                    tag_name_len,
                    &input[tag_name_start..tag_name_start + tag_name_len]
                        .to_ascii_lowercase(),
                )
            {
                break;
            }
        }
        offset += 1;
    }
    let content_len = offset - start;
    if content_len > 0 {
        out.push(content_len as u32 | HTML_RAW_TEXT);
    }
    content_len
}
