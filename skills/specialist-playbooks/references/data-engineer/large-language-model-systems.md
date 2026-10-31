# Large language model systems

- Start from the use case and the quality bar, and only then choose the model. The most capable model is not automatically the right one, because latency, cost, and controlability all matter.
- Put the model behind an interface so the provider can change without the callers changing.
- Route by task. A small model for classification, a large model for the hard reasoning, and a fallback chain for when the primary fails.
- Cache aggressively on the prefix, on the retrieval result, and on the response where the same question recurs.
- Bound the context deliberately. Put the instructions and the few-shot examples in a stable prefix so the provider's prefix cache actually hits.
- For retrieval augmentation, chunk on semantic boundaries rather than a fixed token count, keep the metadata with the chunk, and evaluate retrieval separately from generation. Retrieval quality and generation quality are different problems.
- Use hybrid search, combining lexical and dense retrieval, and rerank the candidate set before it reaches the model.
- Write the prompt as a versioned artefact with an owner, a change log, and a regression set. A prompt is code.
- Add guardrails on the input and on the output, and treat them as a separate reviewable layer.
- Handle the failure modes explicitly: the refused request, the hallucinated citation, the truncated response, the tool call that failed, and the context that overflowed.
- Set a token budget and a timeout, and define what happens when either is exceeded.
- Track the cost per request, per user, and per feature, and make the budget visible to the people who own the feature.
- Never put untrusted content in a position where the model treats it as an instruction. Delimit it, label it, and do not let retrieved text change the tool permissions.
