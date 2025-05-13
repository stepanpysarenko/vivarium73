FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install --no-cache-dir -r requirements.txt --no-warn-script-location
RUN apt-get update -qq && apt-get install -y curl --no-install-recommends && rm -rf /var/lib/apt/lists/*
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]