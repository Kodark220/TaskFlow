FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent code
COPY . .

# Port for the dummy web server (to pass health checks)
EXPOSE 10000

# Run python in unbuffered mode to stream logs instantly
CMD ["python", "-u", "runner.py"]
