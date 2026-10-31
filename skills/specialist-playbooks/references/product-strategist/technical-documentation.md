# Technical documentation

**What to do**

- Start from the audience and the task. Someone wants to accomplish something; structure the page around that goal rather than around the module layout.

**The working stack**

- Authoring: Markdown with a static site generator for the site, OpenAPI plus a documentation generator such as Spectral or Redocly for the reference, a diagram tool for the architecture pages, a screenshot tool for the interface pages, and the command line for the changelog and the link checking.
- Engineering: doc-as-code in the same repository as the code, a pipeline that builds the site, checks the links, runs the code samples and publishes on a tag, and a version selector tied to the released versions.
- Measurement: the documentation analytics for the search terms with no result, the page-exit rate on the pages people abandon, and the support ticket volume for the questions the docs should have answered.
- Write for progressive disclosure: the fastest path to a working result first, then the detail for the harder cases.
- Generate what can be generated. Pull API reference from the schema, extract code samples from the test suite, and keep the changelog from the commit history, so the reference does not drift from the code.
- Keep terminology in one place and use it consistently, including the names of parameters, fields and errors.
- Design for scanning: descriptive headings, short paragraphs, tables for options, and examples that show the request and the response together.
- Treat the documentation as a product with its own metrics: search terms with no result, pages with high exit rates, and support questions that the docs should have answered.

**What to watch for**

- Reference documentation that describes the implementation rather than the use.
- Examples that are stale or that use values the reader cannot obtain.
- Broken links and screenshots that no longer match the interface.
- Missing error documentation, which is where readers actually get stuck.

**Structure and review**

- Give every page a single job. A page that explains how to install, how to configure and how to debug is three pages wearing one URL.
- Write the getting-started path first and test it against a machine that has never seen the product. The fastest way to find a missing step is to have someone else hit it.
- Keep an error reference generated from the same source as the code, with the error code, the cause and the remedy for each.
- Document the version you wrote it for. A page that predates the current release is worse than no page, because it is confidently wrong.
- Run a review with someone who is not the author. The author cannot see the assumption that everyone knows a term you used once.
- Capture the questions support gets. The repeated questions are the missing documentation, and the list is a better roadmap than intuition.

**How to verify**

- Every code sample executed as part of the test suite.
- A link checker run in CI.
- A freshness review that flags pages whose underlying feature changed since the last edit.
- Support ticket volume for the top questions, tracked before and after the relevant guide ships.
