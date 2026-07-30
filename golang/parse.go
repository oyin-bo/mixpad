package mixpad

// Parse runs MixPad's two-phase pipeline over src and returns the AST document.
//
// Phase 1 (scan0) and Phase 2 (semantic) produce a compact packed-token stream;
// the builder materialises a flat-arena tree. The parser is guided by CommonMark
// but favours natural expectations and treats HTML as first-class syntax.
func Parse(src string) *Document {
	toks := semanticScan(src)
	b := newASTBuilder(src)
	b.consumeChunk(toks, 0)
	return b.finish()
}

// Tokenize exposes the final semantic token stream (useful for debugging/tests).
func Tokenize(src string) []Token {
	return semanticScan(src)
}
