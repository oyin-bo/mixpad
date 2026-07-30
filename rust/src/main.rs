//! Tiny CLI: reads Markdown from a file argument (or stdin) and prints the AST.

use std::io::Read;

use mixpad::ast::{Document, NodeType};
use mixpad::parse;

fn main() {
    let mut source = String::new();
    let arg = std::env::args().nth(1);
    match arg {
        Some(path) => {
            source = std::fs::read_to_string(&path).unwrap_or_else(|e| {
                eprintln!("cannot read {path}: {e}");
                std::process::exit(1);
            });
        }
        None => {
            std::io::stdin().read_to_string(&mut source).ok();
        }
    }

    let doc = parse(&source);
    print_tree(&doc, doc.root, 0);
}

fn print_tree(doc: &Document, id: usize, depth: usize) {
    let node = &doc.nodes[id];
    let indent = "  ".repeat(depth);
    let mut extra = String::new();
    match node.kind {
        NodeType::Heading => extra = format!(" level={}", node.level),
        NodeType::List => extra = format!(" ordered={}", node.ordered),
        NodeType::HtmlElement => extra = format!(" <{}>", node.tag_name),
        NodeType::Link | NodeType::Image | NodeType::Autolink => {
            extra = format!(" url={:?}", doc.url(id))
        }
        NodeType::FencedCodeBlock => extra = format!(" lang={:?}", doc.language(id)),
        NodeType::TableCell => {
            extra = format!(" align={:?} header={}", node.align, node.is_header)
        }
        _ => {}
    }
    let preview = if node.children.is_empty() {
        let t = doc.text(id);
        let t = t.replace('\n', "\\n");
        if t.len() > 40 {
            format!(" {:?}…", &t[..40])
        } else {
            format!(" {t:?}")
        }
    } else {
        String::new()
    };
    println!(
        "{indent}{:?} [{}..{}]{extra}{preview}",
        node.kind, node.start, node.end
    );
    for &c in &node.children {
        print_tree(doc, c, depth + 1);
    }
}
