# Annotated Markdown

The syntax of annotated Markdown is a core building block of the parser. It is used purely in tests, but the way it's defined serves both as documentation and verification.

The descriptivess and specificity of the format is also crucial to debugging, because it pinpoints specific use cases and helps diagnosing them precisely.

## The syntax

The annotations are embedded directly in Markdown files to keep tests readable and self‑documenting. An annotated block consists of three adjacent parts:

- a regular Markdown line containing the source text under test;
- a positional‑marker line immediately beneath it that visually marks character positions by placing non‑whitespace characters under the exact characters to be asserted; and
- one or more assertion lines immediately following the marker line, each beginning with `@` and describing the expected scanner or parser output for the corresponding marker position.

Each non‑whitespace character in the positional‑marker line denotes a marker position. The test harness maps marker positions left‑to‑right to the following `@` assertion lines, so authors must provide exactly one `@` assertion for each marker and keep assertions in the same left‑to‑right order as the markers.

Examples (semantic example shown):

```markdown
Some text &amp;
1         2
@1 InlineText "Some text"
@2 EntityNamed
```

For `scan0` tests assertions are typically token kinds and flags (position is provided by the marker) and sometimes exact token text. For semantic tests assertions will also include exact token text; when specifying te xt use a JSON double‑quoted string so escaping is deterministic.


## The implementation and success/failure

### Annotated Markdown files

Unlike the earlier work in MixPad, the annotated Markdown is now saved in `.md` files, and special test runner is used to parse and run them as part of test runs.

The test runner is relying on built-in Node.js test runner, no external frameworks.

## Success/failure modes

The test harness registers one test per annotated block and names the test using the source line together with the marker line for clarity. Tests are executed with the Node.js built‑in test runner; no external test frameworks are required.

There are two primary failure modes:

- an assertion is syntactically unparseable (for example, malformed JSON or an invalid assertion form) — the harness reports this as a failure with diagnostics; or
- assertions are parseable but the actual scanner/parser output does not match the expectations — the harness reports a detailed diff including file and line location.

Authoring notes:

- Keep the marker line and its `@` assertions adjacent; do not insert blank lines between them.
- Use JSON double‑quoted strings for exact text assertions so escaping is consistent.
- Provide exactly one `@` assertion line for each non‑whitespace marker character; assertions are matched left‑to‑right.
- This document describes the author‑facing rules; implementation details and parsing heuristics are documented separately in the harness reference when needed.

## Debugging and Test Selection

The annotated Markdown test harness generates individual tests for each annotated block, with test names that include the file path, line content, and positional marker pattern. This enables precise test selection during debugging.

### Running Individual Tests

Use Node.js's `--test-name-pattern` flag to run specific tests by matching against test names:

```bash
# Run a specific test by unique content
node --test --test-name-pattern="Ampersand" parse/tests/test-produce-annotated.js

# Run all tests related to a feature
node --test --test-name-pattern="backtick" parse/tests/test-produce-annotated.js

# Run multiple related tests with a pattern
node --test --test-name-pattern="entities.md.*Delta" parse/tests/test-produce-annotated.js

# Run tests from a specific file
node --test --test-name-pattern="7-html-elements.md" parse/tests/test-produce-annotated.js
```

### Test Name Format

Each test name follows the pattern:
```
{relative-file-path} {line-content} {positional-markers}
```

For example:
- `parse/tests/2-entities.md Ampersand amp; 1-2`
- `parse/tests/6-emphasis.md snake_case_variable 1`
- `parse/tests/4-backtick-inline.md Simple backtick code 1-23-456`

### Debugging Workflow

When a test fails:

1. **Identify the test name** from the failure output
2. **Run just that test** using `--test-name-pattern` with a unique substring
3. **Iterate quickly** without running the entire test suite
4. **Use pattern matching** to run related tests once the fix is working

This focused approach is particularly valuable when debugging complex scanner behavior, HTML parsing edge cases, or entity resolution issues where running hundreds of tests would slow down the development cycle.

## EOF Markers for Multiple Independent Scans

To test multiple unclosed constructs or independent scanning scenarios within a single annotated Markdown file, an **EOF marker** can be used to break the token stream and restart scanning from scratch.

### EOF Marker Syntax

An EOF marker is recognized when a line ends with the pattern:

```
<--EOF
```

Where:
- Two or more dashes (`--`) precede `EOF`
- Zero or more whitespace characters may appear between the dashes and `EOF`
- Zero or more whitespace characters may appear after `EOF` until the line end
- The marker must appear at the end of a line (no continuation on the same line)

**Valid examples:**
```markdown
<--EOF
<---EOF
<-- EOF
<--  EOF  
<---- EOF
```

### Scanning Behavior with EOF Markers

1. **Breaks token stream:** When an EOF marker is encountered, scanning stops at that point. The content up to (but not including) the marker line is treated as complete input for tokenization.

2. **Restarts from scratch:** Content after the EOF marker is scanned independently, with a fresh token stream starting from zero. No state carries forward from the previous section.

3. **Line number preservation:** When the test harness reports errors for sections after an EOF marker, line numbers still reference the original file positions. The line numbering is never reset—only the token stream is restarted.

4. **Next-line scanning:** Scanning resumes at the start of the line following the EOF marker. If the next line begins a marker/assertion block (positional marker line starting with `1`), that entire block is skipped, and scanning starts on the line after the assertion block completes.

### Use Case: Testing Unclosed Constructs

EOF markers are particularly useful for testing error recovery with unclosed HTML/XML constructs, where each section needs to independently verify behavior at EOF:

```markdown
<!-- unclosed comment
1
@1 HTMLCommentOpen|ErrorUnbalancedToken

<--EOF

<div class="test
1
@1 HTMLTagOpen|ErrorUnbalancedToken

<--EOF

<?xml version="1.0"
1
@1 XMLProcessingInstructionOpen|ErrorUnbalancedToken
```

In this example:
- First section tests unclosed HTML comment behavior at EOF
- Second section independently tests unclosed opening tag at EOF
- Third section independently tests unclosed XML PI at EOF
- Each section's tokens are scanned fresh without interference from previous sections

# Implementation notes

## Test Harness Architecture

The annotated Markdown test harness will be implemented as a Node.js built-in test runner that dynamically registers test callbacks from `.md` files containing annotated markdown blocks. The architecture follows these key principles:

### 1. File Discovery and Processing

**Suggested Target Structure (not prescriptive):**
```
parse/
  annotated-tests/
    scan0/
      basic-tokenization.md
      edge-cases.md
      html-entities.md
    semantic/
      emphasis-pairing.md
      code-blocks.md
      lists-tables.md
    parser/
      ast-generation.md
      cross-references.md
```

**Discovery Process:**
- Recursively scan for `.md` files in the test directory structure
- Each subdirectory represents a test suite category (scan0, semantic, parser)
- File names become part of test suite descriptors
- Each annotated block within a file becomes an individual test callback

### 2. Test Generation Pipeline

**Phase 1: Markdown File Parsing**
- Read each `.md` file and extract annotated blocks using detection rules defined in this document
- Parse position marker lines (must start with `1` possibly with leading space, followed by one or more lines starting with `@`)
- Validate immediate `@` assertion lines requirement
- Extract assertion syntax per marker position

**Phase 2: Test Callback Registration**
- Dynamically register one test callback per annotated block using Node.js built-in `test()` function
- Test name format: `{line-text-content} {positional-marker-line}` as specified in this document
- Each test callback includes:
  - Source markdown content (cleaned of annotations)
  - Expected token assertions at each marked position
  - File path and line number for error reporting

**Phase 3: Dynamic Test Execution**
This is automatically happening as part of the Node.js test runner
- Execute test callbacks inline during test run
- Each callback succeeds or fails immediately
- Group tests by directory/file hierarchy using node.js built-in tester conventions

### 3. Test script

```json
{
  "scripts": {
    "test": "node --test parse/tests/**/*.js"
  }
}
```
