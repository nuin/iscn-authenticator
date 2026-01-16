FROM python:3.12-slim

WORKDIR /app

# Copy requirements first for caching
COPY api/requirements.txt ./api/
RUN pip install --no-cache-dir -r api/requirements.txt

# Copy application code
COPY iscn_authenticator/ ./iscn_authenticator/
COPY api/ ./api/

# Expose port
ENV PORT=8000
EXPOSE 8000

# Run the server
CMD ["python", "-m", "uvicorn", "api.server:app", "--host", "0.0.0.0", "--port", "8000"]
