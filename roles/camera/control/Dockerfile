FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --upgrade pip setuptools wheel && \
    pip install --no-cache-dir --timeout 300 --retries 5 \
    --index-url https://www.piwheels.org/simple \
    --extra-index-url https://pypi.org/simple \
    -r requirements.txt

COPY app.py ./
COPY ../openapi.yaml ./openapi.yaml

EXPOSE 8083

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8083"]
