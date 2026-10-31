# Prompt design and evaluation

- Start from the output contract. Write down the shape of the answer you need, then write the instruction that produces it.
- Put the instruction where the model reads it first, and keep the stable content at the top so the prefix cache works.
- Use a role only when the role changes the answer. A role prompt that adds nothing is noise.
- Use few-shot examples that are diverse, consistently formatted, and cover the edge cases, and keep the order stable so the result is reproducible.
- Use a chain of thought where the reasoning is genuinely multi-step, and do not use it where the model could just state the answer.
- Constrain the output with a format the caller can parse, and validate it before it is used. A structured output that is not validated is a string.
- Keep the prompt short. Every unnecessary token costs money on every call.
- Build a regression set of real inputs with the expected behaviour, and run it on every change. A prompt change without an evaluation is a change without a safety net.
- Evaluate on the metric that matters for the use case, and include the failure cases in the set rather than only the clean ones.
- A and B the prompts against the same set, and keep the winner.
- Version the prompt and the model identifier together, because the same prompt behaves differently on a different model.
- Track the per-call token usage, the latency, and the error rate per prompt version.
- Have a fallback prompt and a fallback model, and know when the fallback fires.
