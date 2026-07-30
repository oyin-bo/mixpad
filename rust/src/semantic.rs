//! Phase-2 semantic resolution. Consumes the provisional token stream chunk by
//! chunk and produces resolved tokens: paired emphasis/strong/strikethrough,
//! validated links/images, and coalesced text runs. All work happens over
//! compact integer records — no source rescans, no substring allocation.

use crate::core::{is_punctuation, is_whitespace};
use crate::scan0::scan0;
use crate::token::kind::*;
use crate::token::{token_kind, token_len, IS_SAFE_REPARSE_POINT, KIND_MASK};

const DELIM_CAN_OPEN: u32 = 0x01;
const DELIM_CAN_CLOSE: u32 = 0x02;
const DELIM_KIND_MASK: u32 = KIND_MASK;

#[inline]
fn cc(input: &[u8], i: usize) -> u32 {
    if i < input.len() {
        input[i] as u32
    } else {
        0
    }
}

#[inline]
fn is_left_flanking(before: u32, after: u32) -> bool {
    if is_whitespace(after) || after == 0 {
        return false;
    }
    if !is_punctuation(after) {
        return true;
    }
    is_whitespace(before) || before == 0 || is_punctuation(before)
}

#[inline]
fn is_right_flanking(before: u32, after: u32) -> bool {
    if is_whitespace(before) || before == 0 {
        return false;
    }
    if !is_punctuation(before) {
        return true;
    }
    is_whitespace(after) || after == 0 || is_punctuation(after)
}

/// Resolve the whole input into a stream of semantic tokens.
pub fn semantic(input: &[u8], start_offset: usize, end_offset: usize) -> Vec<u32> {
    let mut s = Semantic::default();
    s.run(input, start_offset, end_offset);
    s.output
}

/// A reusable semantic analysis buffer. Reusing this across multiple `semantic` calls
/// eliminates heap allocations in the hot path (after initial growth).
#[derive(Default)]
pub struct Semantic {
    pub output: Vec<u32>,
    provisional: Vec<u32>,

    delims_data: Vec<u32>,
    delims_prov_idx: Vec<usize>,
    delims_remaining: Vec<usize>,

    match_opener_di: Vec<usize>,
    match_closer_di: Vec<usize>,
    match_used_len: Vec<usize>,
    opener_stack_di: Vec<usize>,

    link_opener_stack: Vec<usize>,
    link_matches: Vec<usize>,
    is_matched_link: Vec<bool>,

    opener_indices_buf: Vec<usize>,
}

impl Semantic {
    /// Clears and runs semantic resolution on the input.
    pub fn run(&mut self, input: &[u8], start_offset: usize, end_offset: usize) {
        self.output.clear();
        let mut pos = start_offset;
        while pos < end_offset {
            self.provisional.clear();
            let mut chunk_end_found = false;
            let chunk_start = pos;

            while pos < end_offset {
                let prev_len = self.provisional.len();
                let count = scan0(input, pos, end_offset, &mut self.provisional);
                if count == 0 {
                    pos += 1;
                    continue;
                }
                let mut added_len = 0usize;
                for i in prev_len..self.provisional.len() {
                    let tok = self.provisional[i];
                    let kind = token_kind(tok);
                    added_len += token_len(tok);
                    if kind == NEW_LINE && i > 0 && token_kind(self.provisional[i - 1]) == NEW_LINE {
                        chunk_end_found = true;
                    } else if kind == FENCED_OPEN || kind == THEMATIC_BREAK {
                        chunk_end_found = true;
                    }
                }
                pos += added_len;
                if added_len == 0 {
                    pos += 1;
                }
                if chunk_end_found {
                    break;
                }
            }

            if !self.provisional.is_empty() {
                self.process_chunk(input, chunk_start);
            }
        }
    }

    fn process_chunk(&mut self, input: &[u8], chunk_start_offset: usize) {
        self.delims_data.clear();
        self.delims_prov_idx.clear();
        self.delims_remaining.clear();

        // Phase 1: catalogue delimiters and their flanking.
        let mut input_pos = chunk_start_offset;
        for i in 0..self.provisional.len() {
            let tok = self.provisional[i];
            let kind = token_kind(tok);
            let len = token_len(tok);
            let original_flags = tok & IS_SAFE_REPARSE_POINT;

            if kind == ASTERISK_DELIMITER || kind == UNDERSCORE_DELIMITER || kind == TILDE_DELIMITER
            {
                let before = if input_pos > 0 { cc(input, input_pos - 1) } else { 0 };
                let after = cc(input, input_pos + len);

                let mut can_open = is_left_flanking(before, after);
                let mut can_close = is_right_flanking(before, after);

                if kind == UNDERSCORE_DELIMITER && can_open && can_close {
                    can_open = is_punctuation(before) || before == 0;
                    can_close = is_punctuation(after) || after == 0;
                }

                self.delims_prov_idx.push(i);
                self.delims_remaining.push(len);
                self.delims_data.push(
                    kind | original_flags
                        | if can_open { DELIM_CAN_OPEN } else { 0 }
                        | if can_close { DELIM_CAN_CLOSE } else { 0 },
                );
            }
            input_pos += len;
        }

        // Phase 2: stack-based emphasis pairing with the mod-3 rule.
        self.match_opener_di.clear();
        self.match_closer_di.clear();
        self.match_used_len.clear();
        self.opener_stack_di.clear();

        for di in 0..self.delims_data.len() {
            let data = self.delims_data[di];
            if data & DELIM_CAN_CLOSE != 0 {
                let kind = data & DELIM_KIND_MASK;
                let mut si = self.opener_stack_di.len() as i64 - 1;
                while si >= 0 && self.delims_remaining[di] > 0 {
                    let odi = self.opener_stack_di[si as usize];
                    let odata = self.delims_data[odi];
                    if (odata & DELIM_KIND_MASK) == kind && (odata & DELIM_CAN_OPEN) != 0 {
                        let op_len = token_len(self.provisional[self.delims_prov_idx[odi]]);
                        let cl_len = token_len(self.provisional[self.delims_prov_idx[di]]);
                        if (op_len + cl_len) % 3 == 0 && op_len % 3 != 0 && cl_len % 3 != 0 {
                            si -= 1;
                            continue;
                        }
                        let use_len = if self.delims_remaining[odi] >= 2
                            && self.delims_remaining[di] >= 2
                        {
                            2
                        } else {
                            1
                        };
                        self.match_opener_di.push(odi);
                        self.match_closer_di.push(di);
                        self.match_used_len.push(use_len);
                        self.delims_remaining[odi] -= use_len;
                        self.delims_remaining[di] -= use_len;
                        if self.delims_remaining[odi] == 0 {
                            self.opener_stack_di.remove(si as usize);
                        }
                        si = self.opener_stack_di.len() as i64 - 1;
                    } else {
                        si -= 1;
                    }
                }
            }
            if (self.delims_data[di] & DELIM_CAN_OPEN) != 0 && self.delims_remaining[di] > 0 {
                self.opener_stack_di.push(di);
            }
        }

        // Phase 2.5: link and image pairing.
        self.link_opener_stack.clear();
        self.link_matches.clear();
        self.is_matched_link.clear();
        self.is_matched_link.resize(self.provisional.len(), false);

        for i in 0..self.provisional.len() {
            let kind = token_kind(self.provisional[i]);
            if kind == LINK_OPEN {
                self.link_opener_stack.push(i);
            } else if kind == LINK_CLOSE && !self.link_opener_stack.is_empty() {
                let open_idx = self.link_opener_stack.pop().unwrap();
                let mut has_dest = false;
                let mut dest_open_idx = 0usize;
                let mut dest_close_idx = 0usize;
                if i + 1 < self.provisional.len()
                    && token_kind(self.provisional[i + 1]) == LINK_DEST_OPEN
                {
                    dest_open_idx = i + 1;
                    let mut j = dest_open_idx + 1;
                    while j < self.provisional.len() {
                        let k = token_kind(self.provisional[j]);
                        if k == LINK_DEST_CLOSE {
                            dest_close_idx = j;
                            has_dest = true;
                            break;
                        } else if k == NEW_LINE {
                            break;
                        }
                        j += 1;
                    }
                }
                if has_dest {
                    self.link_matches.push(open_idx);
                    self.link_matches.push(i);
                    self.link_matches.push(dest_open_idx);
                    self.link_matches.push(dest_close_idx);
                }
            }
        }

        let match_count = self.link_matches.len() / 4;
        let mut is_contained = vec![false; match_count];
        let mut m1 = 0;
        while m1 < self.link_matches.len() {
            let start1 = self.link_matches[m1];
            let end1 = self.link_matches[m1 + 3];
            let mut m2 = 0;
            while m2 < self.link_matches.len() {
                if m1 != m2 {
                    let start2 = self.link_matches[m2];
                    let end2 = self.link_matches[m2 + 3];
                    if start1 <= start2 && end1 >= end2 {
                        is_contained[m2 / 4] = true;
                    }
                }
                m2 += 4;
            }
            m1 += 4;
        }

        let mut m = 0;
        while m < self.link_matches.len() {
            if !is_contained[m / 4] {
                let start_idx = self.link_matches[m];
                let close_idx = self.link_matches[m + 1];
                let dest_open_idx = self.link_matches[m + 2];
                let dest_close_idx = self.link_matches[m + 3];
                self.is_matched_link[start_idx] = true;
                self.is_matched_link[close_idx] = true;
                self.is_matched_link[dest_open_idx] = true;
                self.is_matched_link[dest_close_idx] = true;
                if start_idx > 0 && token_kind(self.provisional[start_idx - 1]) == IMAGE_MARKER {
                    self.is_matched_link[start_idx - 1] = true;
                }
            }
            m += 4;
        }

        // Phase 3: emission and coalescing.
        let mut next_di_idx = 0usize;
        for i in 0..self.provisional.len() {
            let tok = self.provisional[i];
            let kind = token_kind(tok);
            let len = token_len(tok);
            let flags = tok & IS_SAFE_REPARSE_POINT;

            if next_di_idx < self.delims_prov_idx.len() && self.delims_prov_idx[next_di_idx] == i {
                let di = next_di_idx;
                next_di_idx += 1;
                self.emit_delimiter_tokens(di);
            } else {
                let is_demoted_link = (kind == LINK_OPEN
                    || kind == LINK_CLOSE
                    || kind == LINK_DEST_OPEN
                    || kind == LINK_DEST_CLOSE
                    || kind == IMAGE_MARKER)
                    && !self.is_matched_link[i];

                if kind == INLINE_TEXT || is_demoted_link {
                    if self.output.len() > 1 && kind == INLINE_TEXT && len == 1 {
                        let n = self.output.len();
                        let last = self.output[n - 1];
                        let last_kind = token_kind(last);
                        let last_len = token_len(last);
                        let prev_kind = token_kind(self.output[n - 2]);
                        if last_kind == WHITESPACE && prev_kind == INLINE_TEXT && last_len == 1 {
                            self.output[n - 2] += 2;
                            self.output.pop();
                        }
                    }
                    self.push_inline_text(len, flags);
                } else {
                    self.output.push(tok);
                }
            }
        }
    }

    fn emit_delimiter_tokens(&mut self, di: usize) {
        let data = self.delims_data[di];
        let kind = data & DELIM_KIND_MASK;
        let mut current_flags = data;

        for mi in 0..self.match_opener_di.len() {
            if self.match_closer_di[mi] == di {
                let ul = self.match_used_len[mi];
                let close_kind = if kind == TILDE_DELIMITER {
                    STRIKETHROUGH_CLOSE
                } else if ul == 2 {
                    STRONG_CLOSE
                } else {
                    EMPHASIS_CLOSE
                };
                self.output
                    .push(close_kind | ul as u32 | (current_flags & IS_SAFE_REPARSE_POINT));
                current_flags &= !IS_SAFE_REPARSE_POINT;
            }
        }

        if self.delims_remaining[di] > 0 {
            self.push_inline_text(self.delims_remaining[di], current_flags);
            current_flags &= !IS_SAFE_REPARSE_POINT;
        }

        self.opener_indices_buf.clear();
        for mi in 0..self.match_opener_di.len() {
            if self.match_opener_di[mi] == di {
                self.opener_indices_buf.push(mi);
            }
        }
        for idx in (0..self.opener_indices_buf.len()).rev() {
            let mi = self.opener_indices_buf[idx];
            let ul = self.match_used_len[mi];
            let open_kind = if kind == TILDE_DELIMITER {
                STRIKETHROUGH_OPEN
            } else if ul == 2 {
                STRONG_OPEN
            } else {
                EMPHASIS_OPEN
            };
            self.output
                .push(open_kind | ul as u32 | (current_flags & IS_SAFE_REPARSE_POINT));
            current_flags &= !IS_SAFE_REPARSE_POINT;
        }
    }

    fn push_inline_text(&mut self, len: usize, flags: u32) {
        if let Some(&last) = self.output.last() {
            if token_kind(last) == INLINE_TEXT {
                *self.output.last_mut().unwrap() += len as u32;
                return;
            }
        }
        self.output
            .push(INLINE_TEXT | len as u32 | (flags & IS_SAFE_REPARSE_POINT));
    }
}
