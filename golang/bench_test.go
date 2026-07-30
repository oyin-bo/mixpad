package mixpad

import (
	"strings"
	"testing"
)

func benchDoc() string {
	var sb strings.Builder
	for i := 0; i < 200; i++ {
		sb.WriteString("# Heading ")
		sb.WriteString("section\n\n")
		sb.WriteString("A paragraph with *emphasis*, **strong**, ~~strike~~ and `code` plus ")
		sb.WriteString("a [link](http://example.com/path) and an ![image](http://x/y.png).\n\n")
		sb.WriteString("> A blockquote line with <span class=\"x\">inline html</span>.\n\n")
		sb.WriteString("- item one\n- item two\n- item three\n\n")
		sb.WriteString("```go\nfunc main() { println(\"hi\") }\n```\n\n")
	}
	return sb.String()
}

func BenchmarkParse(b *testing.B) {
	src := benchDoc()
	b.SetBytes(int64(len(src)))
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = Parse(src)
	}
}

func BenchmarkTokenize(b *testing.B) {
	src := benchDoc()
	b.SetBytes(int64(len(src)))
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = Tokenize(src)
	}
}
