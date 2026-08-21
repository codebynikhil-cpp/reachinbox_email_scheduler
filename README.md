# ReachInbox - Distributed Full-Stack Email Job Scheduler

[![Live Frontend](https://img.shields.io/badge/Frontend-Vercel-black?style=flat&logo=vercel)](https://reachinbox-email-scheduler-orcin.vercel.app)
[![Live Backend](https://img.shields.io/badge/Backend-Render-46E3B7?style=flat&logo=render)](https://reachinbox-email-scheduler-g01t.onrender.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![BullMQ](https://img.shields.io/badge/BullMQ-Redis_Queue-red?style=flat&logo=redis)](https://bullmq.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon_Cloud-336791?style=flat&logo=postgresql)](https://neon.tech/)

A production-grade, distributed, fault-tolerant Email Scheduling & Dispatch Platform designed and built for the **Outbox Labs / ReachInbox Assignment**.

---

##  Live Production Deployments

- **Live Application**: [https://reachinbox-email-scheduler-orcin.vercel.app](https://reachinbox-email-scheduler-orcin.vercel.app)
- **Live Backend API**: [https://reachinbox-email-scheduler-g01t.onrender.com](https://reachinbox-email-scheduler-g01t.onrender.com)
- **Health Check**: `https://reachinbox-email-scheduler-g01t.onrender.com/api/health`

> **Note for Reviewers**:
> The deployed application is configured with developer OAuth credentials. Reviewers can sign in directly using their personal Google account without generating API credentials.

---

## System Architecture

```
                                  ┌────────────────────────────────┐
                                  │      React + Vite Frontend     │
                                  │     (Deployed on Vercel)       │
                                  └───────────────┬────────────────┘
                                                  │ HTTPS + JWT HttpOnly Cookie
                                                  ▼
                                  ┌────────────────────────────────┐
                                  │     Node.js + Express API      │
                                  │      (Deployed on Render)      │
                                  └───────┬───────────────┬────────┘
                                          │               │
                 Prisma Transaction Write │               │ Add Bulk Delayed Jobs
                                          ▼               ▼
                       ┌──────────────────────┐  ┌──────────────────────┐
                       │  PostgreSQL (Neon)   │  │   Redis (Upstash)    │
                       │ Campaigns & Emails   │  │ BullMQ Delayed Queue │
                       └──────────────────────┘  └──────────┬───────────┘
                                                            │
                                  ┌─────────────────────────┴──────┐
                                  │       BullMQ Email Worker      │
                                  │  (Distributed Task Processor)  │
                                  └───────────────┬────────────────┘
                                                  │
                                 ┌────────────────┴────────────────┐
                                 │ 1. Atomic DB State Transition   │
                                 │ 2. Distributed Sliding Rate Lmt │
                                 │ 3. Inter-Email Delay Slot Lock  │
                                 │ 4. Nodemailer SMTP Dispatch     │
                                 └────────────────┬────────────────┘
                                                  │
                                                  ▼
                                      ┌──────────────────────┐
                                      │ Ethereal Test Email  │
                                      │ (Live Preview URLs)  │
                                      └──────────────────────┘
```

---

## Key Engineering Highlights & Requirements

### 1. No Polling / No Cron Database Scanners
- Instead of running periodic `setInterval` or cron database queries to find due emails, emails are enqueued directly to **BullMQ as timestamp-delayed jobs**.
- Delayed jobs leverage Redis Sorted Sets (`ZSET`), which fire accurately at the exact scheduled millisecond with $O(\log N)$ efficiency.

### 2. Distributed Rate Limiting & Concurrency Control
- **Hourly Quota Limiting**: Evaluated per sender via an **Atomic Redis Lua Script**. When a user's hourly quota is reached (e.g. 100 emails/hr), excess emails are automatically deferred to the start of the next hour without losing data.
- **Inter-Email Spacing**: Distributed send-slot reservation script guarantees that even with multiple worker nodes, consecutive emails from the same sender maintain the user-configured minimum gap (e.g., 2000ms).

### 3. Idempotent & Fault-Tolerant State Machine
- **Atomic Claiming**: Transitions `SCHEDULED` $\rightarrow$ `PROCESSING` using conditional SQL updates. Only one worker instance can claim an email.
- **Exponential Backoff**: Transient errors (SMTP timeouts, network glitches) trigger automatic retries with exponential backoff before being recorded as `FAILED`.
- **Zero Duplicates on Restart**: Every BullMQ job uses a deterministic ID (`email-<emailId>`). Duplicate scheduling requests or server restarts never generate duplicate emails.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|:---|:---|
| **Frontend** | React 18, TypeScript, Vite, Vanilla CSS Design System, Lucide Icons, Axios |
| **Backend API** | Node.js (Node 20+), Express.js, TypeScript, Prisma ORM, Multer |
| **Data & Storage** | PostgreSQL (Neon Cloud / Docker), Redis (Upstash / Docker) |
| **Task Queue** | BullMQ (Redis-backed distributed delayed message queue) |
| **Email Protocol** | Nodemailer, Ethereal SMTP with real-time test preview link generation |
| **Authentication** | Google OAuth 2.0 (`google-auth-library`), JWT in secure `HttpOnly` cookie |
| **Testing** | Vitest, Supertest, Unit & Load Simulation Tests |

---

## Local Setup & Quickstart Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v20.x or higher)
- [Docker & Docker Compose](https://www.docker.com/) (for local PostgreSQL & Redis)

### 1. Clone the Repository
```bash
git clone https://github.com/codebynikhil-cpp/reachinbox_email_scheduler.git
cd reachinbox_email_scheduler
```

### 2. Start Local Databases via Docker
```bash
docker-compose up -d
```
*(Starts PostgreSQL on `localhost:5432` and Redis on `localhost:6379`)*

### 3. Configure Backend Environment
Create `backend/.env` (or copy from `backend/.env.example`):
```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://reachinbox:reachinbox@localhost:5432/reachinbox_db?schema=public
REDIS_URL=redis://localhost:6379
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Email & Worker Tuning
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_FROM=ReachInbox Scheduler <noreply@reachinbox.ai>
WORKER_CONCURRENCY=5
MIN_EMAIL_DELAY_MS=2000
MAX_EMAILS_PER_HOUR=100
```

### 4. Setup Backend Database & Start Server
```bash
cd backend
npm install
npx prisma db push
npm run dev
```

### 5. Configure Frontend Environment & Start Client
In another terminal:
```bash
cd frontend
npm install
npm run dev
```
*(Open [http://localhost:3000](http://localhost:3000) in your browser)*

---

## 🧪 Running Automated Tests

The repository includes a comprehensive automated test suite covering:
- Health checks and API routes
- Authentication & protected endpoint guards
- CSV parsing, deduplication, and case-insensitive email validation
- Distributed rate limiter (Redis Lua script sliding windows)
- Deterministic job scheduling & idempotency
- 100-email concurrent load simulation

Run all 27 automated tests:
```bash
cd backend
npm test
```

---

## Repository Structure

```text
reachinbox_email_scheduler/
├── backend/
│   ├── api/                   # Serverless deployment entrypoint
│   ├── prisma/
│   │   └── schema.prisma      # PostgreSQL schema models (User, Campaign, Email)
│   ├── src/
│   │   ├── config/            # Env validation, database, and Redis connections
│   │   ├── controllers/       # Auth, Campaign, Email, and CSV Upload controllers
│   │   ├── middleware/        # JWT auth guard, rate limit, and error handlers
│   │   ├── queues/            # BullMQ email queue and job dispatch logic
│   │   ├── routes/            # Express route declarations
│   │   ├── services/          # Business logic (Auth, Campaign, SMTP, RateLimit)
│   │   ├── utils/             # Winston logger, AppError classes, CSV parser
│   │   ├── validators/        # Zod request validation schemas
│   │   ├── workers/           # BullMQ distributed email background worker
│   │   ├── app.ts             # Express app setup and middleware
│   │   └── server.ts          # Server entrypoint with graceful shutdown
│   └── tests/                 # 27 Vitest unit, integration, and load tests
├── frontend/
│   ├── src/
│   │   ├── components/        # UI components (Compose Modal, CSV Uploader, Tables)
│   │   ├── hooks/             # Custom React hooks (useCampaign, useEmails, useAuth)
│   │   ├── pages/             # LoginPage, DashboardPage
│   │   ├── services/          # Axios API clients
│   │   └── utils/             # Date formatters, validation utilities
│   └── vercel.json            # Vercel SPA routing rewrite rules
├── docker-compose.yml         # Local development PostgreSQL and Redis
└── README.md                  # Comprehensive documentation
```

---

## Security Best Practices Implemented

- **No Secrets in Source Control**: All sensitive keys, connection strings, and OAuth credentials are managed via environment variables.
- **HttpOnly Cookies**: Authentication session JWTs are stored in `HttpOnly`, `SameSite`, `Secure` cookies preventing XSS token theft.
- **Input Sanitization & Schema Validation**: Every API payload is validated with strict **Zod** schemas.
- **CORS Protection**: Access is restricted strictly to the configured `FRONTEND_URL` with credentials support.
- **Deduplication Safeguards**: Case-insensitive email recipient deduplication prevents accidental duplicate dispatches.
