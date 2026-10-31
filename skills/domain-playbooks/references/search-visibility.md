# Search visibility

**What to do**

- Audit the technical layer before touching content. Crawl errors, redirect chains, duplicate titles and canonicals, orphan pages, pagination handling, hreflang, structured data validity and JavaScript rendering.

**The working stack**

- Technical surface: robots.txt, XML sitemaps, canonical URLs, hreflang for the multi-language case, redirect chains, pagination handling, structured data written as JSON-LD against the schema.org vocabulary, and the experience signals expressed as largest contentful paint, interaction to next paint and cumulative layout shift.
- Quality and expertise: the experience, expertise, authoritativeness and trust signals, usually written E-E-A-T that the content quality updates evaluate, and the helpful content baseline that thin or templated pages fail.
- Tooling: Search Console for the real search data, an analytics property for the traffic and engagement, a crawler such as Screaming Frog for the technical audit, PageSpeed Insights for the lab measurement of the core web vitals, and the rich results test for the structured data validation.
- Treat Core Web Vitals as the performance contract: largest contentful paint, interaction to next paint and cumulative layout shift, measured in the field through the search console or a real user monitoring tool, not only in a lab score.
- Build structured data with JSON-LD and validate it against the schema validator and the rich result test.
- Research intent before keywords. Classify each target by what the searcher actually wants, then write the page that answers it, and keep the page structure friendly to featured snippet extraction.
- Earn links rather than buy them. Authority comes from content other people cite.
- Design the internal link graph deliberately. Orphans and hub-and-spoke structures both affect crawl efficiency and topic clustering.

**What to watch for**

- Helpful content and expertise signals. Thin content that rewrites a source is a liability, not an asset.
- Core updates and spam updates. The recovery path is a real content audit, not a keyword refresh.
- Duplicate content across templated pages, which is the most common self-inflicted wound at scale.
- JavaScript-only rendering that the crawler cannot execute or index.

**How to verify**

- A crawl with a full export of status codes, canonical assignment, and heading structure.
- Field data before and after, with the date range and the device split stated.
- Structured data validation output with no errors on the templates you change.
- Ranking movement measured on a fixed keyword set over a fixed window, not cherry-picked winners.

