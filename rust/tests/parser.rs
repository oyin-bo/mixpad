//! Integration tests for the MixPad Rust port. These mirror the behavioural
//! expectations of the JavaScript parser: CommonMark-guided, natural, and
//! HTML-native.

use mixpad::ast::{Align, Document, NodeType};
use mixpad::parse;

/// Collect the kinds of a node's direct children.
fn child_kinds(doc: &Document, id: usize) -> Vec<NodeType> {
    doc.nodes[id].children.iter().map(|&c| doc.nodes[c].kind).collect()
}

/// Find the first descendant of a given kind (depth-first).
fn find(doc: &Document, id: usize, kind: NodeType) -> Option<usize> {
    if doc.nodes[id].kind == kind {
        return Some(id);
    }
    for &c in &doc.nodes[id].children {
        if let Some(f) = find(doc, c, kind) {
            return Some(f);
        }
    }
    None
}

fn count(doc: &Document, id: usize, kind: NodeType) -> usize {
    let mut n = if doc.nodes[id].kind == kind { 1 } else { 0 };
    for &c in &doc.nodes[id].children {
        n += count(doc, c, kind);
    }
    n
}

#[test]
fn simple_paragraph() {
    let doc = parse("Hello world");
    assert_eq!(child_kinds(&doc, doc.root), vec![NodeType::Paragraph]);
    let p = doc.nodes[doc.root].children[0];
    assert_eq!(doc.text(p), "Hello world");
}

#[test]
fn atx_heading_levels() {
    let doc = parse("# One\n## Two\n###### Six");
    let kinds = child_kinds(&doc, doc.root);
    assert_eq!(
        kinds,
        vec![NodeType::Heading, NodeType::Heading, NodeType::Heading]
    );
    let levels: Vec<u8> = doc.nodes[doc.root]
        .children
        .iter()
        .map(|&c| doc.nodes[c].level)
        .collect();
    assert_eq!(levels, vec![1, 2, 6]);
    let h1 = doc.nodes[doc.root].children[0];
    assert_eq!(doc.text(h1), "One");
}

#[test]
fn seven_hashes_is_not_a_heading() {
    let doc = parse("####### nope");
    assert_eq!(child_kinds(&doc, doc.root), vec![NodeType::Paragraph]);
}

#[test]
fn emphasis_and_strong() {
    let doc = parse("a *em* and **strong** b");
    let p = doc.nodes[doc.root].children[0];
    assert_eq!(count(&doc, p, NodeType::Emphasis), 1);
    assert_eq!(count(&doc, p, NodeType::Strong), 1);
    let em = find(&doc, p, NodeType::Emphasis).unwrap();
    assert_eq!(doc.text(em), "em");
    let strong = find(&doc, p, NodeType::Strong).unwrap();
    assert_eq!(doc.text(strong), "strong");
}

#[test]
fn strikethrough() {
    let doc = parse("~~gone~~");
    let s = find(&doc, doc.root, NodeType::Strikethrough).expect("strikethrough");
    assert_eq!(doc.text(s), "gone");
}

#[test]
fn inline_code() {
    let doc = parse("call `foo()` now");
    let code = find(&doc, doc.root, NodeType::InlineCode).expect("inline code");
    // The inline-code node exposes the code content, without the backtick fence.
    assert_eq!(doc.text(code), "foo()");
}

#[test]
fn fenced_code_block_with_language() {
    let doc = parse("```rust\nlet x = 1;\n```");
    let fc = find(&doc, doc.root, NodeType::FencedCodeBlock).expect("fenced code");
    assert_eq!(doc.language(fc), "rust");
    assert!(doc.text(fc).contains("let x = 1;"));
}

#[test]
fn thematic_break() {
    let doc = parse("a\n\n---\n\nb");
    assert_eq!(count(&doc, doc.root, NodeType::ThematicBreak), 1);
}

#[test]
fn blockquote() {
    let doc = parse("> quoted text");
    let bq = find(&doc, doc.root, NodeType::Blockquote).expect("blockquote");
    assert!(doc.text(bq).contains("quoted text"));
}

#[test]
fn bullet_list() {
    let doc = parse("- one\n- two\n- three");
    let list = find(&doc, doc.root, NodeType::List).expect("list");
    assert!(!doc.nodes[list].ordered);
    assert_eq!(count(&doc, list, NodeType::ListItem), 3);
}

#[test]
fn ordered_list() {
    let doc = parse("1. first\n2. second");
    let list = find(&doc, doc.root, NodeType::List).expect("list");
    assert!(doc.nodes[list].ordered);
    assert_eq!(count(&doc, list, NodeType::ListItem), 2);
}

#[test]
fn inline_link() {
    let doc = parse("see [text](https://example.com) here");
    let link = find(&doc, doc.root, NodeType::Link).expect("link");
    assert_eq!(doc.url(link), "https://example.com");
    assert_eq!(doc.text(link), "text");
}

#[test]
fn image() {
    let doc = parse("![alt](https://example.com/a.png)");
    let img = find(&doc, doc.root, NodeType::Image).expect("image");
    assert_eq!(doc.url(img), "https://example.com/a.png");
}

#[test]
fn angle_autolink() {
    let doc = parse("<https://example.com>");
    let a = find(&doc, doc.root, NodeType::Autolink).expect("autolink");
    assert_eq!(doc.url(a), "https://example.com");
}

#[test]
fn raw_url_autolink() {
    let doc = parse("visit https://example.com/path now");
    let a = find(&doc, doc.root, NodeType::Autolink).expect("autolink");
    assert!(doc.url(a).starts_with("https://example.com"));
}

#[test]
fn html_element_is_native() {
    let doc = parse("<div class=\"box\">inner</div>");
    let el = find(&doc, doc.root, NodeType::HtmlElement).expect("html element");
    assert_eq!(doc.nodes[el].tag_name, "div");
    assert_eq!(doc.nodes[el].attributes.len(), 1);
    assert_eq!(doc.nodes[el].attributes[0].0, "class");
    assert_eq!(doc.nodes[el].attributes[0].1.as_deref(), Some("box"));
    // The element is a container and holds its inner text.
    assert!(doc.text(el).contains("inner"));
}

#[test]
fn html_comment() {
    let doc = parse("<!-- a comment -->");
    let c = find(&doc, doc.root, NodeType::HtmlComment).expect("comment");
    assert!(doc.text(c).contains("a comment"));
}

#[test]
fn entities_are_text() {
    let doc = parse("a &amp; b &#38; c");
    let p = doc.nodes[doc.root].children[0];
    assert_eq!(doc.text(p), "a &amp; b &#38; c");
}

#[test]
fn escaped_characters() {
    let doc = parse(r"\*not emphasis\*");
    // No emphasis node should be produced.
    assert_eq!(count(&doc, doc.root, NodeType::Emphasis), 0);
}

#[test]
fn unicode_text_roundtrips() {
    let src = "héllo wörld — 日本語";
    let doc = parse(src);
    let p = doc.nodes[doc.root].children[0];
    assert_eq!(doc.text(p), src);
}

#[test]
fn multiple_blocks() {
    let doc = parse("# Title\n\nA paragraph.\n\n- item\n\n> quote");
    // All four block kinds are produced somewhere in the tree. (Following
    // MixPad's list behaviour, a trailing blockquote nests inside the open list
    // rather than becoming a top-level sibling.)
    assert!(find(&doc, doc.root, NodeType::Heading).is_some());
    assert!(find(&doc, doc.root, NodeType::Paragraph).is_some());
    assert!(find(&doc, doc.root, NodeType::List).is_some());
    assert!(find(&doc, doc.root, NodeType::Blockquote).is_some());
}

#[test]
fn setext_heading_level_1() {
    let doc = parse("My Title\n========\n\nbody");
    let h = find(&doc, doc.root, NodeType::Heading).expect("setext heading");
    assert_eq!(doc.nodes[h].level, 1);
    assert_eq!(doc.text(h), "My Title");
}

#[test]
fn setext_heading_level_2() {
    let doc = parse("Subtitle\n--------\n");
    let h = find(&doc, doc.root, NodeType::Heading).expect("setext heading");
    assert_eq!(doc.nodes[h].level, 2);
    assert_eq!(doc.text(h), "Subtitle");
}

#[test]
fn gfm_table() {
    let doc = parse("| A | B |\n| :--- | ---: |\n| 1 | 2 |\n");
    let table = find(&doc, doc.root, NodeType::Table).expect("table");
    assert_eq!(count(&doc, table, NodeType::TableRow), 2);
    assert_eq!(count(&doc, table, NodeType::TableCell), 4);
    // Header row is flagged and alignment flows from the delimiter row.
    let header = doc.nodes[table].children[0];
    assert!(doc.nodes[header].is_header);
    let a = doc.nodes[header].children[0];
    let b = doc.nodes[header].children[1];
    assert_eq!(doc.nodes[a].align, Align::Left);
    assert_eq!(doc.nodes[b].align, Align::Right);
    assert_eq!(doc.text(a), "A");
    assert_eq!(doc.text(b), "B");
}

#[test]
fn table_without_leading_pipe() {
    let doc = parse("A | B\n--- | ---\nx | y\n");
    let table = find(&doc, doc.root, NodeType::Table).expect("table");
    assert!(find(&doc, table, NodeType::TableRow).is_some());
}

#[test]
fn yaml_frontmatter() {
    let doc = parse("---\ntitle: Hi\ntags: [a, b]\n---\n\nBody text.");
    let fm = find(&doc, doc.root, NodeType::Frontmatter).expect("frontmatter");
    assert!(doc.text(fm).contains("title: Hi"));
    // Body still parses as a paragraph.
    assert!(find(&doc, doc.root, NodeType::Paragraph).is_some());
}

#[test]
fn toml_frontmatter() {
    let doc = parse("+++\nname = \"x\"\n+++\n");
    let fm = find(&doc, doc.root, NodeType::Frontmatter).expect("frontmatter");
    assert!(doc.text(fm).contains("name = \"x\""));
}

#[test]
fn formula_block() {
    let doc = parse("$$\nE = mc^2\n$$\n");
    let f = find(&doc, doc.root, NodeType::FormulaBlock).expect("formula");
    assert!(doc.text(f).contains("E = mc^2"));
}
