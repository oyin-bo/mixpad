# Look in [README](README.md) for details

The project's goals and principles are well described in the opening README.

Here are strict rules for an agentic work:
* NEVER create stray dummy files for debugging around the repository. Use genuine unit tests to verify behaviour if you need to.
* JavaScript with JSDoc is the only allowed source language. No TypeScript, no other languages.
* Testing framework is the key, and it must be followed strictly to the letter.

Please focus majorly on understanding the testing philosophy using annotated Markdown.

## Annotated Markdown Testing Philosophy

MixPad employs an innovative **[annotated markdown testing approach](parse/docs/1-annotated-markdown.md)** that serves as documentation, verification, and implementation guide simultaneously. This testing infrastructure represents a core innovation that enables the project's rapid development pace while maintaining bulletproof reliability.


This testing philosophy is central to MixPad's ability to move fast while staying grounded - every feature is specified, verified, and documented through this unified approach, creating a feedback loop that accelerates development while maintaining reliability.

### Infinite loop prevention

When debugging infinite loops in the parser, use Node.js's built-in test runner with a timeout. Prefer running tests via `npm test` (the project `test` script passes `--test-timeout`) or run directly, for example:

```
node --test --test-concurrency=1 --test-timeout=5000
```

The `--test-timeout` option provides the timeout protection previously supplied by the repository's custom harness and is the recommended approach.

### Running individual tests for debugging

The annotated Markdown test harness creates individual tests for each test block, enabling focused debugging. Use `--test-name-pattern` to run specific tests:

```bash
# Run a single failing test
node --test --test-name-pattern="snake_case" parse/tests/test-produce-annotated.js

# Run all tests for a specific feature
node --test --test-name-pattern="backtick" parse/tests/test-produce-annotated.js

# Run tests from a specific file
node --test --test-name-pattern="entities.md" parse/tests/test-produce-annotated.js
```

This is the recommended workflow when debugging scanner behavior, fixing edge cases, or iterating on a specific feature. It's much faster than running the entire test suite repeatedly.

See the [debugging section in annotated markdown docs](parse/docs/1-annotated-markdown.md#debugging-and-test-selection) for complete details.

## Directness

Always give direct answers to questions. DO NOT embellish or recommend anything unless requested.

Do not announce writing TODOs.

## Explicit Constraints

These are considered hard constraints set out as the policy.

* There is no build step. All code is JavaScript with JSDoc comments ready to be run.
* No temporary scripts or scripts are allowed in the project at any time except in git-ignored locations. Any temporary scripts COULD only be created in git-ignored locations.
* This project relies on a test script in package.json for running tests.
* The [older implementation](old-parser) of the parser in MixPad is deprecated and should not be used directly, only for historical reference and for comparison.
* Align with coding conventions in the project, including types, file and JS entity naming, JSDoc usage, and modularity. Some points explicitly highlighted:
  - No old-style Array<T> types, use T[] instead.
  - Where multiple members of a type used, separate them with comma.
  - No trailing comma in object or calls, or arrays.
* To run tests use `npm test`. Do not try to run tests in any other way.
* If a question implies a short answer, it is forbidden to answer with more than 2 paragraphs of text.
* If a question demands explanation, it is forbidden to modify any files in the project.

NO EXCEPTIONS to these rules are allowed.
