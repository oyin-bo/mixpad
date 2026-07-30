//! Phase-1 `scan0`: a single forward walk over the input bytes that emits a
//! stream of provisional tokens. It makes only cheap, local decisions; all
//! pairing and structural resolution is deferred to the semantic phase.

use crate::core::count_indentation;
use crate::html::{
    is_raw_text_element, scan_html_cdata, scan_html_comment, scan_html_doctype, scan_html_raw_text,
    scan_html_tag, scan_xml_pi,
};
use crate::scanners::*;
use crate::token::kind::*;
use crate::token::{
    depth_bits, token_flags, token_kind, token_len, ERROR_UNBALANCED, IS_SAFE_REPARSE_POINT,
};

#[inline]
fn scan_inline_text(input: &[u8], pos: usize, out: &mut Vec<u32>) -> usize {
    let n = out.len();
    if n > 1 {
        let last = out[n - 1];
        let last_kind = token_kind(last);
        let last_len = token_len(last);
        let prev_kind = token_kind(out[n - 2]);
        if last_kind == WHITESPACE
            && prev_kind == INLINE_TEXT
            && last_len == 1
            && pos > 0
            && input[pos - 1] == b' '
        {
            out[n - 2] += 2;
            out.pop();
            return 1;
        }
    }
    if n > 0 && token_kind(out[n - 1]) == INLINE_TEXT {
        out[n - 1] += 1;
    } else {
        out.push(INLINE_TEXT | 1);
    }
    1
}

#[inline]
fn mark_reparse(out: &mut [u32], token_start_index: usize, should: bool) {
    if should && out.len() > token_start_index {
        out[token_start_index] |= IS_SAFE_REPARSE_POINT;
    }
}

/// Scan from `start_offset` up to a resolution point, appending provisional
/// tokens to `output`. Returns the number of tokens added.
pub fn scan0(input: &[u8], start_offset: usize, end_offset: usize, output: &mut Vec<u32>) -> usize {
    let start_len = output.len();
    let mut offset = start_offset;

    let mut line_start_offset = start_offset;
    let mut line_token_start_index = output.len();
    let mut line_could_be_setext_text = true;

    let mut next_token_is_reparse_start = start_offset == 0;
    let mut error_recovery_mode = false;

    // Front matter is only valid at the very start of the document.
    if start_offset == 0 {
        let consumed = scan_frontmatter(input, start_offset, end_offset, output);
        if consumed > 0 {
            offset += consumed;
            line_start_offset = offset;
            line_token_start_index = output.len();
            line_could_be_setext_text = false;
        }
    }

    'outer: while offset < end_offset {
        let token_start_index = output.len();
        let should_mark = next_token_is_reparse_start && !error_recovery_mode;
        next_token_is_reparse_start = false;

        let ch = input[offset] as u32;
        offset += 1;
        let cur = offset - 1;

        match ch {
            10 | 0 => {
                if line_could_be_setext_text && line_token_start_index < output.len() {
                    let check = check_setext_underline(input, offset, end_offset);
                    if check.valid {
                        let db = depth_bits(check.depth);
                        for i in line_token_start_index..output.len() {
                            output[i] = (output[i] & !(0x7 << 26)) | db;
                        }
                        output.push(NEW_LINE | 1);
                        output.push(check.underline_token_length as u32 | SETEXT_HEADING_UNDERLINE | db);
                        offset += check.consumed_length;
                        line_start_offset = offset;
                        line_token_start_index = output.len();
                        line_could_be_setext_text = true;
                        continue 'outer;
                    }
                }
                output.push(NEW_LINE | 1);
                line_start_offset = offset;
                line_token_start_index = output.len();
                line_could_be_setext_text = true;
            }

            13 => {
                let is_lf = offset < end_offset && input[offset] == b'\n';
                let newline_length = if is_lf { 2 } else { 1 };
                if is_lf {
                    offset += 1;
                }
                if line_could_be_setext_text && line_token_start_index < output.len() {
                    let check = check_setext_underline(input, offset, end_offset);
                    if check.valid {
                        let db = depth_bits(check.depth);
                        for i in line_token_start_index..output.len() {
                            output[i] = (output[i] & !(0x7 << 26)) | db;
                        }
                        output.push(NEW_LINE | newline_length as u32);
                        output.push(check.underline_token_length as u32 | SETEXT_HEADING_UNDERLINE | db);
                        offset += check.consumed_length;
                        line_start_offset = offset;
                        line_token_start_index = output.len();
                        line_could_be_setext_text = true;
                        continue 'outer;
                    }
                }
                output.push(NEW_LINE | newline_length as u32);
                line_start_offset = offset;
                line_token_start_index = output.len();
                line_could_be_setext_text = true;
            }

            38 => {
                // '&'
                let entity = scan_entity(input, cur, end_offset);
                if entity != 0 {
                    let length = token_len(entity);
                    let flagged = if should_mark { entity | IS_SAFE_REPARSE_POINT } else { entity };
                    output.push(flagged);
                    offset = cur + length;
                } else {
                    scan_inline_text(input, cur, output);
                    mark_reparse(output, token_start_index, should_mark);
                }
                continue 'outer;
            }

            92 => {
                // '\'
                let esc = scan_escaped(input, cur, end_offset);
                if esc != 0 {
                    output.push(esc);
                    offset = cur + token_len(esc);
                    continue 'outer;
                }
                scan_inline_text(input, cur, output);
                continue 'outer;
            }

            96 => {
                // '`'
                let consumed = scan_fenced_block(input, cur, end_offset, output);
                if consumed > 0 {
                    mark_reparse(output, token_start_index, should_mark);
                    return output.len() - start_len;
                }
                let consumed_bt = scan_backtick_inline(input, cur, end_offset, output);
                if consumed_bt == 0 {
                    scan_inline_text(input, cur, output);
                    mark_reparse(output, token_start_index, should_mark);
                    continue 'outer;
                }
                mark_reparse(output, token_start_index, should_mark);
                return output.len() - start_len;
            }

            126 => {
                // '~'
                let consumed_fence = scan_fenced_block(input, cur, end_offset, output);
                if consumed_fence > 0 {
                    mark_reparse(output, token_start_index, should_mark);
                    return output.len() - start_len;
                }
                let consumed_emphasis = scan_emphasis(input, cur, end_offset, output);
                if consumed_emphasis > 0 {
                    mark_reparse(output, token_start_index, should_mark);
                    offset = cur + consumed_emphasis;
                    continue 'outer;
                }
                scan_inline_text(input, cur, output);
                mark_reparse(output, token_start_index, should_mark);
                continue 'outer;
            }

            42 => {
                // '*'
                let thematic = scan_thematic_break(input, cur, end_offset, output);
                if thematic > 0 {
                    line_could_be_setext_text = false;
                    mark_reparse(output, token_start_index, should_mark);
                    offset = cur + thematic;
                    continue 'outer;
                }
                let list = scan_bullet_list_marker(input, cur, end_offset, output);
                if list > 0 {
                    mark_reparse(output, token_start_index, should_mark);
                    offset = cur + list;
                    continue 'outer;
                }
                let emphasis = scan_emphasis(input, cur, end_offset, output);
                if emphasis > 0 {
                    mark_reparse(output, token_start_index, should_mark);
                    offset = cur + emphasis;
                    continue 'outer;
                }
                scan_inline_text(input, cur, output);
                mark_reparse(output, token_start_index, should_mark);
                continue 'outer;
            }

            95 => {
                // '_'
                let thematic = scan_thematic_break(input, cur, end_offset, output);
                if thematic > 0 {
                    line_could_be_setext_text = false;
                    mark_reparse(output, token_start_index, should_mark);
                    offset = cur + thematic;
                    continue 'outer;
                }
                let emphasis = scan_emphasis(input, cur, end_offset, output);
                if emphasis > 0 {
                    mark_reparse(output, token_start_index, should_mark);
                    offset = cur + emphasis;
                    continue 'outer;
                }
                scan_inline_text(input, cur, output);
                mark_reparse(output, token_start_index, should_mark);
                continue 'outer;
            }

            60 => {
                // '<'
                let autolink = scan_angle_autolink(input, cur, end_offset, output);
                if autolink > 0 {
                    mark_reparse(output, token_start_index, should_mark);
                    offset = cur + autolink;
                    continue 'outer;
                }

                let mut html_consumed;
                let next = if offset < end_offset { input[offset] } else { 0 };
                if next == b'!' {
                    if offset + 1 < end_offset
                        && input[offset + 1] == b'-'
                        && offset + 2 < end_offset
                        && input[offset + 2] == b'-'
                    {
                        html_consumed = scan_html_comment(input, cur, end_offset, output);
                        if html_consumed > 0 {
                            line_could_be_setext_text = false;
                        }
                    } else if offset + 1 < end_offset && input[offset + 1] == b'[' {
                        html_consumed = scan_html_cdata(input, cur, end_offset, output);
                        if html_consumed > 0 {
                            line_could_be_setext_text = false;
                        }
                    } else {
                        html_consumed = scan_html_doctype(input, cur, end_offset, output);
                        if html_consumed > 0 {
                            line_could_be_setext_text = false;
                        }
                    }
                } else if next == b'?' {
                    html_consumed = scan_xml_pi(input, cur, end_offset, output);
                    if html_consumed > 0 {
                        line_could_be_setext_text = false;
                    }
                } else {
                    let before = output.len();
                    html_consumed = scan_html_tag(input, cur, end_offset, output);
                    if html_consumed > 0 && output.len() > before {
                        let mut tag_open = 0u32;
                        let mut tag_name_tok = 0u32;
                        let mut tag_name_index = 0usize;
                        for i in before..output.len() {
                            if token_kind(output[i]) == HTML_TAG_OPEN {
                                tag_open = output[i];
                            }
                            if token_kind(output[i]) == HTML_TAG_NAME {
                                tag_name_tok = output[i];
                                tag_name_index = i;
                            }
                        }
                        if tag_open != 0
                            && token_len(tag_open) == 1
                            && tag_name_tok != 0
                            && token_kind(output[output.len() - 1]) == HTML_TAG_CLOSE
                        {
                            let mut actual_offset = cur;
                            for i in before..tag_name_index {
                                actual_offset += token_len(output[i]);
                            }
                            let tag_name_len = token_len(tag_name_tok);
                            if is_raw_text_element(input, actual_offset, tag_name_len) {
                                let raw_start = cur + html_consumed;
                                let raw_consumed = scan_html_raw_text(
                                    input,
                                    raw_start,
                                    end_offset,
                                    actual_offset,
                                    tag_name_len,
                                    output,
                                );
                                html_consumed += raw_consumed;
                            }
                        }
                    }
                }

                if html_consumed > 0 {
                    mark_reparse(output, token_start_index, should_mark);
                    offset = cur + html_consumed;
                    continue 'outer;
                }

                scan_inline_text(input, cur, output);
                mark_reparse(output, token_start_index, should_mark);
                continue 'outer;
            }

            9 | 32 => {
                // whitespace
                let n = output.len();
                if n > 0 && token_kind(output[n - 1]) == WHITESPACE {
                    output[n - 1] += 1;
                } else {
                    output.push(WHITESPACE | 1);
                }
                if line_token_start_index == output.len() - 1 {
                    let ws_length = token_len(output[output.len() - 1]);
                    let indent = count_indentation(
                        input,
                        line_start_offset,
                        line_start_offset + ws_length,
                    );
                    if indent >= 4 {
                        line_could_be_setext_text = false;
                    }
                }
                continue 'outer;
            }

            35 => {
                // '#'
                let heading = scan_atx_heading(input, cur, end_offset, output);
                if heading > 0 {
                    mark_reparse(output, token_start_index, should_mark);
                    return output.len() - start_len;
                }
                scan_inline_text(input, cur, output);
                mark_reparse(output, token_start_index, should_mark);
                continue 'outer;
            }

            62 => {
                // '>'
                let bq = scan_blockquote(input, cur, end_offset, output);
                if bq > 0 {
                    line_could_be_setext_text = false;
                    mark_reparse(output, token_start_index, should_mark);
                    offset = cur + bq;
                    continue 'outer;
                }
                scan_inline_text(input, cur, output);
                mark_reparse(output, token_start_index, should_mark);
                continue 'outer;
            }

            45 => {
                // '-'
                let thematic = scan_thematic_break(input, cur, end_offset, output);
                if thematic > 0 {
                    line_could_be_setext_text = false;
                    mark_reparse(output, token_start_index, should_mark);
                    offset = cur + thematic;
                    continue 'outer;
                }
                let list = scan_bullet_list_marker(input, cur, end_offset, output);
                if list > 0 {
                    line_could_be_setext_text = false;
                    mark_reparse(output, token_start_index, should_mark);
                    offset = cur + list;
                    continue 'outer;
                }
                scan_inline_text(input, cur, output);
                mark_reparse(output, token_start_index, should_mark);
                continue 'outer;
            }

            43 => {
                // '+'
                let list = scan_bullet_list_marker(input, cur, end_offset, output);
                if list > 0 {
                    line_could_be_setext_text = false;
                    mark_reparse(output, token_start_index, should_mark);
                    offset = cur + list;
                    continue 'outer;
                }
                scan_inline_text(input, cur, output);
                mark_reparse(output, token_start_index, should_mark);
                continue 'outer;
            }

            48..=57 => {
                // digit
                let list = scan_ordered_list_marker(input, cur, end_offset, output);
                if list > 0 {
                    line_could_be_setext_text = false;
                    offset = cur + list;
                    continue 'outer;
                }
                scan_inline_text(input, cur, output);
                continue 'outer;
            }

            33 => {
                // '!'
                let img = scan_image_marker(input, cur, end_offset, output);
                if img > 0 {
                    mark_reparse(output, token_start_index, should_mark);
                    continue 'outer;
                }
                scan_inline_text(input, cur, output);
                mark_reparse(output, token_start_index, should_mark);
                continue 'outer;
            }

            40 => {
                // '('
                scan_link_dest_open(input, cur, end_offset, output);
                mark_reparse(output, token_start_index, should_mark);
                continue 'outer;
            }

            36 => {
                // '$' — try a display-math formula block
                let formula = scan_formula_block(input, cur, end_offset, output);
                if formula > 0 {
                    mark_reparse(output, token_start_index, should_mark);
                    return output.len() - start_len;
                }
                scan_inline_text(input, cur, output);
                mark_reparse(output, token_start_index, should_mark);
                continue 'outer;
            }

            124 => {
                // '|' — table pipe (structure decided while building)
                let pipe = scan_table_pipe(input, cur, end_offset, output);
                if pipe > 0 {
                    mark_reparse(output, token_start_index, should_mark);
                    offset = cur + pipe;
                    continue 'outer;
                }
                scan_inline_text(input, cur, output);
                mark_reparse(output, token_start_index, should_mark);
                continue 'outer;
            }

            41 => {
                // ')'
                scan_link_dest_close(input, cur, end_offset, output);
                mark_reparse(output, token_start_index, should_mark);
                continue 'outer;
            }

            91 => {
                // '['
                let task = scan_task_list_marker(input, cur, end_offset, output);
                if task > 0 {
                    line_could_be_setext_text = false;
                    offset = cur + task;
                    continue 'outer;
                }
                scan_link_open(input, cur, end_offset, output);
                mark_reparse(output, token_start_index, should_mark);
                continue 'outer;
            }

            93 => {
                // ']'
                scan_link_close(input, cur, end_offset, output);
                mark_reparse(output, token_start_index, should_mark);
                continue 'outer;
            }

            104 => {
                // 'h' — raw URL autolink
                let url = scan_raw_url_autolink(input, cur, end_offset);
                if url != 0 {
                    let length = token_len(url);
                    output.push(url);
                    mark_reparse(output, token_start_index, should_mark);
                    offset = cur + length;
                    continue 'outer;
                }
                scan_inline_text(input, cur, output);
                mark_reparse(output, token_start_index, should_mark);
                continue 'outer;
            }

            119 | 87 => {
                // 'w' | 'W' — www autolink
                let prev = if cur > line_start_offset { input[cur - 1] as u32 } else { 0 };
                let www = scan_www_autolink(input, cur, end_offset, prev);
                if www != 0 {
                    let length = token_len(www);
                    output.push(www);
                    mark_reparse(output, token_start_index, should_mark);
                    offset = cur + length;
                    continue 'outer;
                }
                scan_inline_text(input, cur, output);
                mark_reparse(output, token_start_index, should_mark);
                continue 'outer;
            }

            _ => {
                scan_inline_text(input, cur, output);
                continue 'outer;
            }
        }

        // Post-processing (reached by the newline arms that fall through):
        mark_reparse(output, token_start_index, should_mark);

        if output.len() > token_start_index {
            let last = output[output.len() - 1];
            let last_kind = token_kind(last);
            let last_flags = token_flags(last);
            if last_flags & ERROR_UNBALANCED != 0 {
                error_recovery_mode = true;
            }
            if last_kind == NEW_LINE && output.len() >= 2 {
                let prev_kind = token_kind(output[output.len() - 2]);
                if (prev_kind == NEW_LINE || prev_kind == WHITESPACE) && !error_recovery_mode {
                    next_token_is_reparse_start = true;
                }
            }
        }
    }

    output.len() - start_len
}
