# Tool server and client development

- Follow the protocol rather than your assumptions of it. The wire format is JSON-RPC 2.0, and the message shapes are specified.
- Model the tools, the resources, and the prompts as a clean surface. Each one has a name, a description, and a schema, and the schema is validated in both directions.
- Validate the input against the schema at the boundary and reject what does not fit, with a message that says what was expected.
- Sanitise the output, because the output is fed to a model or a human downstream and can carry content the consumer did not expect.
- Put the authentication in the transport, and never accept an unauthenticated call to a privileged tool.
- Rate limit the tool calls, and bound the work each call can do. A tool that shells out needs a timeout and a resource limit.
- Support the transports the project needs, and abstract the transport away from the tool implementations so a new transport is not a rewrite.
- Handle the notification case, where there is no response, without treating it as a failure.
- Make the client resilient: reconnect, resubscribe, and surface a broken connection rather than hanging.
- Keep the session state explicit, and make the tool call idempotent where it can be, because a model may retry.
- Instrument the calls with latency and error counts, since a slow tool is a slow assistant.
- Write the schema and the description so a model can pick the right tool. A vague description produces a wrong tool call, and the fix is in the description.
- Test the server against the reference implementations of the protocol, and test the client against a server you did not write.
