# AI Mega Assistant

A production-ready Python Full Stack project setup.

## Project Structure

- `backend/`: Python FastAPI Application.
- `frontend/`: React + Vite + TypeScript + Tailwind CSS Application.

## Getting Started

### Backend Setup

1. Navigate to the `backend/` directory.
2. Create a virtual environment:
   ```bash
   python -m venv .venv
   ```
3. Activate the virtual environment:
   - On Windows:
     ```bash
     .venv\Scripts\activate
     ```
   - On macOS/Linux:
     ```bash
     source .venv/bin/activate
     ```
4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. Copy environment template and start the server:
   ```bash
   copy .env.example .env
   uvicorn app.main:app --reload
   ```

The backend API will be available at `http://localhost:8000`.

### Frontend Setup

1. Navigate to the `frontend/` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment template and start the dev server:
   ```bash
   copy .env.example .env
   npm run dev
   ```

The frontend application will be available at `http://localhost:5173`.
