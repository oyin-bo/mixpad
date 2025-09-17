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

## Explicit Constraints

These are considered hard constraints set out as the policy.

* There is no build step. All code is JavaScript with JSDoc comments ready to be run.
* No temporary scripts or scripts are allowed in the project at any time except in git-ignored locations.
* This project relies on a test script in package.json for running tests.
* The [older implementation](old-parser) of the parser in MixPad is deprecated and should not be used directly, only for historical reference and for comparison.
* Align with coding conventions in the project, including types, file and JS entity naming, JSDoc usage, and modularity. Some points explicitly highlighted:
  - No old-style Array<T> types, use T[] instead.
  - Where multiple members of a type used, separate them with comma.
  - No trailing comma in object or calls, or arrays.
* To run tests use `npm test`. Do not try to run tests in any other way.
