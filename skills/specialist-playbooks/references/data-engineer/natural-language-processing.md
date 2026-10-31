# Natural language processing

- Start with the preprocessing decision, because it dominates the result. Tokenisation, normalisation, encoding, and noise removal need to match the data.
- Use the tokenizer that came with the model when you use a pretrained model. A different tokenizer silently changes the meaning.
- Handle multilingual text deliberately, with language detection, and evaluate per language rather than in aggregate.
- For named entity recognition, choose the model, prepare the training data, and add the post-processing rules for the domain. Confidence scores matter as much as the labels, because a low-confidence extraction should be routed to a person.
- Use active learning for the labelling budget, so the examples you label are the ones the model is unsure about.
- For classification, deal with class imbalance explicitly with resampling, class weights, or a threshold tuned for the operating cost.
- Use a threshold tuned to the cost of each error type, not the default threshold. The default assumes the two errors cost the same.
- Support zero-shot and few-shot paths when the labelled data is scarce, and evaluate them against the same held-out set as everything else.
- For language modelling, choose between adapting a pretrained model and training from scratch based on the data volume, and know the compute difference.
- For translation, use back-translation to expand a small parallel set, and use a quality estimate to route low-confidence output to review.
- For summarisation and generation, evaluate faithfulness against the source, not fluency. Fluent output that contradicts the input is the worse failure.
- Measure latency on the real input length distribution, not on a sample of short sentences.
- Document the pipeline end to end, because a text pipeline with an undocumented normalisation step cannot be reproduced.
