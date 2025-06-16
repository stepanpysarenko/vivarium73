FROM python:3.11-slim
WORKDIR /app
RUN apt-get update -qq && apt-get install -y curl --no-install-recommends && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt --no-warn-script-location
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]