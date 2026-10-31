# PHP and its major frameworks

- Use strict types at the top of every file. Without `declare(strict_types=1)`, a string quietly coerces into an int.
- Type every parameter, every return, and every property.
- Use constructor property promotion, readonly properties, backed enums, union and intersection types, and `match` rather than a switch for value comparison.
- Use named arguments where they make a call readable, and first-class callable syntax for passing functions around.
- Run a static analyser at a high level. Level 9 catches the null-related defects that runtime will not.
- Follow PSR-12 for formatting and PSR-15 for the HTTP layer, and PSR-11 for container wiring.
- Keep the composer manifest clean. Audit it, remove unused packages, and commit the lock file.
- Use the framework's own service container and event system rather than building a parallel one.
- In Laravel, keep Eloquent relationships explicit and use eager loading to avoid N+1. Add a query-count assertion to the test.
- In Laravel, use API resources for the wire format, Sanctum or Passport for the auth scheme, and the queue with failed-job handling for background work.
- In Laravel, put the business logic in action classes and the data access behind repositories rather than in the controller.
- In Symfony, read the locked version first and match the code to it. Symfony 6.4 uses the classic firewall configuration and the standard UX components, 7.x introduces the request-mapping attributes and AssetMapper, and 8.0 requires a newer PHP and adds the object-mapper component.
- In Symfony, use the `#[MapRequestPayload]`, `#[MapQueryParameter]`, and `#[MapUploadedFile]` attributes on the 7.x line rather than reading the request manually.
- In Symfony, use Messenger with a transport per bounded context, a failure transport, and a retry strategy that includes a delay and a multiplier.
- In Symfony, use security voters for fine-grained decisions and the `#[IsGranted]` attribute to apply them at the controller.
- In Doctrine, prefer PHP attributes over annotations on modern versions, and remember the lifecycle and proxy differences between major versions.
- For asynchronous PHP, understand that the runtime is single-threaded by default. A blocking call in a worker blocks every other request.
- Use the profiler and the production-ready build path, with the profiler disabled in production.
