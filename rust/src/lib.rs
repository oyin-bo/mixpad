//! MixPad — a blazingly fast, editor-grade, low-allocation Markdown parser with
//! first-class HTML support. This is a Rust port of the JavaScript MixPad
//! parser, preserving its two-phase, zero-allocation-hot-path architecture:
//!
//! 1. [`scan0`](scan0::scan0) walks the input once and emits packed `u32`
//!    provisional tokens (surface shapes only).
//! 2. [`semantic`](semantic::semantic) pairs delimiters, validates links, and
//!    coalesces text over those compact integer records.
//! 3. [`parse`](ast::parse) streams the resolved tokens into an arena-backed AST.
//!
//! Compliance follows MixPad's intuition: guided by CommonMark, but favouring
//! natural expectations over its more surprising corners, with HTML treated as
//! native recursive syntax rather than opaque text.

pub mod ast;
pub mod core;
pub mod html;
pub mod scan0;
pub mod scanners;
pub mod semantic;
pub mod token;

pub use ast::{parse, Document, Node, NodeType};
pub use scan0::scan0;
pub use semantic::{semantic, Semantic};

/// A reusable parser instance that maintains growing buffers to eliminate
/// heap allocations in the hot scanning and semantic phases.
#[derive(Default)]
pub struct Parser {
    semantic: Semantic,
}

impl Parser {
    pub fn new() -> Self {
        Self::default()
    }

    /// Parse Markdown source into a [`Document`] AST using reusable internal buffers.
    pub fn parse(&mut self, source: &str) -> Document {
        let bytes = source.as_bytes();
        self.semantic.run(bytes, 0, bytes.len());
        ast::parse_into(source, &self.semantic.output)
    }
}
