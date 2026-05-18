# Splitwise Expense Tracker

Full-stack expense sharing app:
- Backend: Node.js, Express, MongoDB
- Frontend: React (Vite)
- Styling: Tailwind CSS

## Features
- User auth (`username`, `email`, `password`)
- Create groups for trips/events
- Group creator is automatically assigned as group admin
- Group admin permissions:
  - Add members
  - Remove members
  - Delete group (and its expenses)
- Add expenses with:
  - `payer`
  - `amount`
  - `currency` (default `INR`)
  - `description`
  - `date`
  - `splitMode` (`equal`, `exact`, `percentage`)
  - `splits`
- Strict server-side validation on every field
- Split validation rules:
  - `exact`/`equal`: split totals must equal expense amount
  - `percentage`: split totals must equal `100`
- AI features (Gemini via Google AI Studio key):
  - Parse natural-language expense note into expense draft
  - Parse raw bill text into line items + total
  - Upload bill image and run OCR + structured extraction
  - Assign parsed bill items to members and prefill custom split
  - User reviews/edits draft and confirms save

## Setup

### 1) Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Set these in `backend/.env`:
- `GEMINI_API_KEY=...` (Google AI Studio key)
- `GEMINI_MODEL=gemini-2.5-flash` (or another supported model)

### 2) Frontend
```bash
cd frontend
npm install
npm run dev
```

### Single command for both builds (from project root)
```bash
npm run build
```

### Single command to run backend + frontend in dev mode
```bash
npm install
npm run install:all
npm run dev
```

Backend runs at `http://localhost:5000` and frontend at `http://localhost:5173`.

## API Summary
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/users` (auth)
- `POST /api/groups` (auth)
- `GET /api/groups` (auth)
- `PATCH /api/groups/:groupId/members/add` (auth, admin only)
- `PATCH /api/groups/:groupId/members/remove` (auth, admin only)
- `DELETE /api/groups/:groupId` (auth, admin only)
- `POST /api/expenses` (auth)
- `GET /api/expenses/group/:groupId` (auth)
- `POST /api/ai/parse-expense-text` (auth)
- `POST /api/ai/parse-bill-text` (auth)
- `POST /api/ai/parse-bill-image` (auth, multipart/form-data with `billImage`)
