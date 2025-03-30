FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
RUN apt update && apt install -y curl
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]