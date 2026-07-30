package mixpad

import "testing"

// findChild returns the first descendant of the given kind (depth-first), or -1.
func findChild(d *Document, root int32, kind NodeKind) int32 {
	for _, c := range d.Children(root) {
		if d.Nodes[c].Kind == kind {
			return c
		}
		if g := findChild(d, c, kind); g >= 0 {
			return g
		}
	}
	return -1
}

func countKind(d *Document, root int32, kind NodeKind) int {
	n := 0
	if d.Nodes[root].Kind == kind {
		n++
	}
	for _, c := range d.Children(root) {
		n += countKind(d, c, kind)
	}
	return n
}

func TestParagraph(t *testing.T) {
	d := Parse("hello world")
	p := findChild(d, d.Root(), KindParagraph)
	if p < 0 {
		t.Fatal("expected a paragraph")
	}
	if got := d.Text(p); got != "hello world" {
		t.Fatalf("paragraph text = %q", got)
	}
}

func TestATXHeading(t *testing.T) {
	d := Parse("## Title here\n")
	h := findChild(d, d.Root(), KindHeading)
	if h < 0 {
		t.Fatal("expected heading")
	}
	if d.Nodes[h].Level != 2 {
		t.Fatalf("heading level = %d, want 2", d.Nodes[h].Level)
	}
	if got := d.Text(h); got != "Title here" {
		t.Fatalf("heading text = %q", got)
	}
}

func TestSetextHeading(t *testing.T) {
	d := Parse("Title\n=====\n")
	h := findChild(d, d.Root(), KindHeading)
	if h < 0 {
		t.Fatal("expected setext heading")
	}
	if d.Nodes[h].Level != 1 {
		t.Fatalf("setext level = %d, want 1", d.Nodes[h].Level)
	}
}

func TestEmphasisAndStrong(t *testing.T) {
	d := Parse("a *em* and **strong** text")
	if countKind(d, d.Root(), KindEmphasis) != 1 {
		t.Fatal("expected one emphasis")
	}
	if countKind(d, d.Root(), KindStrong) != 1 {
		t.Fatal("expected one strong")
	}
}

func TestStrikethrough(t *testing.T) {
	d := Parse("~~gone~~")
	if countKind(d, d.Root(), KindStrikethrough) != 1 {
		t.Fatal("expected one strikethrough")
	}
}

func TestInlineCode(t *testing.T) {
	d := Parse("call `code()` now")
	c := findChild(d, d.Root(), KindInlineCode)
	if c < 0 {
		t.Fatal("expected inline code")
	}
	if got := d.Text(c); got != "code()" {
		t.Fatalf("inline code text = %q", got)
	}
}

func TestThematicBreak(t *testing.T) {
	d := Parse("a\n\n---\n\nb")
	if countKind(d, d.Root(), KindThematicBreak) != 1 {
		t.Fatal("expected one thematic break")
	}
}

func TestFencedCode(t *testing.T) {
	d := Parse("```go\nfmt.Println()\n```\n")
	fc := findChild(d, d.Root(), KindFencedCodeBlock)
	if fc < 0 {
		t.Fatal("expected fenced code block")
	}
	if got := d.Text(fc); got != "fmt.Println()\n" {
		t.Fatalf("fenced content = %q", got)
	}
}

func TestBlockquote(t *testing.T) {
	d := Parse("> quoted text\n")
	bq := findChild(d, d.Root(), KindBlockquote)
	if bq < 0 {
		t.Fatal("expected blockquote")
	}
}

func TestBulletList(t *testing.T) {
	d := Parse("- one\n- two\n")
	l := findChild(d, d.Root(), KindList)
	if l < 0 {
		t.Fatal("expected list")
	}
	if d.Nodes[l].Ordered {
		t.Fatal("bullet list should not be ordered")
	}
	if countKind(d, d.Root(), KindListItem) != 2 {
		t.Fatalf("expected 2 items, got %d", countKind(d, d.Root(), KindListItem))
	}
}

func TestOrderedList(t *testing.T) {
	d := Parse("1. one\n2. two\n")
	l := findChild(d, d.Root(), KindList)
	if l < 0 || !d.Nodes[l].Ordered {
		t.Fatal("expected ordered list")
	}
}

func TestLink(t *testing.T) {
	d := Parse("see [text](http://example.com) here")
	l := findChild(d, d.Root(), KindLink)
	if l < 0 {
		t.Fatal("expected link")
	}
	if got := d.URL(l); got != "http://example.com" {
		t.Fatalf("link url = %q", got)
	}
}

func TestImage(t *testing.T) {
	d := Parse("![alt](http://example.com/i.png)")
	im := findChild(d, d.Root(), KindImage)
	if im < 0 {
		t.Fatal("expected image")
	}
	if got := d.URL(im); got != "http://example.com/i.png" {
		t.Fatalf("image url = %q", got)
	}
}

func TestHTMLElement(t *testing.T) {
	d := Parse("text <span> more")
	el := findChild(d, d.Root(), KindHtmlElement)
	if el < 0 {
		t.Fatal("expected html element")
	}
	if d.Nodes[el].TagName != "span" {
		t.Fatalf("tag name = %q", d.Nodes[el].TagName)
	}
}

func TestHTMLComment(t *testing.T) {
	d := Parse("a <!-- hi --> b")
	if findChild(d, d.Root(), KindHtmlComment) < 0 {
		t.Fatal("expected html comment")
	}
}

func TestRawURLAutolink(t *testing.T) {
	d := Parse("visit https://go.dev today")
	a := findChild(d, d.Root(), KindAutolink)
	if a < 0 {
		t.Fatal("expected autolink")
	}
	if got := d.URL(a); got != "https://go.dev" {
		t.Fatalf("autolink url = %q", got)
	}
}

func TestEntity(t *testing.T) {
	d := Parse("Fish &amp; chips")
	p := findChild(d, d.Root(), KindParagraph)
	if got := d.Text(p); got != "Fish &amp; chips" {
		t.Fatalf("text = %q", got)
	}
}

func TestNoAllocFreeOfPanics(t *testing.T) {
	// Larger mixed document should parse without panicking.
	src := "# H\n\npara *a* **b** `c`\n\n> quote\n\n- x\n- y\n\n```\ncode\n```\n\n<div class=\"a\">html</div>\n"
	d := Parse(src)
	if len(d.Nodes) < 5 {
		t.Fatalf("expected a populated tree, got %d nodes", len(d.Nodes))
	}
}
