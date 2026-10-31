# Django

- Use the app-per-domain layout. A `views.py` that imports from six apps is a module boundary that failed.
- Keep models fat and views thin. Business rules belong on the model, in a manager, or in a service layer.
- Use `select_related` for foreign keys and `prefetch_related` for many-to-many and reverse relations. An N+1 in a list view is the most common Django performance bug.
- Check the query count in tests. A test that renders a list view and asserts on the number of queries catches the regression permanently.
- Use `Model.objects` custom managers for reusable filtering, and keep the scopes composable.
- Write migrations for every model change and review the generated SQL before shipping it.
- Use `select_for_update` when you need row-level locking, and keep the transaction short.
- Use Django REST Framework for APIs: serializers for the wire format, viewsets for the collection behaviour, permission classes for access, throttling for abuse.
- Version the API deliberately, and keep the version in the URL or a header consistently.
- Use `async def` views for I/O-bound work, and remember that most third-party Django packages are still synchronous.
- Use Celery for task queues when the project has it, with idempotent tasks, a dead-letter path, and a retry policy.
- Customise the admin for internal tools, but treat it as an internal surface and enforce permissions on the model.
- Use `STORAGES` and the staticfiles pipeline rather than serving static files from the application server.
- Turn on the security middleware settings the deployment guide lists, and set the cookie and host headers explicitly.
- Use `manage.py check --deploy` before a release, and read what it reports.
