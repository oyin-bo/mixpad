package mixpad

import "testing"

func TestTableBasic(t *testing.T) {
	d := Parse("| a | b |\n| --- | --- |\n| 1 | 2 |\n")
	tbl := findChild(d, d.Root(), KindTable)
	if tbl < 0 {
		t.Fatal("expected a table")
	}
	if countKind(d, d.Root(), KindTableRow) < 2 {
		t.Fatalf("expected >=2 rows, got %d", countKind(d, d.Root(), KindTableRow))
	}
	if countKind(d, d.Root(), KindTableCell) < 4 {
		t.Fatalf("expected >=4 cells, got %d", countKind(d, d.Root(), KindTableCell))
	}
}

func TestTableAlignment(t *testing.T) {
	d := Parse("| a | b | c |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |\n")
	tbl := findChild(d, d.Root(), KindTable)
	if tbl < 0 {
		t.Fatal("expected table")
	}
	// find header row cells
	var aligns []Alignment
	var walk func(i int32)
	walk = func(i int32) {
		if d.Nodes[i].Kind == KindTableCell {
			aligns = append(aligns, d.Nodes[i].Align)
		}
		for _, c := range d.Children(i) {
			walk(c)
		}
	}
	walk(tbl)
	if len(aligns) < 3 {
		t.Fatalf("expected 3 header cells, got %d", len(aligns))
	}
	if aligns[0] != AlignLeft || aligns[1] != AlignCenter || aligns[2] != AlignRight {
		t.Fatalf("alignments = %v", aligns[:3])
	}
}

func TestFrontmatterYAML(t *testing.T) {
	d := Parse("---\ntitle: Hi\n---\n\nbody\n")
	fm := findChild(d, d.Root(), KindFrontmatter)
	if fm < 0 {
		t.Fatal("expected frontmatter")
	}
	if findChild(d, d.Root(), KindParagraph) < 0 {
		t.Fatal("expected paragraph after frontmatter")
	}
}

func TestFrontmatterJSON(t *testing.T) {
	d := Parse("{\n  \"a\": 1\n}\n\ntext\n")
	if findChild(d, d.Root(), KindFrontmatter) < 0 {
		t.Fatal("expected JSON frontmatter")
	}
}

func TestFormulaBlock(t *testing.T) {
	d := Parse("$$\nx = y\n$$\n")
	if findChild(d, d.Root(), KindFormulaBlock) < 0 {
		t.Fatal("expected formula block")
	}
}

func TestNestedBlockquote(t *testing.T) {
	d := Parse("> a\n> > b\n")
	first := findChild(d, d.Root(), KindBlockquote)
	if first < 0 {
		t.Fatal("expected blockquote")
	}
	if countKind(d, d.Root(), KindBlockquote) < 2 {
		t.Fatalf("expected nested blockquote, got %d", countKind(d, d.Root(), KindBlockquote))
	}
}

func TestNestedList(t *testing.T) {
	d := Parse("- a\n  - b\n")
	if countKind(d, d.Root(), KindList) < 2 {
		t.Fatalf("expected nested list, got %d lists", countKind(d, d.Root(), KindList))
	}
}

func TestTaskList(t *testing.T) {
	d := Parse("- [x] done\n- [ ] todo\n")
	if findChild(d, d.Root(), KindList) < 0 {
		t.Fatal("expected list")
	}
	if countKind(d, d.Root(), KindListItem) != 2 {
		t.Fatalf("expected 2 items, got %d", countKind(d, d.Root(), KindListItem))
	}
}

func TestHTMLElementNestingAttrs(t *testing.T) {
	d := Parse("<div class=\"x\" id='y'>inner <b>bold</b></div>")
	div := findChild(d, d.Root(), KindHtmlElement)
	if div < 0 {
		t.Fatal("expected div element")
	}
	if d.Nodes[div].TagName != "div" {
		t.Fatalf("tag = %q", d.Nodes[div].TagName)
	}
	if len(d.Nodes[div].Attrs) != 2 {
		t.Fatalf("expected 2 attrs, got %d", len(d.Nodes[div].Attrs))
	}
	if d.Nodes[div].Attrs[0].Name != "class" || d.Nodes[div].Attrs[0].Value != "x" {
		t.Fatalf("attr0 = %+v", d.Nodes[div].Attrs[0])
	}
	if countKind(d, d.Root(), KindHtmlElement) < 2 {
		t.Fatalf("expected nested <b>, got %d elements", countKind(d, d.Root(), KindHtmlElement))
	}
}

func TestVoidElement(t *testing.T) {
	d := Parse("a<br>b")
	if countKind(d, d.Root(), KindHtmlElement) != 1 {
		t.Fatalf("expected one void element, got %d", countKind(d, d.Root(), KindHtmlElement))
	}
	// text 'b' should be a sibling, not a child of br
	br := findChild(d, d.Root(), KindHtmlElement)
	if len(d.Nodes[br].Children) != 0 {
		t.Fatal("void element should have no children")
	}
}

func TestWWWAutolink(t *testing.T) {
	d := Parse("go to www.example.com now")
	a := findChild(d, d.Root(), KindAutolink)
	if a < 0 {
		t.Fatal("expected www autolink")
	}
	if d.URL(a) != "www.example.com" {
		t.Fatalf("www url = %q", d.URL(a))
	}
}

func TestAngleAutolink(t *testing.T) {
	d := Parse("see <https://go.dev> ok")
	a := findChild(d, d.Root(), KindAutolink)
	if a < 0 {
		t.Fatal("expected angle autolink")
	}
	if d.URL(a) != "https://go.dev" {
		t.Fatalf("angle url = %q", d.URL(a))
	}
}

func TestHTMLTextarea(t *testing.T) {
	d := Parse("<textarea>foo <b>bar</b> baz</textarea>")
	el := findChild(d, d.Root(), KindHtmlElement)
	if el < 0 {
		t.Fatal("expected textarea element")
	}
	if d.Nodes[el].TagName != "textarea" {
		t.Fatalf("tagName = %q", d.Nodes[el].TagName)
	}
	// Content should be one Text node, NOT containing <b> element
	if len(d.Nodes[el].Children) != 1 {
		t.Fatalf("expected 1 child (text), got %d", len(d.Nodes[el].Children))
	}
	txt := d.Nodes[el].Children[0]
	if d.Nodes[txt].Kind != KindText {
		t.Fatalf("expected text child, got %v", d.Nodes[txt].Kind)
	}
	content := d.Src[d.Nodes[txt].Start:d.Nodes[txt].End]
	if content != "foo <b>bar</b> baz" {
		t.Fatalf("content = %q", content)
	}
}

func TestHTMLScript(t *testing.T) {
	d := Parse("<script>if (a < b) alert(1);</script>")
	el := findChild(d, d.Root(), KindHtmlElement)
	if el < 0 {
		t.Fatal("expected script element")
	}
	txt := d.Nodes[el].Children[0]
	content := d.Src[d.Nodes[txt].Start:d.Nodes[txt].End]
	if content != "if (a < b) alert(1);" {
		t.Fatalf("content = %q", content)
	}
}

func TestFullEntityMap(t *testing.T) {
	// Entities beyond the basic five should resolve via the embedded WHATWG map.
	for _, name := range []string{"&copy;", "&mdash;", "&hearts;", "&frac12;", "&nbsp;"} {
		d := Parse("x " + name + " y")
		p := findChild(d, d.Root(), KindParagraph)
		if p < 0 {
			t.Fatalf("no paragraph for %s", name)
		}
		if got := d.Text(p); got != "x "+name+" y" {
			t.Fatalf("entity %s text = %q", name, got)
		}
	}
	if len(entityWithSemi) < 1000 {
		t.Fatalf("expected a large entity map, got %d with-semicolon names", len(entityWithSemi))
	}
}

func TestSetextLevel2(t *testing.T) {
	d := Parse("Sub\n---\n")
	h := findChild(d, d.Root(), KindHeading)
	if h < 0 {
		t.Fatal("expected setext heading")
	}
	if d.Nodes[h].Level != 2 {
		t.Fatalf("level = %d, want 2", d.Nodes[h].Level)
	}
}

func TestFencedLanguage(t *testing.T) {
	d := Parse("```python\nprint(1)\n```\n")
	fc := findChild(d, d.Root(), KindFencedCodeBlock)
	if fc < 0 {
		t.Fatal("expected fenced code")
	}
	if lang := d.Language(fc); lang != "python" {
		t.Fatalf("language = %q", lang)
	}
	if code := d.Text(fc); code != "print(1)\n" {
		t.Fatalf("code = %q", code)
	}
}

func TestHTMLComment2(t *testing.T) {
	d := Parse("<!-- c -->")
	c := findChild(d, d.Root(), KindHtmlComment)
	if c < 0 {
		t.Fatal("expected comment")
	}
}

func TestDoctype(t *testing.T) {
	d := Parse("<!DOCTYPE html>\n\ntext")
	if findChild(d, d.Root(), KindHtmlDocType) < 0 {
		t.Fatal("expected doctype")
	}
}

func TestXMLPI(t *testing.T) {
	d := Parse("<?xml version=\"1.0\"?>\n\ntext")
	if findChild(d, d.Root(), KindXmlProcessingInstruction) < 0 {
		t.Fatal("expected xml pi")
	}
}
