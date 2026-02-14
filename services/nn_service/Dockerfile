FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . ./nn_service

RUN groupadd -g 1001 appuser && useradd -u 1001 -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser

ENV PYTHONPATH=/app
CMD uvicorn nn_service.main:app --host 0.0.0.0 --port ${PORT:-8000}
