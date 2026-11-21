FROM python:3.14.10-slim-bookworm@sha256:3fe1a0b6c2d6b2ebb572906cdabeca75aeb558c0c17db5ffefbcf8094871c32b

LABEL org.opencontainers.image.title="CAVEQIS" \
      org.opencontainers.image.description="Browser-based mathematical toolbox" \
      org.opencontainers.image.version="1.2.0"

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt ./
RUN python -m pip install --no-cache-dir --disable-pip-version-check -r requirements.txt
COPY app.py calculation.py engine.py equation_solver.py ./
COPY static/ ./static/

USER 10001:10001
EXPOSE 8765
HEALTHCHECK --interval=30s --timeout=4s --start-period=5s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/api/health', timeout=2).close()"]
CMD ["python", "app.py", "--host", "0.0.0.0", "--port", "8765"]
