FROM python:3.11-alpine3.20

# Tools for CEC control
RUN apk add --no-cache v4l-utils ca-certificates && \
    update-ca-certificates || true

WORKDIR /app
COPY requirements.txt .
RUN python3 -m pip install --no-cache-dir --upgrade pip setuptools wheel && \
    python3 -m pip install --no-cache-dir -r requirements.txt

COPY app.py ./
COPY ../openapi.yaml ./openapi.yaml

EXPOSE 8082
CMD ["python3", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8082"]

