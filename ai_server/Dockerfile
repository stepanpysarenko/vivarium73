FROM python:3.11-slim
WORKDIR /app
RUN pip install fastapi uvicorn pydantic numpy
RUN apt update && apt install -y curl
RUN pip install -r requirements.txt
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]