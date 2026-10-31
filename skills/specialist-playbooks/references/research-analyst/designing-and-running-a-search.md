# Designing and running a search

**What to do**

- Write the question before the query. A search that starts from a keyword rather than a question returns material you cannot evaluate, because you do not yet know what would answer it.

**The query vocabulary**

- Boolean and proximity operators, wildcards, field-restricted search, faceted narrowing and query expansion, with the syntax per source because a bibliographic database and a web engine do not speak the same query language.
- Beyond keyword search: semantic retrieval for concepts the vocabulary has not settled on, citation tracking in both directions from a known-good paper, reverse search from a document to find its sources, and cross-reference mining across structured databases.
- Where an API exists, use it rather than scraping. The patent, clinical-trial and company registries all publish structured endpoints with their own limits, and the limit is worth reading before the request is written.
- Choose sources deliberately and in order of authority: primary regulatory and standards publications, peer-reviewed literature, the organisation's own data, then reputable secondary analysis, then commentary and community material for leads only.
- Build queries per source, because the syntax differs. Boolean operators and fielded queries on bibliographic databases, proximity and phrase operators on general web search, and site-restricted, filetype and date-range filters where the engine supports them.
- Use synonyms, domain terminology, and the older names for a thing. Vocabulary drifts, and the concept may be indexed under a phrase that has fallen out of use.
- Iterate rather than repeat. A query that returns nothing useful is a signal about the vocabulary, not about the absence of the material.
- Cover the periphery. Citation tracking backwards and forwards, reverse search on a known-good document, and searching for the term the field used before the current hype cycle, all find material that keyword search misses.
- Deduplicate, rank by quality and relevance rather than by position, and record the source for each retained item.

**What to watch for**

- The top result as the answer. Position reflects a ranking model, not authority.
- A single-source conclusion, particularly when the source is a vendor with a commercial interest in the finding.
- Documents that cite each other in a circle and no primary evidence.
- Search results behind a paywall being summarised by a secondary source that flattens the caveat.
- Recency as a proxy for accuracy. A foundational result from twenty years ago may still be the reference.

**How to verify**

- The report states the question, the sources consulted, the queries used and the date the search was run, so another researcher can repeat it.
- Every retained item has its source named and its date recorded.
- A claim that rests on one source is marked as such in the output.
- Coverage is checked by searching from at least two different vocabularies and confirming that the result set does not change materially.

**Scheduled and recurring discovery**

- Where a question needs to stay answered, set up a recurring capture rather than repeating the search by hand. Feed subscriptions, change notifications on the pages that matter, and periodic reruns of the queries that found the material last time.
- Keep the query set in version control with a note on what each query is looking for, so the search can be audited and improved rather than rebuilt from scratch each time.
- Diff against the previous capture so that only the genuinely new material gets read. Re-reading everything is what makes a monitoring task get abandoned.
- Decide in advance what a new item triggers. A monitoring feed without a decision attached becomes a pile of unread links.
- Record the state of the source at capture time. A page that changes later means the captured text and the current text disagree, and only the capture is citable.
