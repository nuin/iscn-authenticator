FROM python:3.14-slim AS dependencies

WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:0.13.1 /uv /usr/local/bin/uv
COPY api/pyproject.toml api/uv.lock ./api/
RUN uv sync --project api --locked --no-dev

FROM python:3.14-slim

WORKDIR /app
ENV PATH="/app/api/.venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000
COPY --from=dependencies /app/api/.venv ./api/.venv
COPY api/server.py ./api/server.py

USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.environ['PORT'] + '/health', timeout=2)"

CMD ["python", "api/server.py"]
