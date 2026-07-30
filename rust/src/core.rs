//! Byte-level character classification and line helpers.
//!
//! Scanning operates on `&[u8]` (UTF-8 bytes). All Markdown structural
//! characters are ASCII, so byte inspection is exact for structure. Multi-byte
//! UTF-8 lead/continuation bytes are `>= 0x80` and never match ASCII structure,
//! so they flow into text runs untouched.

/// Byte at `i`, or `0` when out of range (mirrors JS `charCodeAt` guards).
#[inline(always)]
pub fn at(input: &[u8], i: usize, end: usize) -> u32 {
    if i < end {
        input[i] as u32
    } else {
        0
    }
}

#[inline(always)]
pub fn is_ascii_alpha(ch: u32) -> bool {
    (b'A' as u32..=b'Z' as u32).contains(&ch) || (b'a' as u32..=b'z' as u32).contains(&ch)
}

#[inline(always)]
pub fn is_ascii_alpha_num(ch: u32) -> bool {
    is_ascii_alpha(ch) || (b'0' as u32..=b'9' as u32).contains(&ch)
}

/// ASCII whitespace, plus `0` used as a boundary sentinel.
#[inline(always)]
pub fn is_whitespace(ch: u32) -> bool {
    matches!(ch, 0 | 9 | 10 | 13 | 32 | 11 | 12)
}

/// ASCII punctuation (Unicode P category is approximated by ASCII here).
#[inline(always)]
pub fn is_punctuation(ch: u32) -> bool {
    if ch == 0 {
        return false;
    }
    (33..=47).contains(&ch)
        || (58..=64).contains(&ch)
        || (91..=96).contains(&ch)
        || (123..=126).contains(&ch)
}

/// Scan backwards to the start of the current line (just after the previous
/// `\n`/`\r`, or `0`).
#[inline]
pub fn find_line_start(input: &[u8], mut pos: usize) -> usize {
    while pos > 0 {
        let ch = input[pos - 1];
        if ch == b'\n' || ch == b'\r' {
            return pos;
        }
        pos -= 1;
    }
    0
}

/// Count leading indentation from `line_start` to `pos`. Tabs advance to the
/// next multiple of 4.
#[inline]
pub fn count_indentation(input: &[u8], line_start: usize, pos: usize) -> usize {
    let mut indent = 0usize;
    let mut i = line_start;
    while i < pos {
        match input[i] {
            32 => indent += 1,
            9 => indent = (indent + 4) & !3,
            _ => break,
        }
        i += 1;
    }
    indent
}
