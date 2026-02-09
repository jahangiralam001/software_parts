FROM python:3.11-slim

# Install system packages required by WeasyPrint
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libglib2.0-0 \
    libffi-dev \
    libxml2 \
    libxslt1.1 \
    libjpeg62-turbo \
    fontconfig \
    fonts-dejavu-core \
    shared-mime-info \
    libpixman-1-0 \
    libfreetype6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --upgrade pip setuptools \
    && pip install --no-cache-dir -r backend/requirements.txt

# Copy the whole project
COPY . .

ENV PYTHONUNBUFFERED=1
ENV PORT=5000
ENV ENABLE_PDF=1

EXPOSE 5000

CMD ["python", "backend/run.py"]
