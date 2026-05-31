FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-heb \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PERSIK_SERVER=1
ENV AUTO_PRINT_INVOICES=false
ENV HOST=0.0.0.0
ENV PORT=8080

EXPOSE 8080

CMD ["python", "persik_server.py"]
