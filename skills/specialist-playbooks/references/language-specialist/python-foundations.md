# Python foundations

- Type the public surface. Annotate every function signature and every class attribute that a caller touches.
- Use `from __future__ import annotations` if the project targets a Python version where the newer union syntax is unavailable at runtime.
- Prefer `X | None` and `list[str]` over `Optional[X]` and `List[str]` on modern versions, but match the surrounding file.
- Use `Protocol` for structural typing where a nominal subclass is not required.
- Use `TypedDict` for a dictionary with a known shape and `Literal` for a closed set of string values.
- Use `dataclass` or `NamedTuple` for data carriers and `pydantic` models for validated external data.
- Write comprehensions and generator expressions instead of accumulating lists in a loop. The generator version avoids materialising the whole collection.
- Use context managers for anything with a lifecycle.
- Use `asyncio` for I/O-bound concurrency. Use `concurrent.futures` or `multiprocessing` for CPU-bound work; threads will not help there.
- Use `asyncio.TaskGroup` on modern Python so sibling tasks are cancelled together when one fails.
- Never block the event loop. A synchronous HTTP call or a blocking database driver inside an async function stalls every concurrent request.
- Run the blocking work in a thread or process executor when it cannot be avoided.
- Use `asyncio.timeout` or a `wait_for` with an explicit deadline on every await that talks to the network.
- Follow PEP 8 for layout, use a formatter the project already has, and write docstrings in the style the project uses.
- Use `pytest` fixtures for setup, `pytest.mark.parametrize` for the cases that vary by input, and `pytest-cov` for coverage.
- Use `Hypothesis` for property-based tests where an invariant matters more than a set of examples.
- Profile before optimising. A vectorised NumPy operation is usually the answer, and a Python loop is usually the problem.
- Use `bandit` for a static security pass and `mypy` in strict mode for the type check.
