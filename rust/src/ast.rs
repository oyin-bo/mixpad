//! AST construction. Streams the resolved semantic tokens into a node tree.
//!
//! Nodes live in a flat arena (`Vec<Node>`); parent/child links are `usize`
//! indices. Source text is never copied into nodes — `Document::text` slices the
//! original string lazily.

use crate::html::is_void_element;
use crate::semantic::semantic;
use crate::token::kind::*;
use crate::token::{heading_depth, token_kind, token_len};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum NodeType {
    Document,
    Paragraph,
    Heading,
    Blockquote,
    List,
    ListItem,
    FencedCodeBlock,
    ThematicBreak,
    Table,
    TableRow,
    TableCell,
    Frontmatter,
    FormulaBlock,
    Text,
    Emphasis,
    Strong,
    Strikethrough,
    Link,
    Image,
    InlineCode,
    Autolink,
    HtmlComment,
    HtmlCData,
    HtmlDocType,
    XmlProcessingInstruction,
    HtmlElement,
}

/// Table cell alignment.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Align {
    None,
    Left,
    Center,
    Right,
}

/// A single AST node. Optional fields are declared uniformly so every node has
/// the same shape regardless of kind.
#[derive(Clone, Debug)]
pub struct Node {
    pub kind: NodeType,
    pub start: usize,
    pub end: usize,
    pub children: Vec<usize>,
    pub level: u8,
    pub ordered: bool,
    pub indent: usize,
    pub content_indent: usize,
    pub tag_name: String,
    pub attributes: Vec<(String, Option<String>)>,
    pub dest_start: usize,
    pub dest_end: usize,
    pub info_start: usize,
    pub info_end: usize,
    pub align: Align,
    pub is_header: bool,
}

impl Node {
    fn new(kind: NodeType, start: usize) -> Self {
        Node {
            kind,
            start,
            end: 0,
            children: Vec::new(),
            level: 0,
            ordered: false,
            indent: 0,
            content_indent: 0,
            tag_name: String::new(),
            attributes: Vec::new(),
            dest_start: 0,
            dest_end: 0,
            info_start: 0,
            info_end: 0,
            align: Align::None,
            is_header: false,
        }
    }
}

/// A parsed document: the source, the node arena, and the root index.
pub struct Document {
    pub source: String,
    pub nodes: Vec<Node>,
    pub root: usize,
}

impl Document {
    /// Materialise the text of a node by concatenating descendant text, or
    /// slicing the source span for leaf nodes.
    pub fn text(&self, id: usize) -> String {
        let node = &self.nodes[id];
        if !node.children.is_empty() {
            let mut s = String::new();
            for &c in &node.children {
                s.push_str(&self.text(c));
            }
            s
        } else if node.end > node.start {
            self.source[node.start..node.end].to_string()
        } else {
            String::new()
        }
    }

    /// Link/image/autolink destination URL.
    pub fn url(&self, id: usize) -> String {
        let node = &self.nodes[id];
        if node.dest_start < node.dest_end {
            self.source[node.dest_start..node.dest_end].to_string()
        } else {
            String::new()
        }
    }

    /// Fenced code info string (language), trimmed.
    pub fn language(&self, id: usize) -> String {
        let node = &self.nodes[id];
        if node.info_end > node.info_start {
            self.source[node.info_start..node.info_end].trim().to_string()
        } else {
            String::new()
        }
    }
}

pub(crate) struct Builder<'a> {
    source: &'a str,
    nodes: Vec<Node>,
    block_stack: Vec<usize>,
    inline_stack: Vec<usize>,
    resume_index: usize,
    pending_ws_start: i64,
}

impl<'a> Builder<'a> {
    fn new(source: &'a str) -> Self {
        let mut nodes = Vec::new();
        nodes.push(Node::new(NodeType::Document, 0));
        Builder {
            source,
            nodes,
            block_stack: vec![0],
            inline_stack: Vec::new(),
            resume_index: 0,
            pending_ws_start: -1,
        }
    }

    fn bytes(&self) -> &[u8] {
        self.source.as_bytes()
    }

    fn new_node(&mut self, kind: NodeType, start: usize) -> usize {
        let id = self.nodes.len();
        self.nodes.push(Node::new(kind, start));
        id
    }

    fn active_parent(&self) -> usize {
        if let Some(&top) = self.inline_stack.last() {
            top
        } else {
            *self.block_stack.last().unwrap()
        }
    }

    fn active_block(&self) -> usize {
        *self.block_stack.last().unwrap()
    }

    fn kind_of(&self, id: usize) -> NodeType {
        self.nodes[id].kind
    }

    fn append(&mut self, node: usize) {
        let parent = self.active_parent();
        self.nodes[parent].children.push(node);
    }

    fn push_block(&mut self, node: usize) {
        self.append(node);
        self.block_stack.push(node);
    }

    fn extend_ancestors(&mut self, end_pos: usize) {
        for &b in &self.block_stack {
            if self.nodes[b].end < end_pos {
                self.nodes[b].end = end_pos;
            }
        }
    }

    fn flush_pending_ws(&mut self, upto_pos: usize) {
        if self.pending_ws_start == -1 {
            return;
        }
        let parent = self.active_parent();
        let last_is_text = self
            .nodes[parent]
            .children
            .last()
            .map(|&c| self.nodes[c].kind == NodeType::Text)
            .unwrap_or(false);
        if last_is_text {
            let last = *self.nodes[parent].children.last().unwrap();
            self.nodes[last].end = upto_pos;
        } else {
            let start = self.pending_ws_start as usize;
            let t = self.new_node(NodeType::Text, start);
            self.nodes[t].end = upto_pos;
            self.append(t);
        }
        self.pending_ws_start = -1;
    }

    fn open_list_item(&mut self, tokens: &[u32], t_idx: usize, pos: usize, is_ordered: bool) {
        let mut active = self.active_block();
        if self.kind_of(active) == NodeType::Paragraph {
            self.block_stack.pop();
            active = self.active_block();
        }

        let mut current_indent = 0usize;
        if t_idx > 0 && token_kind(tokens[t_idx - 1]) == WHITESPACE {
            current_indent = token_len(tokens[t_idx - 1]);
        }

        if self.kind_of(active) == NodeType::ListItem {
            let parent_list = self.block_stack[self.block_stack.len() - 2];
            let parent_indent = self.nodes[parent_list].indent;
            if current_indent > parent_indent {
                let list = self.new_node(NodeType::List, pos);
                self.nodes[list].ordered = is_ordered;
                self.nodes[list].indent = current_indent;
                self.push_block(list);
                let item = self.new_node(NodeType::ListItem, pos);
                self.push_block(item);
                return;
            }
            if current_indent < parent_indent {
                self.block_stack.pop();
                while !self.block_stack.is_empty() {
                    let top = self.active_block();
                    match self.kind_of(top) {
                        NodeType::List => {
                            if self.nodes[top].indent > current_indent {
                                self.block_stack.pop();
                                if self.kind_of(self.active_block()) == NodeType::ListItem {
                                    self.block_stack.pop();
                                }
                            } else {
                                break;
                            }
                        }
                        NodeType::ListItem => {
                            self.block_stack.pop();
                        }
                        _ => break,
                    }
                }
            } else {
                self.block_stack.pop();
            }
            active = self.active_block();
        }

        if self.kind_of(active) != NodeType::List {
            let list = self.new_node(NodeType::List, pos);
            self.nodes[list].ordered = is_ordered;
            self.nodes[list].indent = current_indent;
            self.push_block(list);
        } else if self.nodes[active].ordered != is_ordered {
            self.block_stack.pop();
            let list = self.new_node(NodeType::List, pos);
            self.nodes[list].ordered = is_ordered;
            self.nodes[list].indent = current_indent;
            self.push_block(list);
        }

        let item = self.new_node(NodeType::ListItem, pos);
        self.push_block(item);
    }

    fn build_html_tag(&mut self, tokens: &[u32], t_idx: usize, pos: usize, open_len: usize) -> usize {
        let is_closing = open_len == 2;
        let mut tag_name = String::new();
        let mut tag_name_start = 0usize;
        let mut tag_name_len = 0usize;
        let mut self_closing = false;
        let mut tag_end_pos: i64 = -1;
        let mut attributes: Vec<(String, Option<String>)> = Vec::new();
        let mut idx = t_idx + 1;
        let mut current_pos = pos + open_len;

        while idx < tokens.len() {
            let k = token_kind(tokens[idx]);
            let l = token_len(tokens[idx]);
            if k == HTML_TAG_NAME {
                tag_name_start = current_pos;
                tag_name_len = l;
                tag_name = self.source[current_pos..current_pos + l].to_ascii_lowercase();
            } else if k == HTML_TAG_CLOSE {
                current_pos += l;
                tag_end_pos = current_pos as i64;
                idx += 1;
                break;
            } else if k == HTML_TAG_SELF_CLOSING {
                self_closing = true;
                current_pos += l;
                tag_end_pos = current_pos as i64;
                idx += 1;
                break;
            } else if k == HTML_ATTRIBUTE_NAME {
                attributes.push((self.source[current_pos..current_pos + l].to_string(), None));
            } else if k == HTML_ATTRIBUTE_VALUE {
                if let Some(last) = attributes.last_mut() {
                    last.1 = Some(self.source[current_pos..current_pos + l].to_string());
                }
            } else if k == HTML_ATTRIBUTE_QUOTE || k == HTML_ATTRIBUTE_EQUALS {
                if let Some(last) = attributes.last_mut() {
                    if last.1.is_none() {
                        last.1 = Some(String::new());
                    }
                }
            }
            current_pos += l;
            idx += 1;
        }
        if tag_end_pos == -1 {
            tag_end_pos = current_pos as i64;
        }
        let tag_end_pos = tag_end_pos as usize;

        if is_closing {
            let mut match_index: i64 = -1;
            for i in (0..self.block_stack.len()).rev() {
                let node = self.block_stack[i];
                if self.kind_of(node) == NodeType::Document {
                    break;
                }
                if self.kind_of(node) == NodeType::HtmlElement && self.nodes[node].tag_name == tag_name
                {
                    match_index = i as i64;
                    break;
                }
            }
            if match_index != -1 {
                while self.block_stack.len() > match_index as usize {
                    let popped = self.block_stack.pop().unwrap();
                    self.nodes[popped].end = tag_end_pos;
                }
            } else {
                let t = self.new_node(NodeType::Text, pos);
                self.nodes[t].end = tag_end_pos;
                self.append(t);
            }
        } else {
            let el = self.new_node(NodeType::HtmlElement, pos);
            self.nodes[el].tag_name = tag_name;
            self.nodes[el].attributes = attributes;
            self.nodes[el].end = tag_end_pos;
            self.append(el);
            let is_void = tag_name_len > 0 && is_void_element(self.bytes(), tag_name_start, tag_name_len);
            if !self_closing && !is_void {
                self.block_stack.push(el);
            }
        }

        self.resume_index = idx;
        tag_end_pos
    }

    fn build_angle_autolink(&mut self, tokens: &[u32], t_idx: usize, pos: usize, open_len: usize) -> usize {
        let mut idx = t_idx + 1;
        let mut current_pos = pos + open_len;
        while idx < tokens.len() {
            let l = token_len(tokens[idx]);
            if token_kind(tokens[idx]) == ANGLE_LINK_CLOSE {
                current_pos += l;
                idx += 1;
                break;
            }
            current_pos += l;
            idx += 1;
        }
        let auto = self.new_node(NodeType::Autolink, pos);
        self.nodes[auto].end = current_pos;
        self.nodes[auto].dest_start = pos + 1;
        self.nodes[auto].dest_end = current_pos - 1;
        let text = self.new_node(NodeType::Text, pos + 1);
        self.nodes[text].end = current_pos - 1;
        self.nodes[auto].children.push(text);
        self.append(auto);
        self.resume_index = idx;
        current_pos
    }

    fn consume_until(
        &mut self,
        tokens: &[u32],
        t_idx: usize,
        pos: usize,
        close_kind: u32,
        node: usize,
    ) -> usize {
        let mut idx = t_idx + 1;
        let mut current_pos = pos + token_len(tokens[t_idx]);
        while idx < tokens.len() {
            let l = token_len(tokens[idx]);
            if token_kind(tokens[idx]) == close_kind {
                current_pos += l;
                idx += 1;
                break;
            }
            current_pos += l;
            idx += 1;
        }
        self.nodes[node].end = current_pos;
        self.append(node);
        idx
    }

    /// Whether any token on the current line (up to the next newline) is a pipe.
    fn line_has_pipe(&self, tokens: &[u32], from_t_idx: usize) -> bool {
        for &tok in &tokens[from_t_idx..] {
            let k = token_kind(tok);
            if k == NEW_LINE {
                break;
            }
            if k == TABLE_PIPE {
                return true;
            }
        }
        false
    }

    /// Whether source span `[start,end)` is a GFM delimiter cell (`:?-{3,}:?`).
    fn is_delimiter_cell(&self, start: usize, end: usize) -> bool {
        let s = self.source.as_bytes();
        let mut i = start;
        let mut j = end;
        while i < j && (s[i] == b' ' || s[i] == b'\t') {
            i += 1;
        }
        while j > i && (s[j - 1] == b' ' || s[j - 1] == b'\t') {
            j -= 1;
        }
        if i >= j {
            return false;
        }
        if s[i] == b':' {
            i += 1;
        }
        if j > i && s[j - 1] == b':' {
            j -= 1;
        }
        if i >= j {
            return false;
        }
        for k in i..j {
            if s[k] != b'-' {
                return false;
            }
        }
        (j - i) >= 3
    }

    /// Alignment implied by the colons in a delimiter cell span.
    fn delimiter_align(&self, start: usize, end: usize) -> Align {
        let s = self.source.as_bytes();
        let mut i = start;
        let mut j = end;
        while i < j && (s[i] == b' ' || s[i] == b'\t') {
            i += 1;
        }
        while j > i && (s[j - 1] == b' ' || s[j - 1] == b'\t') {
            j -= 1;
        }
        let left = i < j && s[i] == b':';
        let right = j > i && s[j - 1] == b':';
        match (left, right) {
            (true, true) => Align::Center,
            (true, false) => Align::Left,
            (false, true) => Align::Right,
            _ => Align::None,
        }
    }

    /// Whether the token run from `from_t_idx` to the next newline is a valid
    /// GFM delimiter row.
    fn is_delimiter_line(&self, tokens: &[u32], from_t_idx: usize, from_pos: usize) -> bool {
        let mut pos = from_pos;
        let mut has_pipe = false;
        let mut cell_count = 0usize;
        for &tok in &tokens[from_t_idx..] {
            let k = token_kind(tok);
            let l = token_len(tok);
            if k == NEW_LINE {
                break;
            }
            if k == TABLE_PIPE {
                has_pipe = true;
            } else if k == INLINE_TEXT {
                if !self.is_delimiter_cell(pos, pos + l) {
                    return false;
                }
                cell_count += 1;
            } else if k != WHITESPACE {
                return false;
            }
            pos += l;
        }
        has_pipe && cell_count > 0
    }

    /// Whether the current line (which may lack a leading pipe) is a table header:
    /// it contains pipes and the next line is a delimiter row.
    fn current_line_is_table_header(
        &self,
        tokens: &[u32],
        from_t_idx: usize,
        from_pos: usize,
    ) -> bool {
        let mut pos = from_pos;
        let mut has_pipe = false;
        let mut newline_t: i64 = -1;
        let mut newline_pos = pos;
        for i in from_t_idx..tokens.len() {
            let k = token_kind(tokens[i]);
            let l = token_len(tokens[i]);
            if k == NEW_LINE {
                newline_t = i as i64;
                newline_pos = pos;
                break;
            }
            if k == TABLE_PIPE {
                has_pipe = true;
            }
            pos += l;
        }
        if !has_pipe || newline_t == -1 {
            return false;
        }
        let next_line_t = newline_t as usize + 1;
        let next_line_pos = newline_pos + token_len(tokens[newline_t as usize]);
        next_line_t < tokens.len() && self.is_delimiter_line(tokens, next_line_t, next_line_pos)
    }

    /// Trim trailing whitespace from a table cell's final text child.
    fn trim_cell_trailing_whitespace(&mut self, cell: usize) {
        let last = match self.nodes[cell].children.last() {
            Some(&c) if self.nodes[c].kind == NodeType::Text => c,
            _ => return,
        };
        let trimmed_len = self.source[self.nodes[last].start..self.nodes[last].end]
            .trim_end()
            .len();
        if trimmed_len == 0 {
            self.nodes[cell].children.pop();
        } else {
            self.nodes[last].end = self.nodes[last].start + trimmed_len;
        }
    }

    /// Consume the delimiter row following a header, applying per-cell alignment
    /// to the header and closing the table when the next line does not continue
    /// it. Sets `resume_index` to the delimiter row's newline; returns the byte
    /// position just past that row.
    fn consume_delimiter_row(
        &mut self,
        tokens: &[u32],
        t_idx: usize,
        pos: usize,
        closed_row: usize,
    ) -> usize {
        let mut t_idx = t_idx + 1;
        let mut alignments: Vec<Align> = Vec::new();
        let mut saw_cell = false;
        let mut cur_align = Align::None;
        let mut pos = pos;
        while t_idx < tokens.len() {
            let dk = token_kind(tokens[t_idx]);
            let dl = token_len(tokens[t_idx]);
            let dpos = pos;
            pos += dl;
            if dk == NEW_LINE {
                break;
            }
            if dk == TABLE_PIPE {
                if saw_cell {
                    alignments.push(cur_align);
                    saw_cell = false;
                    cur_align = Align::None;
                }
            } else if dk == INLINE_TEXT {
                saw_cell = true;
                cur_align = self.delimiter_align(dpos, dpos + dl);
            }
            t_idx += 1;
        }
        if saw_cell {
            alignments.push(cur_align);
        }
        let cells = self.nodes[closed_row].children.clone();
        let mut ci = 0usize;
        for c in cells {
            if self.nodes[c].kind != NodeType::TableCell {
                continue;
            }
            if ci < alignments.len() && alignments[ci] != Align::None {
                self.nodes[c].align = alignments[ci];
            }
            ci += 1;
        }
        let peek_t = t_idx + 1;
        if peek_t >= tokens.len() || !self.line_has_pipe(tokens, peek_t) {
            if self.kind_of(self.active_block()) == NodeType::Table {
                self.block_stack.pop();
            }
        }
        self.resume_index = t_idx;
        pos
    }

    fn consume_chunk(&mut self, tokens: &[u32], start_offset: usize) {
        if tokens.is_empty() {
            return;
        }
        let mut pos = start_offset;
        let mut t_idx = 0usize;
        let mut line_quote_depth = 0usize;
        let mut line_has_pipe = false;
        let mut in_table_header = false;
        let mut current_line_has_content = false;
        self.pending_ws_start = -1;

        while t_idx < tokens.len() {
            let token = tokens[t_idx];
            let kind = token_kind(token);
            let len = token_len(token);
            let mut next_pos = pos + len;

            let mut active = self.active_block();

            if kind != NEW_LINE && kind != WHITESPACE {
                current_line_has_content = true;
            }

            if matches!(
                kind,
                BULLET_LIST_MARKER
                    | ORDERED_LIST_MARKER
                    | TASK_LIST_MARKER
                    | BLOCKQUOTE_MARKER
                    | TABLE_PIPE
                    | ATX_HEADING_OPEN
                    | ATX_HEADING_CLOSE
                    | FENCED_OPEN
                    | THEMATIC_BREAK
                    | FRONTMATTER_OPEN
                    | FORMULA_OPEN
            ) {
                self.pending_ws_start = -1;
            }

            if kind == NEW_LINE {
                if !current_line_has_content && self.kind_of(active) == NodeType::Paragraph {
                    self.block_stack.pop();
                    self.pending_ws_start = -1;
                    active = self.active_block();
                }
                current_line_has_content = false;
                line_quote_depth = 0;
                line_has_pipe = false;

                while let Some(&top) = self.inline_stack.last() {
                    match self.kind_of(top) {
                        NodeType::Emphasis | NodeType::Strong | NodeType::Strikethrough => {
                            self.inline_stack.pop();
                            self.nodes[top].end = pos;
                        }
                        _ => break,
                    }
                }

                // Close any open table cell / row on a line boundary.
                if self.kind_of(active) == NodeType::TableCell {
                    self.trim_cell_trailing_whitespace(active);
                    self.block_stack.pop();
                    active = self.active_block();
                }
                if self.kind_of(active) == NodeType::TableRow {
                    let closed_row = active;
                    self.block_stack.pop();
                    if in_table_header {
                        in_table_header = false;
                        pos = self.consume_delimiter_row(tokens, t_idx, next_pos, closed_row);
                        t_idx = self.resume_index;
                        self.extend_ancestors(pos);
                        t_idx += 1;
                        continue;
                    } else {
                        let peek = t_idx + 1;
                        if peek >= tokens.len() || !self.line_has_pipe(tokens, peek) {
                            if self.kind_of(self.active_block()) == NodeType::Table {
                                self.block_stack.pop();
                            }
                        }
                        self.extend_ancestors(next_pos);
                        pos = next_pos;
                        t_idx += 1;
                        continue;
                    }
                }

                if self.kind_of(active) == NodeType::Heading {
                    self.block_stack.pop();
                }
            } else if kind == THEMATIC_BREAK {
                if self.kind_of(active) == NodeType::Paragraph {
                    self.block_stack.pop();
                }
                let br = self.new_node(NodeType::ThematicBreak, pos);
                self.nodes[br].end = next_pos;
                self.append(br);
                active = self.active_block();
            } else if kind == SETEXT_HEADING_UNDERLINE {
                // The underline retroactively turns its paragraph into a heading.
                if self.kind_of(active) == NodeType::Paragraph {
                    let depth = heading_depth(token) as u8;
                    self.nodes[active].kind = NodeType::Heading;
                    self.nodes[active].level = if depth == 0 { 1 } else { depth };
                    self.block_stack.pop();
                }
                self.extend_ancestors(next_pos);
                pos = next_pos;
                t_idx += 1;
                continue;
            }

            if kind == BULLET_LIST_MARKER || kind == ORDERED_LIST_MARKER || kind == TASK_LIST_MARKER {
                self.open_list_item(tokens, t_idx, pos, kind == ORDERED_LIST_MARKER);
                self.extend_ancestors(next_pos);
                pos = next_pos;
                t_idx += 1;
                continue;
            } else if kind == BLOCKQUOTE_MARKER {
                if self.kind_of(active) == NodeType::Paragraph {
                    self.block_stack.pop();
                    active = self.active_block();
                }
                line_quote_depth += 1;
                let mut existing = 0usize;
                for &b in &self.block_stack {
                    if self.kind_of(b) == NodeType::Blockquote {
                        existing += 1;
                    }
                }
                if line_quote_depth > existing {
                    let bq = self.new_node(NodeType::Blockquote, pos);
                    self.push_block(bq);
                }
                let _ = active;
                self.extend_ancestors(next_pos);
                pos = next_pos;
                t_idx += 1;
                continue;
            } else if kind == TABLE_PIPE {
                if self.kind_of(active) == NodeType::TableCell {
                    self.trim_cell_trailing_whitespace(active);
                    self.block_stack.pop();
                    active = self.active_block();
                }
                if self.kind_of(active) == NodeType::TableRow {
                    line_has_pipe = true;
                    self.extend_ancestors(next_pos);
                    pos = next_pos;
                    t_idx += 1;
                    continue;
                }
                if self.kind_of(active) == NodeType::Table {
                    let row = self.new_node(NodeType::TableRow, pos);
                    self.push_block(row);
                    line_has_pipe = true;
                    self.extend_ancestors(next_pos);
                    pos = next_pos;
                    t_idx += 1;
                    continue;
                }
                if !line_has_pipe {
                    let mut cur_line_end_t = t_idx + 1;
                    let mut cur_line_end_pos = next_pos;
                    while cur_line_end_t < tokens.len()
                        && token_kind(tokens[cur_line_end_t]) != NEW_LINE
                    {
                        cur_line_end_pos += token_len(tokens[cur_line_end_t]);
                        cur_line_end_t += 1;
                    }
                    let next_line_t = cur_line_end_t + 1;
                    let next_line_pos = cur_line_end_pos
                        + if cur_line_end_t < tokens.len() {
                            token_len(tokens[cur_line_end_t])
                        } else {
                            0
                        };
                    if next_line_t < tokens.len()
                        && self.is_delimiter_line(tokens, next_line_t, next_line_pos)
                    {
                        if self.kind_of(active) == NodeType::Paragraph {
                            self.block_stack.pop();
                        }
                        let table = self.new_node(NodeType::Table, pos);
                        self.push_block(table);
                        let header = self.new_node(NodeType::TableRow, pos);
                        self.nodes[header].is_header = true;
                        self.push_block(header);
                        in_table_header = true;
                        line_has_pipe = true;
                        self.extend_ancestors(next_pos);
                        pos = next_pos;
                        t_idx += 1;
                        continue;
                    }
                }
                // Not structurally a table pipe — fold into inline text.
                {
                    let cur_ab = self.active_block();
                    if matches!(self.kind_of(cur_ab), NodeType::Document | NodeType::Blockquote) {
                        let p = self.new_node(NodeType::Paragraph, pos);
                        self.push_block(p);
                    }
                    let parent = self.active_parent();
                    let last_is_text = self
                        .nodes[parent]
                        .children
                        .last()
                        .map(|&c| self.nodes[c].kind == NodeType::Text)
                        .unwrap_or(false);
                    if last_is_text {
                        let last = *self.nodes[parent].children.last().unwrap();
                        self.nodes[last].end = next_pos;
                    } else {
                        let t = self.new_node(NodeType::Text, pos);
                        self.nodes[t].end = next_pos;
                        self.append(t);
                    }
                }
                line_has_pipe = true;
                self.extend_ancestors(next_pos);
                pos = next_pos;
                t_idx += 1;
                continue;
            } else if kind == ATX_HEADING_OPEN {
                if self.kind_of(active) == NodeType::Paragraph {
                    self.block_stack.pop();
                }
                let depth = heading_depth(token) as u8;
                let h = self.new_node(NodeType::Heading, pos);
                self.nodes[h].level = depth;
                self.push_block(h);

                let peek = t_idx + 1;
                if peek < tokens.len() && token_kind(tokens[peek]) == WHITESPACE {
                    next_pos += token_len(tokens[peek]);
                    t_idx = peek;
                }
                self.extend_ancestors(next_pos);
                pos = next_pos;
                t_idx += 1;
                continue;
            } else if kind == FENCED_OPEN {
                if self.kind_of(active) == NodeType::Paragraph {
                    self.block_stack.pop();
                }
                let fc = self.new_node(NodeType::FencedCodeBlock, pos);
                self.push_block(fc);
                // The FENCED_OPEN span covers the fence run, the info string, and
                // the trailing newline. Extract the info (language) from it.
                let b = self.source.as_bytes();
                let fence_ch = b[pos];
                let mut i = pos;
                while i < next_pos && b[i] == fence_ch {
                    i += 1;
                }
                while i < next_pos && (b[i] == b' ' || b[i] == b'\t') {
                    i += 1;
                }
                let info_start = i;
                let mut j = next_pos;
                while j > info_start
                    && matches!(b[j - 1], b'\n' | b'\r' | b' ' | b'\t')
                {
                    j -= 1;
                }
                if j > info_start {
                    self.nodes[fc].info_start = info_start;
                    self.nodes[fc].info_end = j;
                }
                self.extend_ancestors(next_pos);
                pos = next_pos;
                t_idx += 1;
                continue;
            } else if kind == FRONTMATTER_OPEN {
                let fm = self.new_node(NodeType::Frontmatter, pos);
                self.push_block(fm);
                self.extend_ancestors(next_pos);
                pos = next_pos;
                t_idx += 1;
                continue;
            } else if kind == FORMULA_OPEN {
                if self.kind_of(active) == NodeType::Paragraph {
                    self.block_stack.pop();
                }
                let fb = self.new_node(NodeType::FormulaBlock, pos);
                self.push_block(fb);
                self.extend_ancestors(next_pos);
                pos = next_pos;
                t_idx += 1;
                continue;
            } else if kind != NEW_LINE
                && (self.kind_of(active) == NodeType::Document
                    || self.kind_of(active) == NodeType::Blockquote
                    || (self.kind_of(active) == NodeType::Table && kind != WHITESPACE))
            {
                if self.kind_of(active) == NodeType::Table {
                    let row = self.new_node(NodeType::TableRow, pos);
                    self.push_block(row);
                } else if self.current_line_is_table_header(tokens, t_idx, pos) {
                    let table = self.new_node(NodeType::Table, pos);
                    self.push_block(table);
                    let header = self.new_node(NodeType::TableRow, pos);
                    self.nodes[header].is_header = true;
                    self.push_block(header);
                    in_table_header = true;
                } else {
                    let p = self.new_node(NodeType::Paragraph, pos);
                    self.push_block(p);
                }
                active = self.active_block();
            }

            let _ = active;

            // Fenced code: consume tokens as text/info until close.
            if self.kind_of(self.active_block()) == NodeType::FencedCodeBlock {
                if kind == FENCED_CLOSE {
                    self.block_stack.pop();
                } else {
                    let t = self.new_node(NodeType::Text, pos);
                    self.nodes[t].end = next_pos;
                    self.append(t);
                }
                self.extend_ancestors(next_pos);
                pos = next_pos;
                t_idx += 1;
                continue;
            }

            // Front matter: consume content until close.
            if self.kind_of(self.active_block()) == NodeType::Frontmatter {
                if kind == FRONTMATTER_CLOSE {
                    self.block_stack.pop();
                } else {
                    let t = self.new_node(NodeType::Text, pos);
                    self.nodes[t].end = next_pos;
                    self.append(t);
                }
                self.extend_ancestors(next_pos);
                pos = next_pos;
                t_idx += 1;
                continue;
            }

            // Formula block: consume content until close.
            if self.kind_of(self.active_block()) == NodeType::FormulaBlock {
                if kind == FORMULA_CLOSE {
                    self.block_stack.pop();
                } else {
                    let t = self.new_node(NodeType::Text, pos);
                    self.nodes[t].end = next_pos;
                    self.append(t);
                }
                self.extend_ancestors(next_pos);
                pos = next_pos;
                t_idx += 1;
                continue;
            }

            // Inside a table row: skip inter-cell padding, open a cell on content.
            {
                let cur_ab = self.active_block();
                if self.kind_of(cur_ab) == NodeType::TableRow {
                    if kind == WHITESPACE {
                        self.extend_ancestors(next_pos);
                        pos = next_pos;
                        t_idx += 1;
                        continue;
                    } else if kind != NEW_LINE && kind != TABLE_PIPE {
                        let cell = self.new_node(NodeType::TableCell, pos);
                        self.push_block(cell);
                    }
                }
            }

            // Inside a link/image destination, content is captured by the
            // dest span (not as child nodes); suppress node creation until close.
            let ap = self.active_parent();
            let in_link_dest = matches!(self.kind_of(ap), NodeType::Link | NodeType::Image)
                && self.nodes[ap].dest_start != 0
                && self.nodes[ap].end == 0;
            if in_link_dest && kind != LINK_DEST_CLOSE {
                self.extend_ancestors(next_pos);
                pos = next_pos;
                t_idx += 1;
                continue;
            }

            if kind != WHITESPACE && kind != NEW_LINE {
                self.flush_pending_ws(pos);
            }

            match kind {
                EMPHASIS_OPEN => {
                    let em = self.new_node(NodeType::Emphasis, pos);
                    self.append(em);
                    self.inline_stack.push(em);
                }
                EMPHASIS_CLOSE | STRONG_CLOSE | STRIKETHROUGH_CLOSE => {
                    if let Some(top) = self.inline_stack.pop() {
                        self.nodes[top].end = next_pos;
                    }
                }
                STRONG_OPEN => {
                    let s = self.new_node(NodeType::Strong, pos);
                    self.append(s);
                    self.inline_stack.push(s);
                }
                STRIKETHROUGH_OPEN => {
                    let s = self.new_node(NodeType::Strikethrough, pos);
                    self.append(s);
                    self.inline_stack.push(s);
                }
                ANGLE_LINK_OPEN => {
                    next_pos = self.build_angle_autolink(tokens, t_idx, pos, len);
                    t_idx = self.resume_index;
                    self.extend_ancestors(next_pos);
                    pos = next_pos;
                    continue;
                }
                IMAGE_MARKER => {
                    let img = self.new_node(NodeType::Image, pos);
                    self.append(img);
                    self.inline_stack.push(img);
                }
                LINK_OPEN => {
                    // `![` — the bracket belongs to the just-opened image, so the
                    // image itself is the link container; don't nest a Link.
                    let skip = self.inline_stack.last().map_or(false, |&top| {
                        self.kind_of(top) == NodeType::Image && pos == self.nodes[top].start + 1
                    });
                    if !skip {
                        let link = self.new_node(NodeType::Link, pos);
                        self.append(link);
                        self.inline_stack.push(link);
                    }
                }
                LINK_CLOSE => {}
                LINK_DEST_OPEN => {
                    let top = self.active_parent();
                    if matches!(self.kind_of(top), NodeType::Link | NodeType::Image) {
                        self.nodes[top].dest_start = next_pos;
                    }
                }
                LINK_DEST_CLOSE => {
                    if let Some(top) = self.inline_stack.pop() {
                        if matches!(self.kind_of(top), NodeType::Link | NodeType::Image) {
                            self.nodes[top].dest_end = pos;
                            self.nodes[top].end = next_pos;
                        }
                    }
                }
                RAW_URL | WWW_AUTOLINK | EMAIL_AUTOLINK => {
                    let auto = self.new_node(NodeType::Autolink, pos);
                    self.nodes[auto].end = next_pos;
                    self.nodes[auto].dest_start = pos;
                    self.nodes[auto].dest_end = next_pos;
                    self.append(auto);
                }
                INLINE_CODE => {
                    let code = self.new_node(NodeType::InlineCode, pos);
                    self.nodes[code].end = next_pos;
                    self.append(code);
                }
                WHITESPACE | NEW_LINE => {
                    let parent = self.active_parent();
                    if !matches!(self.kind_of(parent), NodeType::Document | NodeType::Blockquote) {
                        if self.pending_ws_start == -1 {
                            self.pending_ws_start = pos as i64;
                        }
                    }
                }
                INLINE_TEXT | ENTITY_NAMED | ENTITY_DECIMAL | ENTITY_HEX | HTML_RAW_TEXT => {
                    let parent = self.active_parent();
                    let last_is_text = self
                        .nodes[parent]
                        .children
                        .last()
                        .map(|&c| self.nodes[c].kind == NodeType::Text)
                        .unwrap_or(false);
                    if last_is_text {
                        let last = *self.nodes[parent].children.last().unwrap();
                        self.nodes[last].end = next_pos;
                    } else {
                        let t = self.new_node(NodeType::Text, pos);
                        self.nodes[t].end = next_pos;
                        self.append(t);
                    }
                }
                HTML_COMMENT_OPEN => {
                    let node = self.new_node(NodeType::HtmlComment, pos);
                    t_idx = self.consume_until(tokens, t_idx, pos, HTML_COMMENT_CLOSE, node) - 1;
                    next_pos = self.nodes[node].end;
                    self.extend_ancestors(next_pos);
                    pos = next_pos;
                    t_idx += 1;
                    continue;
                }
                HTML_CDATA_OPEN => {
                    let node = self.new_node(NodeType::HtmlCData, pos);
                    t_idx = self.consume_until(tokens, t_idx, pos, HTML_CDATA_CLOSE, node) - 1;
                    next_pos = self.nodes[node].end;
                    self.extend_ancestors(next_pos);
                    pos = next_pos;
                    t_idx += 1;
                    continue;
                }
                HTML_DOCTYPE_OPEN => {
                    let node = self.new_node(NodeType::HtmlDocType, pos);
                    t_idx = self.consume_until(tokens, t_idx, pos, HTML_DOCTYPE_CLOSE, node) - 1;
                    next_pos = self.nodes[node].end;
                    self.extend_ancestors(next_pos);
                    pos = next_pos;
                    t_idx += 1;
                    continue;
                }
                XML_PI_OPEN => {
                    let node = self.new_node(NodeType::XmlProcessingInstruction, pos);
                    t_idx = self.consume_until(tokens, t_idx, pos, XML_PI_CLOSE, node) - 1;
                    next_pos = self.nodes[node].end;
                    self.extend_ancestors(next_pos);
                    pos = next_pos;
                    t_idx += 1;
                    continue;
                }
                HTML_TAG_OPEN => {
                    next_pos = self.build_html_tag(tokens, t_idx, pos, len);
                    t_idx = self.resume_index;
                    self.extend_ancestors(next_pos);
                    pos = next_pos;
                    continue;
                }
                HTML_TAG_CLOSE | HTML_TAG_SELF_CLOSING => {
                    let t = self.new_node(NodeType::Text, pos);
                    self.nodes[t].end = next_pos;
                    self.append(t);
                }
                _ => {}
            }

            self.extend_ancestors(next_pos);
            pos = next_pos;
            t_idx += 1;
        }

        while let Some(leftover) = self.inline_stack.pop() {
            self.nodes[leftover].end = pos;
        }
    }

    fn finish(mut self) -> Document {
        let end = self
            .nodes[0]
            .children
            .last()
            .map(|&c| self.nodes[c].end)
            .unwrap_or(0);
        self.nodes[0].end = end;
        Document {
            source: self.source.to_string(),
            nodes: self.nodes,
            root: 0,
        }
    }
}

/// Parse Markdown source into a [`Document`] AST.
pub fn parse(source: &str) -> Document {
    let bytes = source.as_bytes();
    let tokens = semantic(bytes, 0, bytes.len());
    let mut builder = Builder::new(source);
    builder.consume_chunk(&tokens, 0);
    builder.finish()
}

pub(crate) fn parse_into(source: &str, tokens: &[u32]) -> Document {
    let mut builder = Builder::new(source);
    builder.consume_chunk(tokens, 0);
    builder.finish()
}
