# PORTIX: imagen para el despliegue (por ejemplo en Render).
# Un solo servicio: FastAPI responde la API y además sirve el frontend compilado.

# --- Etapa 1: compilar el frontend (React + Vite) ---------------------------
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Etapa 2: backend (FastAPI) que sirve todo --------------------------------
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY --from=frontend /app/frontend/dist frontend/dist

WORKDIR /app/backend
# Render indica el puerto en la variable PORT; en local se usa 8000.
# GEMINI_API_KEY, GEMINI_MODEL y PORTIX_HORA_ACTUAL se configuran en el
# panel de Render, nunca en este archivo.
CMD ["sh", "-c", "uvicorn servidor:app --host 0.0.0.0 --port ${PORT:-8000}"]
