FROM python:3.11-slim

# Install system packages required by WeasyPrint
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libglib2.0-0 \
    libgobject-2.0-0 \
    libffi-dev \
    libxml2 \
    libxslt1.1 \
    libjpeg-dev \
    fontconfig \
    fonts-dejavu-core \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies (requirements file lives in backend/)
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --upgrade pip setuptools
RUN pip install -r /app/backend/requirements.txt

# Copy the whole project
COPY . /app

ENV PYTHONUNBUFFERED=1

# Render will set $PORT; default to 5000 for local testing
ENV PORT=5000

EXPOSE 5000

CMD ["python", "backend/run.py"]
