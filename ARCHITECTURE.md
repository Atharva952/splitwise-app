# Splitwise AI — Architecture

## Tech Stack

### Frontend
- React.js
- Tailwind CSS
- Vite

### Backend
- Node.js
- Express.js

### Database
- MongoDB + Mongoose

### AI Features
- OCR + NLP expense parsing
- Natural language expense extraction
- Bill image parsing

---

# Why Node.js Instead of Python?

I selected Node.js because the entire application stack is JavaScript-based.

Advantages:

- Same language on frontend and backend
- Faster development speed
- Easier code sharing
- Better real-time handling
- Simpler deployment
- Large ecosystem for APIs and authentication

Why not Python?

Python is excellent for AI and ML workloads, but for this project:

- Real-time CRUD operations were more important
- The AI features are API-assisted rather than heavy ML training
- Maintaining one language across the stack reduced complexity

Node.js was the better choice for:
- Authentication
- Real-time expense updates
- Group management
- API development
- Faster iteration

---

# System Architecture

Frontend (React)
    ↓
REST API (Express)
    ↓
Business Logic Layer
    ↓
MongoDB Database
    ↓
AI Services / OCR Parsing

---

# Database Schema

## User Schema

```js
{
  username: String,
  email: String,
  password: String
}
```

---

## Group Schema

```js
{
  name: String,
  description: String,
  createdBy: ObjectId,
  admins: [ObjectId],
  members: [ObjectId]
}
```

---

## Expense Schema

```js
{
  groupId: ObjectId,
  payer: ObjectId,
  amount: Number,
  currency: String,
  description: String,
  splitMode: String,
  splits: [
    {
      user: ObjectId,
      value: Number
    }
  ]
}
```

---

# API Endpoints

## Authentication

### Register
POST `/api/auth/register`

### Login
POST `/api/auth/login`

---

## Users

### Get All Users
GET `/api/users`

---

## Groups

### Create Group
POST `/api/groups`

### Get Groups
GET `/api/groups`

### Add Member
POST `/api/groups/:id/members`

### Remove Member
DELETE `/api/groups/:id/members/:memberId`

### Delete Group
DELETE `/api/groups/:id`

---

## Expenses

### Create Expense
POST `/api/expenses`

### Get Group Expenses
GET `/api/expenses/group/:groupId`

---

## AI Features

### Parse Expense Text
POST `/api/ai/parse-expense`

### Parse Bill Text
POST `/api/ai/parse-bill`

### Parse Bill Image
POST `/api/ai/parse-bill-image`

---

# Frontend Component Structure

```txt
src/
│
├── App.jsx
├── api.js
├── main.jsx
│
├── components/
│   ├── Auth
│   ├── Group Management
│   ├── Expense Form
│   ├── AI Assistant
│   ├── Expense List
│   └── Settlement Section
```

Currently most logic exists in a single App.jsx file because the project was initially built rapidly during prototyping.

---

# Settle-Up Algorithm

The application uses a balance minimization algorithm.

## Step 1 — Calculate Balances

For every expense:

- Payer gets credited
- Split participants get debited

Example:

```txt
A paid ₹1000
B owes ₹500
C owes ₹500

Balances:
A +1000
B -500
C -500
```

---

## Step 2 — Separate Creditors and Debtors

```txt
Creditors:
A +1000

Debtors:
B -500
C -500
```

---

## Step 3 — Greedy Settlement

The algorithm matches:

- highest debtor
- highest creditor

until balances become zero.

Result:

```txt
B pays A ₹500
C pays A ₹500
```

Time Complexity:
- O(n log n) in optimized form
- Current implementation works efficiently for small-medium groups

---

# AI Feature Failure Handling

AI systems are unreliable by nature, so multiple safeguards were added.

## Expense Parsing Failures

Handled using:

- Validation errors
- Missing field checks
- Confidence scoring
- Manual review before applying

Example:

```txt
"Could not detect payer"
"Invalid amount"
```

---

## OCR Failures

Bill OCR may fail because of:

- blurry images
- poor lighting
- handwritten bills

Fallbacks:
- raw OCR preview shown to user
- manual editing supported
- users can assign items manually

---

## API Failure Handling

All AI requests use:

```js
try {
} catch(err) {
}
```

with:
- loading states
- error messages
- retry support

---

# Security

Implemented:
- JWT Authentication
- Protected Routes
- Password hashing
- Request validation

---

# What I Would Improve With More Time

## 1. Better Component Architecture

Current App.jsx is very large.

Would refactor into:
- reusable hooks
- context providers
- separate feature modules

---

## 2. WebSocket Support

Real-time group updates using:
- Socket.IO

---

## 3. Advanced AI

Would add:
- GPT structured extraction
- smarter OCR cleanup
- multilingual bill parsing

---

## 4. Payment Integration

Would integrate:
- Stripe
- Razorpay
- UPI settlement links

---

## 5. Analytics Dashboard

Would add:
- charts
- spending trends
- category tracking

---

## 6. Offline Support

Would add:
- PWA support
- local caching
- sync queue

---

# Deployment Plan

Frontend:
- Vercel / Netlify

Backend:
- Render / Railway

Database:
- MongoDB Atlas

---

# Conclusion

This project combines:
- full-stack web development
- AI-assisted parsing
- OCR processing
- financial settlement logic

into a modern collaborative expense-sharing platform inspired by Splitwise.