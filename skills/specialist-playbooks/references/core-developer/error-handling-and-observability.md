# Error handling and observability

- Log at the level the event deserves. Errors are for things someone must act on, and if everything is an error, nothing is.
- Include the identifiers needed to reconstruct the request: correlation id, user id, resource id, and the upstream span.
- Never log a credential, a session token, a full card number, or personal data that the log system is not allowed to hold.
- Distinguish a fault the user caused from a fault the system caused. The status code, the retry advice, and the escalation path all differ.
- Make the error message useful to the person reading it at three in the morning. Include what was expected, what was received, and which identifier to search for.
- Instrument the boundary, not every line. Count requests, errors, and durations by route, and let the traces carry the detail.
- Give every request a trace that crosses process boundaries. Without propagation, a distributed failure is a set of unrelated logs.
- Alert on symptoms a user feels, not on causes you can see. Saturation and error rate beat CPU.
- Record a deployment marker so a change in the graph can be correlated with a release.
- Make the health of a dependency visible in the response of the caller that depends on it, so a partial outage reads as partial rather than total.
