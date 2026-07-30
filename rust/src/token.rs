//! Provisional token model.
//!
//! Each token is a packed `u32` mirroring the JavaScript MixPad layout:
//!
//! ```text
//! bits  0..=15  length (in bytes, up to 65535 per token)
//! bits 16..=25  kind   (10 bits, 1024 possible kinds)
//! bits 26..=28  heading depth (0..=7)
//! bits 29..=30  flags
//! bit      31   unused (keeps every token value non-negative)
//! ```
//!
//! Unlike the JS version — which counts UTF-16 code units — lengths here count
//! **bytes**. This is self-consistent because tokens are only ever split at
//! ASCII boundaries; multi-byte UTF-8 sequences are consumed whole into text
//! runs, so every token boundary lands on a `char` boundary.

pub const LEN_MASK: u32 = 0xFFFF;
pub const KIND_MASK: u32 = 0x03FF_0000;
pub const FLAGS_MASK: u32 = 0x6000_0000;

pub const HEADING_DEPTH_SHIFT: u32 = 26;
pub const HEADING_DEPTH_MASK: u32 = 0x1C00_0000;

/// First token after a safe reparse boundary (bit 30).
pub const IS_SAFE_REPARSE_POINT: u32 = 0x4000_0000;
/// Token belongs to an unbalanced / error-recovered construct (bit 29).
pub const ERROR_UNBALANCED: u32 = 0x2000_0000;

#[inline(always)]
pub fn token_len(t: u32) -> usize {
    (t & LEN_MASK) as usize
}

#[inline(always)]
pub fn token_kind(t: u32) -> u32 {
    t & KIND_MASK
}

#[inline(always)]
pub fn token_flags(t: u32) -> u32 {
    t & FLAGS_MASK
}

#[inline(always)]
pub fn heading_depth(t: u32) -> u32 {
    (t & HEADING_DEPTH_MASK) >> HEADING_DEPTH_SHIFT
}

#[inline(always)]
pub fn depth_bits(depth: u32) -> u32 {
    (depth & 0x7) << HEADING_DEPTH_SHIFT
}

/// Token kind constants. Values match `parse/scan-tokens.js` exactly (kind
/// occupies bits 16..=25, so each value is `0xNN << 16`).
pub mod kind {
    pub const INLINE_TEXT: u32 = 0x01 << 16;
    pub const WHITESPACE: u32 = 0x02 << 16;
    pub const NEW_LINE: u32 = 0x03 << 16;
    pub const ENTITY_NAMED: u32 = 0x04 << 16;
    pub const ENTITY_DECIMAL: u32 = 0x05 << 16;
    pub const ENTITY_HEX: u32 = 0x06 << 16;
    pub const ESCAPED: u32 = 0x07 << 16;
    pub const BACKTICK_BOUNDARY: u32 = 0x08 << 16;
    pub const INLINE_CODE: u32 = 0x09 << 16;
    pub const FENCED_OPEN: u32 = 0x0A << 16;
    pub const FENCED_CONTENT: u32 = 0x0B << 16;
    pub const FENCED_CLOSE: u32 = 0x0C << 16;
    pub const ASTERISK_DELIMITER: u32 = 0x0D << 16;
    pub const UNDERSCORE_DELIMITER: u32 = 0x0E << 16;
    pub const TILDE_DELIMITER: u32 = 0x0F << 16;

    pub const HTML_TAG_OPEN: u32 = 0x10 << 16;
    pub const HTML_TAG_CLOSE: u32 = 0x11 << 16;
    pub const HTML_TAG_NAME: u32 = 0x12 << 16;
    pub const HTML_TAG_SELF_CLOSING: u32 = 0x13 << 16;
    pub const HTML_ATTRIBUTE_NAME: u32 = 0x14 << 16;
    pub const HTML_ATTRIBUTE_COLON: u32 = 0x15 << 16;
    pub const HTML_ATTRIBUTE_EQUALS: u32 = 0x16 << 16;
    pub const HTML_ATTRIBUTE_QUOTE: u32 = 0x17 << 16;
    pub const HTML_ATTRIBUTE_VALUE: u32 = 0x18 << 16;
    pub const PERCENT_ENCODING: u32 = 0x19 << 16;

    pub const HTML_COMMENT_OPEN: u32 = 0x1A << 16;
    pub const HTML_COMMENT_CONTENT: u32 = 0x1B << 16;
    pub const HTML_COMMENT_CLOSE: u32 = 0x1C << 16;

    pub const HTML_CDATA_OPEN: u32 = 0x1D << 16;
    pub const HTML_CDATA_CONTENT: u32 = 0x1E << 16;
    pub const HTML_CDATA_CLOSE: u32 = 0x1F << 16;

    pub const HTML_DOCTYPE_OPEN: u32 = 0x20 << 16;
    pub const HTML_DOCTYPE_CONTENT: u32 = 0x21 << 16;
    pub const HTML_DOCTYPE_CLOSE: u32 = 0x22 << 16;

    pub const XML_PI_OPEN: u32 = 0x23 << 16;
    pub const XML_PI_TARGET: u32 = 0x24 << 16;
    pub const XML_PI_CONTENT: u32 = 0x25 << 16;
    pub const XML_PI_CLOSE: u32 = 0x26 << 16;

    pub const HTML_RAW_TEXT: u32 = 0x27 << 16;

    pub const BULLET_LIST_MARKER: u32 = 0x28 << 16;
    pub const ORDERED_LIST_MARKER: u32 = 0x29 << 16;
    pub const TASK_LIST_MARKER: u32 = 0x2A << 16;

    pub const ATX_HEADING_OPEN: u32 = 0x2B << 16;
    pub const ATX_HEADING_CLOSE: u32 = 0x2C << 16;
    pub const SETEXT_HEADING_UNDERLINE: u32 = 0x2D << 16;

    pub const TABLE_PIPE: u32 = 0x2E << 16;
    pub const TABLE_DELIMITER_ROW_MARKER: u32 = 0x2F << 16;

    pub const FRONTMATTER_OPEN: u32 = 0x30 << 16;
    pub const FRONTMATTER_CONTENT: u32 = 0x31 << 16;
    pub const FRONTMATTER_CLOSE: u32 = 0x32 << 16;

    pub const BLOCKQUOTE_MARKER: u32 = 0x33 << 16;
    pub const THEMATIC_BREAK: u32 = 0x34 << 16;

    pub const LINK_OPEN: u32 = 0x35 << 16;
    pub const LINK_CLOSE: u32 = 0x36 << 16;
    pub const IMAGE_MARKER: u32 = 0x37 << 16;
    pub const LINK_DEST_OPEN: u32 = 0x38 << 16;
    pub const LINK_DEST_CLOSE: u32 = 0x39 << 16;
    pub const LINK_TITLE_QUOTE: u32 = 0x3A << 16;

    pub const EMPHASIS_OPEN: u32 = 0x3B << 16;
    pub const EMPHASIS_CLOSE: u32 = 0x3C << 16;
    pub const STRONG_OPEN: u32 = 0x3D << 16;
    pub const STRONG_CLOSE: u32 = 0x3E << 16;
    pub const STRIKETHROUGH_OPEN: u32 = 0x3F << 16;
    pub const STRIKETHROUGH_CLOSE: u32 = 0x40 << 16;
    pub const LINK_LABEL: u32 = 0x41 << 16;
    pub const LINK_DESTINATION: u32 = 0x42 << 16;
    pub const LINK_TITLE: u32 = 0x43 << 16;
    pub const TABLE_DELIMITER_CELL: u32 = 0x44 << 16;

    pub const FORMULA_OPEN: u32 = 0x45 << 16;
    pub const FORMULA_CONTENT: u32 = 0x46 << 16;
    pub const FORMULA_CLOSE: u32 = 0x47 << 16;

    pub const ANGLE_LINK_OPEN: u32 = 0x48 << 16;
    pub const ANGLE_LINK_URL: u32 = 0x49 << 16;
    pub const ANGLE_LINK_EMAIL: u32 = 0x4A << 16;
    pub const ANGLE_LINK_CLOSE: u32 = 0x4B << 16;
    pub const RAW_URL: u32 = 0x4C << 16;
    pub const WWW_AUTOLINK: u32 = 0x4D << 16;
    pub const EMAIL_AUTOLINK: u32 = 0x4E << 16;
}
