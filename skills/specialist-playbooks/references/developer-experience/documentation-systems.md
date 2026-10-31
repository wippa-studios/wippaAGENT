# Documentation systems

- Design the information architecture before you write a page. A reader with a question needs a path, not a site map of everything.
- Separate the layers: a tutorial that gets a newcomer to a working result, a guide that explains how to do a task, a reference that states the facts, and an explanation that gives the reasoning.
- Put the reference content where it can be generated from the code, and keep the prose for the parts the code cannot say.
- Keep the search working, and check that the terms people actually use are the terms in the page titles.
- Make the page load fast and the page work on a phone. A documentation site that takes four seconds to render is a site people leave.
- Make it accessible. The documentation is often the first thing a screen reader user meets in a product.
- Version the documentation with the software, and make it clear which version a page describes.
- Write the code examples so they can be executed. An example that is copied and fails teaches the reader that the documentation is unreliable.
- Put the runnable examples in the test suite so a broken example fails the build.
- Keep the examples minimal, with one concept each. An example that demonstrates six things demonstrates none of them.
- Write the title as the task, not the topic. "Rotate an API key" beats "API keys".
- Put the prerequisites at the top, and the expected result at the bottom, so the reader can tell whether the example worked.
- Give every page an owner, and review the pages on a schedule. Documentation decays fastest on the pages nobody owns.
- Track the search terms that produce no result, and treat that as a list of missing pages.
