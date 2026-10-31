# API reference

- Generate the specification from the implementation where the implementation is the truth, and hand-write the parts that describe intent.
- Cover every endpoint. A reference with a gap teaches the reader to guess.
- Document the request, the response, the error, and the authorisation for each operation, since those four together are the contract.
- Give every field a description and a type, and mark the optional and the nullable separately. A field marked optional in the schema and required in the text is a defect.
- Include a realistic example value for every field. An example is what a caller copies.
- Document the error catalogue centrally, and reference it from each endpoint, so the codes are consistent.
- Document the authentication scheme properly, with a complete token example for the flow the reader needs.
- Document the rate limits, the pagination, the filtering, the sorting, and the idempotency, since these are the parts a caller gets wrong.
- Document the webhooks, with the event type, the payload, the signature scheme, and the verification steps.
- Make the reference explorable, with a try-it-out console that runs against a sandbox rather than against production.
- Generate the client examples in several languages from the same specification, so the examples cannot drift from the contract.
- Version the specification and publish the changelog with it, so a consumer can see what changed.
- Check the specification itself with a validator in the pipeline, and lint it for the conventions your house style uses.
