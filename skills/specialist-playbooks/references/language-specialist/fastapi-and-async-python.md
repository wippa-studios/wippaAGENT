# FastAPI and async Python

- Define Pydantic v2 models for every request and response body. The generated schema and the validation are the same artefact.
- Use `field_validator` and `model_validator` for constraints the type system cannot express, and keep the messages actionable.
- Use discriminated unions for a body that has several shapes, so the schema and the code both understand the variants.
- Use `Annotated` for metadata that travels with the type, so the dependency and the constraint are declared once.
- Use dependency injection for anything shared across routes: the database session, the current user, the authorisation check, the rate limiter.
- Use `yield` dependencies for resources that need teardown. The teardown runs after the response is sent.
- Put the request-scoped database session in a dependency with `yield`, and commit or roll back inside it.
- Use `lifespan` for startup and shutdown, and do not do heavy work there.
- Register explicit exception handlers for the error types your application raises, and return the same error shape the rest of the API uses.
- Use `BackgroundTasks` for work that does not need to survive a restart. Anything that does needs a real queue.
- Use `APIRouter` per domain with prefixes and tags, and mount the routers in one place.
- Use SQLAlchemy 2.0 async sessions with an async engine, and use Alembic for migrations.
- Use `httpx.AsyncClient` in tests with the `ASGITransport` so the test exercises the actual application.
- Be careful with `async` in tests. An un-awaited coroutine in a sync test passes silently.
