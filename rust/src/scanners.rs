//! Phase-1 scanners. Each function walks the input forward once, emitting packed
//! provisional tokens. Two shapes exist, mirroring the JS project:
//!
//! * **primitive** scanners return a `u32` token (or `0` for no match);
//! * **complex** scanners push tokens onto `out` and return the byte count
//!   consumed (or `0` for no match).

use crate::core::{at, count_indentation, find_line_start, is_ascii_alpha};
use crate::token::kind::*;
use crate::token::{depth_bits, token_len, ERROR_UNBALANCED};

/// `\` escape: consumes the backslash plus one following byte when present.
pub fn scan_escaped(input: &[u8], start: usize, end: usize) -> u32 {
    if start >= end || input[start] != b'\\' {
        return 0;
    }
    if start + 1 >= end {
        ESCAPED | 1
    } else {
        ESCAPED | 2
    }
}

/// HTML entity by shape: `&name;`, `&#123;`, `&#xAF;`.
///
/// The JS parser validates named entities against the full WHATWG map; here we
/// follow MixPad's "natural expectation" intuition and accept any
/// `&[A-Za-z][A-Za-z0-9]*;`. Numeric forms require a terminating `;`.
pub fn scan_entity(input: &[u8], start: usize, end: usize) -> u32 {
    if start >= end || input[start] != b'&' {
        return 0;
    }
    let mut offset = start + 1;
    if offset >= end {
        return 0;
    }

    if input[offset] == b'#' {
        offset += 1;
        if offset >= end {
            return 0;
        }
        let mut is_hex = false;
        let cc = input[offset];
        if cc == b'x' || cc == b'X' {
            is_hex = true;
            offset += 1;
            if offset >= end {
                return 0;
            }
        }
        let digits_start = offset;
        while offset < end {
            let d = input[offset];
            let ok = if is_hex {
                d.is_ascii_hexdigit()
            } else {
                d.is_ascii_digit()
            };
            if !ok {
                break;
            }
            offset += 1;
        }
        if offset == digits_start {
            return 0;
        }
        if offset < end && input[offset] == b';' {
            let length = (offset - start + 1) as u32;
            let kind = if is_hex { ENTITY_HEX } else { ENTITY_DECIMAL };
            return length | kind;
        }
        return 0;
    }

    if !is_ascii_alpha(input[offset] as u32) {
        return 0;
    }
    let mut o = offset + 1;
    while o < end {
        let c = input[o];
        if c.is_ascii_alphanumeric() {
            o += 1;
        } else {
            break;
        }
    }
    if o < end && input[o] == b';' {
        let length = (o - start + 1) as u32;
        return length | ENTITY_NAMED;
    }
    0
}

/// Emphasis delimiter run (`*`, `_`, `~`). Pairing/flanking is resolved later in
/// the semantic phase; here we only emit the raw run with a few provable
/// demotions to plain text.
pub fn scan_emphasis(input: &[u8], start: usize, end: usize, out: &mut Vec<u32>) -> usize {
    use crate::core::{is_ascii_alpha_num, is_whitespace};
    if start >= end {
        return 0;
    }
    let first = input[start];
    if first != b'*' && first != b'_' && first != b'~' {
        return 0;
    }
    let mut run = 1usize;
    while start + run < end && input[start + run] == first {
        run += 1;
    }
    if first == b'~' && run < 2 {
        return 0;
    }
    let before = if start > 0 { input[start - 1] as u32 } else { 0 };
    let after = at(input, start + run, end);

    if is_whitespace(before) && is_whitespace(after) {
        return 0;
    }
    if first == b'_' && is_ascii_alpha_num(before) && is_ascii_alpha_num(after) {
        if let Some(&last) = out.last() {
            if crate::token::token_kind(last) == INLINE_TEXT {
                return 0;
            }
        }
    }

    let kind = match first {
        b'*' => ASTERISK_DELIMITER,
        b'_' => UNDERSCORE_DELIMITER,
        _ => TILDE_DELIMITER,
    };
    out.push(run as u32 | kind);
    run
}

fn scan_backtick_open(input: &[u8], start: usize, end: usize) -> u32 {
    if start >= end || input[start] != b'`' {
        return 0;
    }
    let mut offset = start + 1;
    while offset < end && input[offset] == b'`' {
        offset += 1;
    }
    BACKTICK_BOUNDARY | (offset - start) as u32
}

fn scan_inline_code(input: &[u8], start: usize, end: usize, open_n: usize) -> u32 {
    let mut current_run = 0usize;
    let mut fallback: i64 = -1;
    let mut pos = start;
    while pos < end {
        let ch = input[pos];
        if ch == b'`' {
            if fallback < 0 {
                fallback = (pos - start) as i64;
            }
            current_run += 1;
            if current_run == open_n {
                let total = pos + 1 - open_n - start;
                return INLINE_CODE | total as u32;
            }
        } else {
            current_run = 0;
            if (ch == b'\n' || ch == b'\r') && fallback < 0 {
                fallback = pos as i64;
            }
        }
        pos += 1;
    }
    if fallback < 0 {
        fallback = 0;
    }
    INLINE_CODE | ERROR_UNBALANCED | fallback as u32
}

/// Inline code spans: `` `code` ``, ``` ``co`de`` ``` etc.
pub fn scan_backtick_inline(input: &[u8], start: usize, end: usize, out: &mut Vec<u32>) -> usize {
    let open = scan_backtick_open(input, start, end);
    if open == 0 {
        return 0;
    }
    let open_len = token_len(open);
    let inline = scan_inline_code(input, start + open_len, end, open_len);

    if inline & ERROR_UNBALANCED != 0 {
        let inline_len = token_len(inline);
        let closing_try = start + open_len + inline_len;
        let closing = scan_backtick_open(input, closing_try, end);
        if closing != 0 {
            out.push(open | ERROR_UNBALANCED);
            out.push(inline);
            out.push(closing | ERROR_UNBALANCED);
            return open_len + inline_len + token_len(closing);
        } else {
            out.push(open | ERROR_UNBALANCED);
            out.push(inline);
            return open_len + inline_len;
        }
    }

    out.push(open);
    out.push(inline);
    out.push(BACKTICK_BOUNDARY | open_len as u32);
    open_len + token_len(inline) + open_len
}

/// Fenced code block: ```` ``` ```` or `~~~`, with optional info string.
pub fn scan_fenced_block(input: &[u8], start: usize, end: usize, out: &mut Vec<u32>) -> usize {
    if start >= end {
        return 0;
    }
    let fence = input[start];
    if fence != b'`' && fence != b'~' {
        return 0;
    }
    let line_start = find_line_start(input, start);
    if start - line_start > 3 {
        return 0;
    }
    let mut pos = start;
    let mut open_len = 0usize;
    while pos < end && input[pos] == fence {
        open_len += 1;
        pos += 1;
    }
    if open_len < 3 {
        return 0;
    }

    let mut info_pos = pos;
    while info_pos < end {
        let ch = input[info_pos];
        if ch == b'\n' || ch == b'\r' {
            break;
        }
        info_pos += 1;
    }

    let mut content_start = pos;
    if info_pos < end {
        let ch = input[info_pos];
        if ch == b'\r' && info_pos + 1 < end && input[info_pos + 1] == b'\n' {
            content_start = info_pos + 2;
        } else if ch == b'\n' || ch == b'\r' {
            content_start = info_pos + 1;
        } else {
            content_start = pos;
        }
    }

    let mut p = info_pos;
    while p < end {
        let mut newline_pos: i64 = -1;
        while p < end {
            let ch = input[p];
            if ch == b'\n' || ch == b'\r' {
                newline_pos = p as i64;
                if ch == b'\r' && p + 1 < end && input[p + 1] == b'\n' {
                    p += 2;
                } else {
                    p += 1;
                }
                break;
            }
            p += 1;
        }
        if p >= end {
            break;
        }

        let mut line_pos = p;
        let mut spaces = 0usize;
        while line_pos < end && input[line_pos] == b' ' && spaces < 3 {
            spaces += 1;
            line_pos += 1;
        }

        if line_pos < end && input[line_pos] == fence {
            let mut close_len = 0usize;
            let mut fence_pos = line_pos;
            while fence_pos < end && input[fence_pos] == fence {
                close_len += 1;
                fence_pos += 1;
            }
            if close_len >= open_len {
                let mut valid = true;
                let mut check = fence_pos;
                while check < end {
                    let nc = input[check];
                    if nc == b'\n' || nc == b'\r' {
                        break;
                    }
                    if nc != b' ' && nc != b'\t' {
                        valid = false;
                        break;
                    }
                    check += 1;
                }
                if valid {
                    let open_token_len = content_start - start;
                    let content_len = (newline_pos + 1) as usize - content_start;
                    let mut close_line_end = check;
                    if check < end {
                        let nc = input[check];
                        if nc == b'\r' && check + 1 < end && input[check + 1] == b'\n' {
                            close_line_end = check + 2;
                        } else if nc == b'\n' || nc == b'\r' {
                            close_line_end = check + 1;
                        }
                    }
                    let close_token_len = close_line_end - line_pos;
                    out.push(FENCED_OPEN | open_token_len as u32);
                    if content_len > 0 {
                        out.push(FENCED_CONTENT | content_len as u32);
                    }
                    out.push(FENCED_CLOSE | close_token_len as u32);
                    return close_line_end - start;
                }
            }
        }
    }

    let content_len = end - content_start;
    out.push(FENCED_OPEN | ERROR_UNBALANCED | open_len as u32);
    if content_len > 0 {
        out.push(FENCED_CONTENT | ERROR_UNBALANCED | content_len as u32);
    }
    end - start
}

/// ATX heading: `# Title`, `### Title ###`.
pub fn scan_atx_heading(input: &[u8], start: usize, end: usize, out: &mut Vec<u32>) -> usize {
    if start >= end || input[start] != b'#' {
        return 0;
    }
    let line_start = find_line_start(input, start);
    let line_indent = count_indentation(input, line_start, start);
    if line_indent > 3 || line_start + line_indent != start {
        return 0;
    }
    let mut hash = 0usize;
    let mut pos = start;
    while pos < end && input[pos] == b'#' && hash < 7 {
        hash += 1;
        pos += 1;
    }
    if hash > 6 {
        return 0;
    }
    if pos < end {
        let ch = input[pos];
        if ch != b' ' && ch != b'\t' && ch != b'\n' && ch != b'\r' {
            return 0;
        }
    }

    let db = depth_bits(hash as u32);

    let mut line_end = pos;
    while line_end < end {
        let ch = input[line_end];
        if ch == b'\n' || ch == b'\r' {
            break;
        }
        line_end += 1;
    }

    out.push(hash as u32 | ATX_HEADING_OPEN | db);

    let ws_start = pos;
    while pos < end && (input[pos] == b' ' || input[pos] == b'\t') {
        pos += 1;
    }
    if pos > ws_start {
        out.push((pos - ws_start) as u32 | WHITESPACE | db);
    }

    let content_start = pos;
    let mut content_end = line_end;
    while content_end > content_start
        && (input[content_end - 1] == b' ' || input[content_end - 1] == b'\t')
    {
        content_end -= 1;
    }

    let mut closing_start: i64 = -1;
    let mut closing_end: i64 = -1;
    if content_end > content_start && input[content_end - 1] == b'#' {
        let mut hash_start = content_end - 1;
        while hash_start > content_start && input[hash_start - 1] == b'#' {
            hash_start -= 1;
        }
        if hash_start == content_start
            || input[hash_start - 1] == b' '
            || input[hash_start - 1] == b'\t'
        {
            closing_start = hash_start as i64;
            closing_end = content_end as i64;
            content_end = hash_start;
            while content_end > content_start
                && (input[content_end - 1] == b' ' || input[content_end - 1] == b'\t')
            {
                content_end -= 1;
            }
        }
    }

    if content_end > content_start {
        out.push((content_end - content_start) as u32 | INLINE_TEXT | db);
    }
    if closing_start >= 0 && closing_start as usize > content_end {
        let ws_len = closing_start as usize - content_end;
        out.push(ws_len as u32 | WHITESPACE | db);
    }
    if closing_start >= 0 {
        let closing_len = (closing_end - closing_start) as u32;
        out.push(closing_len | ATX_HEADING_CLOSE | db);
    }

    let mut consumed = line_end - start;
    if line_end < end {
        let ch = input[line_end];
        if ch == b'\r' && line_end + 1 < end && input[line_end + 1] == b'\n' {
            consumed += 2;
        } else if ch == b'\n' || ch == b'\r' {
            consumed += 1;
        }
    }
    consumed
}

/// Result of a setext underline lookahead.
pub struct SetextCheck {
    pub valid: bool,
    pub depth: u32,
    pub consumed_length: usize,
    pub underline_token_length: usize,
}

/// Check whether the line at `underline_start` is a valid setext underline
/// (`===` → level 1, `---` → level 2).
pub fn check_setext_underline(input: &[u8], underline_start: usize, end: usize) -> SetextCheck {
    let none = SetextCheck {
        valid: false,
        depth: 0,
        consumed_length: 0,
        underline_token_length: 0,
    };
    if underline_start >= end {
        return none;
    }
    let line_start = find_line_start(input, underline_start);
    let line_indent = count_indentation(input, line_start, underline_start);
    if line_indent > 3 || line_start + line_indent != underline_start {
        return none;
    }
    let first = input[underline_start];
    if first != b'=' && first != b'-' {
        return none;
    }
    let mut pos = underline_start;
    while pos < end && input[pos] == first {
        pos += 1;
    }
    while pos < end && (input[pos] == b' ' || input[pos] == b'\t') {
        pos += 1;
    }
    let ch = at(input, pos, end);
    if ch != 0 && ch != 10 && ch != 13 {
        return none;
    }
    let mut consumed_length = pos - line_start;
    let underline_token_length = pos - underline_start;
    if ch == 13 && pos + 1 < end && input[pos + 1] == b'\n' {
        consumed_length += 2;
    } else if ch == 10 || ch == 13 {
        consumed_length += 1;
    }
    let depth = if first == b'=' { 1 } else { 2 };
    SetextCheck {
        valid: true,
        depth,
        consumed_length,
        underline_token_length,
    }
}

/// Thematic break: `***`, `---`, `___` (with optional interior spaces).
pub fn scan_thematic_break(input: &[u8], start: usize, end: usize, out: &mut Vec<u32>) -> usize {
    if start >= end {
        return 0;
    }
    let first = input[start];
    if first != b'*' && first != b'-' && first != b'_' {
        return 0;
    }
    let line_start = find_line_start(input, start);
    let line_indent = count_indentation(input, line_start, start);
    if line_indent > 3 || line_start + line_indent != start {
        return 0;
    }
    let mut offset = start;
    let mut count = 0usize;
    while offset < end {
        let ch = input[offset];
        if ch == first {
            count += 1;
            offset += 1;
        } else if ch == b' ' || ch == b'\t' {
            offset += 1;
        } else if ch == b'\n' || ch == b'\r' {
            break;
        } else {
            return 0;
        }
    }
    if count < 3 {
        return 0;
    }
    out.push((offset - start) as u32 | THEMATIC_BREAK);
    offset - start
}

/// Blockquote marker `>` at the head of a line (allowing nested `> >`).
pub fn scan_blockquote(input: &[u8], start: usize, end: usize, out: &mut Vec<u32>) -> usize {
    if start >= end || input[start] != b'>' {
        return 0;
    }
    let line_start = find_line_start(input, start);
    let line_indent = count_indentation(input, line_start, start);
    if line_indent > 3 {
        return 0;
    }
    let mut i = line_start + line_indent;
    while i < start {
        let ch = input[i];
        if ch != b'>' && ch != b' ' {
            return 0;
        }
        i += 1;
    }
    out.push(1 | BLOCKQUOTE_MARKER);
    1
}

/// Bullet list marker `-`, `*`, `+` followed by a space/tab.
pub fn scan_bullet_list_marker(
    input: &[u8],
    start: usize,
    end: usize,
    out: &mut Vec<u32>,
) -> usize {
    if start >= end {
        return 0;
    }
    let ch = input[start];
    if ch != b'-' && ch != b'*' && ch != b'+' {
        return 0;
    }
    let line_start = find_line_start(input, start);
    let line_indent = count_indentation(input, line_start, start);
    if line_indent > 3 || line_start + line_indent != start {
        return 0;
    }
    if start + 1 >= end {
        return 0;
    }
    let next = input[start + 1];
    if next != b' ' && next != b'\t' {
        return 0;
    }
    let marker_bits = match ch {
        b'-' => 0u32 << 28,
        b'*' => 1u32 << 28,
        _ => 2u32 << 28,
    };
    out.push(1 | BULLET_LIST_MARKER | marker_bits);
    1
}

/// Ordered list marker: `1.`, `2)` followed by a space/tab.
pub fn scan_ordered_list_marker(
    input: &[u8],
    start: usize,
    end: usize,
    out: &mut Vec<u32>,
) -> usize {
    if start >= end {
        return 0;
    }
    let line_start = find_line_start(input, start);
    let line_indent = count_indentation(input, line_start, start);
    if line_indent > 3 || line_start + line_indent != start {
        return 0;
    }
    let mut offset = start;
    let mut digits = 0usize;
    while offset < end && digits < 9 {
        let ch = input[offset];
        if ch.is_ascii_digit() {
            digits += 1;
            offset += 1;
        } else {
            break;
        }
    }
    if digits == 0 {
        return 0;
    }
    if offset >= end {
        return 0;
    }
    let delim = input[offset];
    if delim != b'.' && delim != b')' {
        return 0;
    }
    offset += 1;
    if offset >= end {
        return 0;
    }
    let next = input[offset];
    if next != b' ' && next != b'\t' {
        return 0;
    }
    let length = offset - start;
    let delim_bit = if delim == b'.' { 0 } else { 1u32 << 28 };
    out.push(length as u32 | ORDERED_LIST_MARKER | delim_bit);
    length
}

/// GFM task list checkbox `[ ]`, `[x]`, `[X]` (expects a following space/tab).
pub fn scan_task_list_marker(input: &[u8], start: usize, end: usize, out: &mut Vec<u32>) -> usize {
    if start + 3 >= end {
        return 0;
    }
    if input[start] != b'[' {
        return 0;
    }
    let check = input[start + 1];
    let checked = check == b'x' || check == b'X';
    let unchecked = check == b' ';
    if !checked && !unchecked {
        return 0;
    }
    if input[start + 2] != b']' {
        return 0;
    }
    let next = input[start + 3];
    if next != b' ' && next != b'\t' {
        return 0;
    }
    let checked_bit = if checked { 1u32 << 28 } else { 0 };
    out.push(3 | TASK_LIST_MARKER | checked_bit);
    3
}

pub fn scan_link_open(input: &[u8], start: usize, end: usize, out: &mut Vec<u32>) -> usize {
    if start >= end || input[start] != b'[' {
        return 0;
    }
    out.push(1 | LINK_OPEN);
    1
}

pub fn scan_link_close(input: &[u8], start: usize, end: usize, out: &mut Vec<u32>) -> usize {
    if start >= end || input[start] != b']' {
        return 0;
    }
    out.push(1 | LINK_CLOSE);
    1
}

pub fn scan_image_marker(input: &[u8], start: usize, end: usize, out: &mut Vec<u32>) -> usize {
    if start >= end || input[start] != b'!' {
        return 0;
    }
    if start + 1 >= end || input[start + 1] != b'[' {
        return 0;
    }
    out.push(1 | IMAGE_MARKER);
    1
}

pub fn scan_link_dest_open(input: &[u8], start: usize, end: usize, out: &mut Vec<u32>) -> usize {
    if start >= end || input[start] != b'(' {
        return 0;
    }
    out.push(1 | LINK_DEST_OPEN);
    1
}

pub fn scan_link_dest_close(input: &[u8], start: usize, end: usize, out: &mut Vec<u32>) -> usize {
    if start >= end || input[start] != b')' {
        return 0;
    }
    out.push(1 | LINK_DEST_CLOSE);
    1
}

fn is_valid_email_autolink(input: &[u8], start: usize, end: usize) -> bool {
    let mut at_pos: i64 = -1;
    for i in start..end {
        if input[i] == b'@' {
            if at_pos >= 0 {
                return false;
            }
            at_pos = i as i64;
        }
    }
    if at_pos < 0 || at_pos as usize == start || at_pos as usize == end - 1 {
        return false;
    }
    let at_pos = at_pos as usize;
    for i in start..at_pos {
        let c = input[i];
        let alnum = c.is_ascii_alphanumeric();
        let special = c == b'.' || c == b'-' || c == b'_' || c == b'+';
        if !alnum && !special {
            return false;
        }
    }
    let mut last_dot = false;
    let mut has_dot = false;
    for i in (at_pos + 1)..end {
        let c = input[i];
        let alnum = c.is_ascii_alphanumeric();
        let is_dot = c == b'.';
        let is_hyphen = c == b'-';
        if is_dot {
            has_dot = true;
            last_dot = true;
        } else {
            last_dot = false;
        }
        if !alnum && !is_dot && !is_hyphen {
            return false;
        }
    }
    has_dot && !last_dot
}

/// Angle autolink: `<https://example.com>` or `<user@host.com>`.
pub fn scan_angle_autolink(input: &[u8], start: usize, end: usize, out: &mut Vec<u32>) -> usize {
    if start >= end || input[start] != b'<' {
        return 0;
    }
    let mut offset = start + 1;
    if offset >= end {
        return 0;
    }
    let content_start = offset;
    let mut has_at = false;
    let mut has_colon = false;
    let mut colon_pos = 0usize;

    while offset < end {
        let ch = input[offset];
        if ch == b'\n' || ch == b'<' {
            return 0;
        }
        if ch == b'>' {
            break;
        }
        if ch == b'@' && !has_at {
            has_at = true;
        }
        if ch == b':' && !has_colon {
            has_colon = true;
            colon_pos = offset;
        }
        offset += 1;
    }

    if offset >= end || input[offset] != b'>' {
        return 0;
    }
    let content_end = offset;
    let content_length = content_end - content_start;
    if content_length == 0 {
        return 0;
    }

    let mut is_url = false;
    let mut is_email = false;

    if has_colon && (!has_at || colon_pos < content_end) {
        let scheme_end = colon_pos;
        let scheme_start = content_start;
        if scheme_end > scheme_start && is_ascii_alpha(input[scheme_start] as u32) {
            let mut valid_scheme = true;
            for i in (scheme_start + 1)..scheme_end {
                let c = input[i];
                let ok = c.is_ascii_alphanumeric() || c == b'+' || c == b'-' || c == b'.';
                if !ok {
                    valid_scheme = false;
                    break;
                }
            }
            if valid_scheme {
                let mut has_space = false;
                for i in (colon_pos + 1)..content_end {
                    let c = input[i];
                    if c == b' ' || c == b'\t' {
                        has_space = true;
                        break;
                    }
                }
                if !has_space {
                    is_url = true;
                }
            }
        }
    }

    if !is_url && has_at {
        is_email = is_valid_email_autolink(input, content_start, content_end);
    }

    if !is_url && !is_email {
        return 0;
    }

    out.push(ANGLE_LINK_OPEN | 1);
    if is_url {
        out.push(ANGLE_LINK_URL | content_length as u32);
    } else {
        out.push(ANGLE_LINK_EMAIL | content_length as u32);
    }
    out.push(ANGLE_LINK_CLOSE | 1);
    offset - start + 1
}

/// Bare `http://`/`https://` URL autolink (GFM).
pub fn scan_raw_url_autolink(input: &[u8], start: usize, end: usize) -> u32 {
    if start >= end {
        return 0;
    }
    let mut offset = start;
    let is_http = offset + 7 <= end && &input[offset..offset + 7] == b"http://";
    let is_https = offset + 8 <= end && &input[offset..offset + 8] == b"https://";
    if is_http {
        offset += 7;
    } else if is_https {
        offset += 8;
    } else {
        return 0;
    }
    if offset >= end {
        return 0;
    }

    let mut paren_depth: i64 = 0;
    let mut last_good = offset;
    let mut has_dot = false;
    while offset < end {
        let ch = input[offset];
        if ch == b' ' || ch == b'\t' || ch == b'\n' || ch == b'\r' || ch == b'<' || ch == b'&' {
            break;
        }
        if ch == b'(' {
            paren_depth += 1;
            last_good = offset + 1;
            offset += 1;
            continue;
        }
        if ch == b')' {
            paren_depth -= 1;
            if paren_depth < 0 {
                break;
            }
            last_good = offset + 1;
            offset += 1;
            continue;
        }
        if ch == b'.' {
            has_dot = true;
        }
        let trailing = matches!(ch, b'.' | b',' | b':' | b';' | b'!' | b'?');
        if !trailing {
            last_good = offset + 1;
        }
        offset += 1;
    }
    let content_length = last_good - start;
    let scheme_len = if is_https { 8 } else { 7 };
    if content_length <= scheme_len || !has_dot {
        return 0;
    }
    RAW_URL | content_length as u32
}

/// Bare `www.` autolink (GFM). `prev` is the byte before `start` (0 at line start).
pub fn scan_www_autolink(input: &[u8], start: usize, end: usize, prev: u32) -> u32 {
    if start >= end {
        return 0;
    }
    if prev != 0 {
        let c = prev as u8;
        if c.is_ascii_alphanumeric() {
            return 0;
        }
    }
    if start + 4 > end {
        return 0;
    }
    let c0 = input[start];
    let c1 = input[start + 1];
    let c2 = input[start + 2];
    let c3 = input[start + 3];
    let w = |c: u8| c == b'w' || c == b'W';
    if !w(c0) || !w(c1) || !w(c2) || c3 != b'.' {
        return 0;
    }
    let mut offset = start + 4;
    if offset >= end {
        return 0;
    }
    let mut paren_depth: i64 = 0;
    let mut last_good = offset;
    let mut has_dot = false;
    while offset < end {
        let ch = input[offset];
        if ch == b' ' || ch == b'\t' || ch == b'\n' || ch == b'\r' || ch == b'<' || ch == b'&' {
            break;
        }
        if ch == b'(' {
            paren_depth += 1;
            last_good = offset + 1;
            offset += 1;
            continue;
        }
        if ch == b')' {
            paren_depth -= 1;
            if paren_depth < 0 {
                break;
            }
            last_good = offset + 1;
            offset += 1;
            continue;
        }
        if ch == b'.' {
            has_dot = true;
        }
        let trailing = matches!(ch, b'.' | b',' | b':' | b';' | b'!' | b'?');
        if !trailing {
            last_good = offset + 1;
        }
        offset += 1;
    }
    let content_length = last_good - start;
    if content_length <= 4 || !has_dot {
        return 0;
    }
    WWW_AUTOLINK | content_length as u32
}

/// GFM table pipe `|`. The semantic/build phase decides whether pipes form a table.
pub fn scan_table_pipe(input: &[u8], start: usize, end: usize, out: &mut Vec<u32>) -> usize {
    if start >= end || input[start] != b'|' {
        return 0;
    }
    out.push(1 | TABLE_PIPE);
    1
}

/// Display-math formula block delimited by a run of `$$` (or longer).
pub fn scan_formula_block(input: &[u8], start: usize, end: usize, out: &mut Vec<u32>) -> usize {
    if start >= end || input[start] != b'$' {
        return 0;
    }
    let line_start = find_line_start(input, start);
    if start - line_start > 3 {
        return 0;
    }
    let mut pos = start;
    let mut open_len = 0usize;
    while pos < end && input[pos] == b'$' {
        open_len += 1;
        pos += 1;
    }
    if open_len < 2 {
        return 0;
    }

    let mut content_start = pos;
    if pos < end {
        let ch = input[pos];
        if ch == b'\r' && pos + 1 < end && input[pos + 1] == b'\n' {
            content_start = pos + 2;
        } else if ch == b'\n' || ch == b'\r' {
            content_start = pos + 1;
        }
    }

    let mut p = pos;
    while p < end {
        let mut newline_pos: i64 = -1;
        while p < end {
            let ch = input[p];
            if ch == b'\n' || ch == b'\r' {
                newline_pos = p as i64;
                if ch == b'\r' && p + 1 < end && input[p + 1] == b'\n' {
                    p += 2;
                } else {
                    p += 1;
                }
                break;
            }
            p += 1;
        }
        if p >= end {
            break;
        }
        let mut line_pos = p;
        let mut spaces = 0usize;
        while line_pos < end && input[line_pos] == b' ' && spaces < 3 {
            spaces += 1;
            line_pos += 1;
        }
        if line_pos < end && input[line_pos] == b'$' {
            let mut close_len = 0usize;
            let mut dollar_pos = line_pos;
            while dollar_pos < end && input[dollar_pos] == b'$' {
                close_len += 1;
                dollar_pos += 1;
            }
            if close_len >= open_len {
                let mut valid = true;
                let mut check = dollar_pos;
                while check < end {
                    let nc = input[check];
                    if nc == b'\n' || nc == b'\r' {
                        break;
                    }
                    if nc != b' ' && nc != b'\t' {
                        valid = false;
                        break;
                    }
                    check += 1;
                }
                if valid {
                    let open_token_len = content_start - start;
                    let content_len = (newline_pos + 1) as usize - content_start;
                    let mut close_line_end = check;
                    if check < end {
                        let nc = input[check];
                        if nc == b'\r' && check + 1 < end && input[check + 1] == b'\n' {
                            close_line_end = check + 2;
                        } else if nc == b'\n' || nc == b'\r' {
                            close_line_end = check + 1;
                        }
                    }
                    let close_token_len = close_line_end - line_pos;
                    out.push(FORMULA_OPEN | open_token_len as u32);
                    out.push(FORMULA_CONTENT | content_len as u32);
                    out.push(FORMULA_CLOSE | close_token_len as u32);
                    return close_line_end - start;
                }
            }
        }
    }

    let open_token_len = content_start - start;
    let content_len = end - content_start;
    out.push(FORMULA_OPEN | ERROR_UNBALANCED | open_token_len as u32);
    out.push(FORMULA_CONTENT | ERROR_UNBALANCED | content_len as u32);
    end - start
}

/// Front matter at absolute document start: YAML (`---`), TOML (`+++`), JSON (`{…}`).
/// The format is stored in bits 26–27 of the tokens.
pub fn scan_frontmatter(input: &[u8], start_offset: usize, end_offset: usize, out: &mut Vec<u32>) -> usize {
    if start_offset != 0 || start_offset >= end_offset {
        return 0;
    }
    match input[start_offset] {
        b'-' => scan_delimited_frontmatter(input, start_offset, end_offset, out, b'-', 0),
        b'+' => scan_delimited_frontmatter(input, start_offset, end_offset, out, b'+', 1),
        b'{' => scan_json_frontmatter(input, start_offset, end_offset, out),
        _ => 0,
    }
}

fn scan_delimited_frontmatter(
    input: &[u8],
    start_offset: usize,
    end_offset: usize,
    out: &mut Vec<u32>,
    delim: u8,
    fm_type: u32,
) -> usize {
    if start_offset + 3 > end_offset {
        return 0;
    }
    if input[start_offset] != delim || input[start_offset + 1] != delim || input[start_offset + 2] != delim {
        return 0;
    }
    let mut pos = start_offset + 3;
    if pos < end_offset {
        let next = input[pos];
        if next == b'\n' {
            pos += 1;
        } else if next == b'\r' {
            pos += 1;
            if pos < end_offset && input[pos] == b'\n' {
                pos += 1;
            }
        } else if next == b' ' || next == b'\t' {
            while pos < end_offset {
                let ch = input[pos];
                if ch == b'\n' || ch == b'\r' {
                    break;
                }
                if ch != b' ' && ch != b'\t' {
                    return 0;
                }
                pos += 1;
            }
            if pos < end_offset {
                let ch = input[pos];
                if ch == b'\r' {
                    pos += 1;
                    if pos < end_offset && input[pos] == b'\n' {
                        pos += 1;
                    }
                } else if ch == b'\n' {
                    pos += 1;
                }
            }
        } else {
            return 0;
        }
    }

    let type_bits = (fm_type & 0x3) << 26;
    let open_length = pos - start_offset;
    out.push(FRONTMATTER_OPEN | type_bits | open_length as u32);

    let content_start = pos;
    while pos < end_offset {
        let line_start = pos;
        if pos + 3 <= end_offset
            && input[pos] == delim
            && input[pos + 1] == delim
            && input[pos + 2] == delim
        {
            let mut closer_end = pos + 3;
            let mut valid = true;
            if closer_end < end_offset {
                let next = input[closer_end];
                if next == b'\n' {
                    closer_end += 1;
                } else if next == b'\r' {
                    closer_end += 1;
                    if closer_end < end_offset && input[closer_end] == b'\n' {
                        closer_end += 1;
                    }
                } else if next == b' ' || next == b'\t' {
                    while closer_end < end_offset {
                        let ch = input[closer_end];
                        if ch == b'\n' || ch == b'\r' {
                            break;
                        }
                        if ch != b' ' && ch != b'\t' {
                            valid = false;
                            break;
                        }
                        closer_end += 1;
                    }
                    if valid && closer_end < end_offset {
                        let ch = input[closer_end];
                        if ch == b'\r' {
                            closer_end += 1;
                            if closer_end < end_offset && input[closer_end] == b'\n' {
                                closer_end += 1;
                            }
                        } else if ch == b'\n' {
                            closer_end += 1;
                        }
                    }
                } else {
                    valid = false;
                }
            }
            if valid {
                let content_len = line_start - content_start;
                if content_len > 0 {
                    out.push(FRONTMATTER_CONTENT | type_bits | content_len as u32);
                }
                let close_len = closer_end - line_start;
                out.push(FRONTMATTER_CLOSE | type_bits | close_len as u32);
                return closer_end - start_offset;
            }
        }
        while pos < end_offset {
            let ch = input[pos];
            pos += 1;
            if ch == b'\n' {
                break;
            }
            if ch == b'\r' {
                if pos < end_offset && input[pos] == b'\n' {
                    pos += 1;
                }
                break;
            }
        }
    }

    let content_len = end_offset - content_start;
    if content_len > 0 {
        out.push(FRONTMATTER_CONTENT | type_bits | content_len as u32 | ERROR_UNBALANCED);
    }
    end_offset - start_offset
}

fn scan_json_frontmatter(input: &[u8], start_offset: usize, end_offset: usize, out: &mut Vec<u32>) -> usize {
    if input[start_offset] != b'{' {
        return 0;
    }
    let type_bits = 2u32 << 26; // JSON
    let mut pos = start_offset + 1;
    out.push(FRONTMATTER_OPEN | type_bits | 1);

    let mut brace_depth = 1i64;
    let content_start = pos;
    let mut in_string = false;
    let mut escape_next = false;

    while pos < end_offset && brace_depth > 0 {
        let ch = input[pos];
        if escape_next {
            escape_next = false;
            pos += 1;
            continue;
        }
        if ch == b'\\' && in_string {
            escape_next = true;
            pos += 1;
            continue;
        }
        if ch == b'"' {
            in_string = !in_string;
            pos += 1;
            continue;
        }
        if !in_string {
            if ch == b'{' {
                brace_depth += 1;
            } else if ch == b'}' {
                brace_depth -= 1;
                if brace_depth == 0 {
                    let content_len = pos - content_start;
                    if content_len > 0 {
                        out.push(FRONTMATTER_CONTENT | type_bits | content_len as u32);
                    }
                    pos += 1;
                    out.push(FRONTMATTER_CLOSE | type_bits | 1);
                    return pos - start_offset;
                }
            }
        }
        pos += 1;
    }

    let content_len = end_offset - content_start;
    if content_len > 0 {
        out.push(FRONTMATTER_CONTENT | type_bits | content_len as u32 | ERROR_UNBALANCED);
    }
    end_offset - start_offset
}
