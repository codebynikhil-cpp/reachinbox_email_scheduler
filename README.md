# ReachInbox - Distributed Email Job Scheduler

[![Frontend](https://img.shields.io/badge/Frontend-Vercel-000000?style=flat&logo=vercel)](https://reachinbox-email-scheduler-orcin.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-Render-46E3B7?style=flat&logo=render)](https://reachinbox-email-scheduler-g01t.onrender.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![BullMQ](https://img.shields.io/badge/BullMQ-Redis_Queue-DC382D?style=flat&logo=redis)](https://bullmq.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon_Cloud-4169E1?style=flat&logo=postgresql)](https://neon.tech/)

A production-grade, distributed, fault-tolerant email scheduling and dispatch platform designed and built for the ReachInbox / Outbox Labs engineering assignment. The system handles cold outreach email campaigns with precise time delays, distributed hourly rate limiting, inter-email concurrency control, and full crash recovery without relying on periodic polling or cron scanners.

---

## Live Deployments

- Application Frontend: [https://reachinbox-email-scheduler-orcin.vercel.app](https://reachinbox-email-scheduler-orcin.vercel.app)
- Backend REST API: [https://reachinbox-email-scheduler-g01t.onrender.com](https://reachinbox-email-scheduler-g01t.onrender.com)
- API Health Check: [https://reachinbox-email-scheduler-g01t.onrender.com/api/health](https://reachinbox-email-scheduler-g01t.onrender.com/api/health)
- BullMQ Live Queue Monitor: [https://reachinbox-email-scheduler-g01t.onrender.com/admin/queues](https://reachinbox-email-scheduler-g01t.onrender.com/admin/queues)

> Note for Reviewers:
> The deployed application is configured with Google OAuth 2.0 in production mode. Reviewers can sign in directly using any personal or corporate Google account.

---

## System Architecture

```text
                             +-----------------------------------+
                             |       React 19 Frontend           |
                             |      (Deployed on Vercel)         |
                             +-----------------+-----------------+
                                               |
                                               | HTTPS + JWT HttpOnly Cookie
                                               v
                             +-----------------------------------+
                             |     Node.js + Express API         |
                             |      (Deployed on Render)         |
                             +--------+-----------------+--------+
                                      |                 |
             Prisma Transaction Write |                 | Bulk Delayed Job Enqueue
                                      v                 v
                   +----------------------+         +----------------------+
                   | PostgreSQL (Neon DB) |         |    Redis (Upstash)   |
                   |  Users, Campaigns,   |         | BullMQ Delayed Queue |
                   |     Email Logs       |         +----------+-----------+
                   +----------------------+                    |
                                                               | Pull Delayed Job
                                                               v
                                                    +----------------------+
                                                    | BullMQ Email Worker  |
                                                    | (Concurrent Daemon)  |
                                                    +----------+-----------+
                                                               |
                             +---------------------------------+---------------------------------+
                             |                                 |                                 |
                             v                                 v                                 v
                 +-----------------------+         +-----------------------+         +-----------------------+
                 | Atomic State Claim    |         | Distributed Rate Lmt  |         | Inter-Email Delay     |
                 | (SCHEDULED->PROCESS)  |         | (Atomic Redis Lua)    |         | (Slot Reservation)    |
                 +-----------+-----------+         +-----------+-----------+         +-----------+-----------+
                             |                                 |                                 |
                             +---------------------------------+---------------------------------+
                                                               |
                                                               v
                                                    +----------------------+
                                                    | Nodemailer Transport |
                                                    | (Ethereal/Custom)    |
                                                    +----------+-----------+
                                                               |
                                            +------------------+------------------+
                                            |                                     |
                                            v                                     v
                                +-----------------------+             +-----------------------+
                                |  Elasticsearch Index  |             | Slack Webhook Alert   |
                                |  (Full-Text Search)   |             | (Hourly Quota Alert)  |
                                +-----------------------+             +-----------------------+
```

---

## Core Engineering Principles

### 1. No Polling and No Cron Scanners
Traditional email schedulers rely on periodic `setInterval` calls or cron tasks that query a database with `SELECT * FROM emails WHERE scheduled_at <= NOW() AND status = 'SCHEDULED'`. This creates severe bottlenecks:
- Database connection pool exhaustion under heavy volumes.
- Uneven traffic spikes and race conditions between concurrent backend processes.
- Clock drift and scheduling inaccuracies of up to several seconds or minutes.

ReachInbox eliminates polling entirely:
- When a campaign is scheduled, each recipient is mapped to an exact target timestamp.
- Jobs are submitted to **BullMQ** as timestamp-delayed jobs backed by Redis Sorted Sets (`ZSET`).
- Redis internally maintains an ordered collection of job timestamps. BullMQ workers awaken with millisecond precision ($O(\log N)$ extraction time) only when a job is due.

### 2. Distributed Hourly Rate Limiting via Atomic Redis Lua Scripts
To prevent email deliverability penalties and respect SMTP quotas across multiple distributed server or worker instances:
- Every sender's hourly volume is tracked in Redis keys formatted as `email-rate:<senderId>:<YYYY-MM-DD-HH>`.
- The evaluation and counter increment occur atomically via a custom Redis Lua script. This prevents race conditions where parallel workers check a counter simultaneously.
- When a user's hourly quota is reached:
  1. The worker calculates the exact millisecond duration remaining until the top of the next hour:
     `msUntilNextHour = (nextHourTimestamp - now)`
  2. The email is rescheduled in BullMQ with a delay equal to `msUntilNextHour`.
  3. The email state in PostgreSQL remains intact (`SCHEDULED`), ensuring zero data loss.
  4. An asynchronous alert is dispatched to Slack notifying administrators of the threshold event.

### 3. Distributed Inter-Email Spacing (Slot Reservation)
Even when hourly volume is within limits, sending cold emails in concurrent bursts triggers spam filters. The system enforces a configurable minimum gap between consecutive emails from the same sender (default: 2000 milliseconds):
- Workers use an atomic Redis Lua script to query and update an `email-send-slot:<senderId>` timestamp.
- The script returns the exact millisecond reservation slot when this sender is allowed to transmit.
- If the reservation falls in the future, the worker delays execution for the exact delta before initiating the SMTP handshake.
- This guarantees that even across 10 concurrent worker processes, emails from a single sender are spaced smoothly along the timeline.

### 4. Idempotent State Transitions
To guarantee that no email is ever dispatched twice in distributed or retry environments:
- Before executing rate limits or network requests, the worker executes a conditional SQL update:
  ```sql
  UPDATE "Email"
  SET "status" = 'PROCESSING',
      "attempts" = "attempts" + 1,
      "updatedAt" = NOW()
  WHERE "id" = :emailId AND "status" = 'SCHEDULED';
  ```
- If this query affects 0 rows (because another worker claimed the job, or the job was already completed), the worker drops the task immediately without side effects.
- BullMQ jobs use deterministic identifiers: `email-<emailId>`. Re-enqueueing the same email will never create a duplicate job in the Redis queue.

### 5. Persistence and Crash Recovery
- **Database Transaction Pre-Commit**: Campaigns and recipient emails are persisted in PostgreSQL inside an atomic Prisma transaction before any jobs are added to Redis.
- **Queue Persistence**: Redis holds all BullMQ delayed jobs with append-only file (AOF) persistence. If the backend process is killed or restarted, jobs remain in the queue and resume dispatch upon worker reconnection.
- **Startup Reconciliation**: On boot, the backend runs a reconciliation scan to detect any records marked `SCHEDULED` in PostgreSQL that are missing from Redis (for instance, if power failed between the DB commit and Redis call). Missing jobs are reinjected into BullMQ with deterministic IDs.

---

## Detailed Execution Workflow

```text
[User Action] Upload CSV & Configure Campaign
       |
       v
[API Gateway] Validate Payload with Zod Schema
       |
       +---> [CSV Parser Service]
       |        - Strip malformed rows
       |        - Case-insensitive email normalization
       |        - In-memory Set deduplication
       |
       v
[Database Layer] Prisma Transaction
       |        - Create Campaign record
       |        - Bulk insert N Email records with status 'SCHEDULED'
       |
       v
[BullMQ Service] Bulk Delayed Enqueue
       |        - Calculate scheduledAt_i = startTime + (i * delayMs)
       |        - Enqueue to Redis with deterministic ID: email-<emailId>
       |
       v
======================= BACKGROUND ASYNCHRONOUS PROCESSING =======================
       v
[BullMQ Worker] Pulls Job at Scheduled Millisecond
       |
       +---> Step 1: Idempotency Claim (DB: SCHEDULED -> PROCESSING)
       |             If 0 rows updated, terminate job cleanly.
       |
       +---> Step 2: Check Hourly Rate Limit (Redis Lua Script)
       |             If limit exceeded:
       |               - Calculate delayMs = (NextHour - Now)
       |               - Re-enqueue to BullMQ with delayMs
       |               - Update DB status back to SCHEDULED
       |               - Fire Slack Webhook alert
       |               - Exit step
       |
       +---> Step 3: Inter-Email Delay Slot Lock (Redis Lua Script)
       |             If send-slot in future, worker sleeps for delta
       |
       +---> Step 4: Nodemailer SMTP Dispatch
       |             Deliver message to Ethereal / Custom SMTP server
       |
       +---> Step 5: Post-Send Synchronization
                     - Update DB record: status = 'SENT', sentAt = NOW()
                     - Capture Ethereal live preview URL
                     - Index email record in Elasticsearch (fallback to DB on failure)
                     - Complete BullMQ job
```

---

## Email State Machine

| Current State | Trigger Event | Next State | Description |
|:---|:---|:---|:---|
| `SCHEDULED` | Worker claims job via conditional SQL | `PROCESSING` | Exclusive execution lock acquired by single worker. |
| `PROCESSING` | SMTP handshake and transmission successful | `SENT` | Terminal state. Delivery timestamp and message ID saved. |
| `PROCESSING` | Hourly sender rate limit exhausted | `SCHEDULED` | Rescheduled for the start of the next hour window. |
| `PROCESSING` | Network timeout or temporary SMTP failure | `PROCESSING` | BullMQ retries with exponential backoff. |
| `PROCESSING` | Max retry attempts (3) exhausted | `FAILED` | Terminal state. Error message recorded in database. |

---

## Technology Stack

| Layer | Component | Technology | Role |
|:---|:---|:---|:---|
| Frontend | Framework | React 19 + TypeScript | Single-page application |
| Frontend | Build Tool | Vite | Fast module bundling and development server |
| Frontend | Styling | Tailwind CSS | Consistent design tokens, responsive layout, dark theme |
| Frontend | HTTP Client | Axios | Cookie-authenticated API communication |
| Backend | Runtime | Node.js 20+ | Server execution environment |
| Backend | Web Framework | Express.js + TypeScript | REST API routing and middleware pipeline |
| Backend | ORM | Prisma ORM 5.x | Type-safe PostgreSQL queries and migrations |
| Backend | Queue Engine | BullMQ 5.x | Distributed delayed job scheduling and retries |
| Backend | Caching / Queue | Redis (Upstash / Local) | Sorted-set timer queues and atomic Lua rate limiting |
| Backend | Database | PostgreSQL (Neon / Local) | Primary persistent data store |
| Backend | Search Engine | Elasticsearch 8.x | Full-text query and filtering with database fallback |
| Backend | Mail Dispatch | Nodemailer | SMTP client with Ethereal email preview generation |
| Backend | Authentication | Google Auth Library + JWT | OAuth 2.0 verification and HttpOnly session cookies |
| Backend | Alerting | Slack Incoming Webhooks | Real-time threshold violation alerting |
| Testing | Test Runner | Vitest + Supertest | 27 automated unit, integration, and load tests |

---

## Repository Structure

```text
reachinbox_email_scheduler/
├── backend/
│   ├── api/                       # Serverless deployment entrypoint
│   ├── prisma/
│   │   ├── schema.prisma          # PostgreSQL schema models
│   │   └── migrations/            # Migration history
│   ├── src/
│   │   ├── config/                # Environment, database, and Redis configuration
│   │   ├── controllers/           # Auth, Campaign, Email, and Upload handlers
│   │   ├── middleware/            # Auth guard, error handling, rate limiters
│   │   ├── queues/                # BullMQ queue definitions and job enqueueing
│   │   ├── routes/                # Express router declarations
│   │   ├── services/              # Auth, Campaign, CSV, SMTP, Search services
│   │   ├── utils/                 # Logger, AppError definitions, CSV utilities
│   │   ├── validators/            # Zod request validation schemas
│   │   ├── workers/               # BullMQ distributed background worker
│   │   ├── app.ts                 # Express application configuration
│   │   └── server.ts              # Process entrypoint with graceful shutdown
│   ├── tests/                     # Automated unit and integration test suite
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── public/                    # Static assets and sample test files
│   ├── src/
│   │   ├── components/            # UI components (Dashboard, Compose, Tables)
│   │   ├── hooks/                 # Custom React hooks (useAuth, useCampaigns)
│   │   ├── pages/                 # LoginPage, DashboardPage
│   │   ├── services/              # API clients for backend communication
│   │   ├── types/                 # Shared TypeScript interfaces
│   │   ├── App.tsx                # Route definitions and session providers
│   │   └── main.tsx               # DOM mounting entrypoint
│   ├── package.json
│   ├── vercel.json                # SPA rewrite rules for production
│   └── vite.config.ts
├── docker-compose.yml             # Local PostgreSQL, Redis, Elasticsearch containers
├── sample_leads.csv               # 15-contact sample lead list for campaign testing
├── sample_5_leads.csv             # 5-contact lightweight sample lead list
└── README.md                      # Comprehensive project documentation
```

---

## REST API Reference

### Authentication

| Method | Path | Description | Protected |
|:---|:---|:---|:---|
| `GET` | `/api/auth/google` | Initiates Google OAuth 2.0 authorization redirect | No |
| `GET` | `/api/auth/google/callback` | OAuth 2.0 callback, sets HttpOnly session cookie | No |
| `GET` | `/api/auth/me` | Returns profile of currently authenticated user | Yes |
| `POST` | `/api/auth/logout` | Clears authentication cookie and terminates session | Yes |

### Campaigns

| Method | Path | Description | Protected |
|:---|:---|:---|:---|
| `POST` | `/api/campaigns` | Validates payload, saves to DB, enqueues BullMQ jobs | Yes |
| `GET` | `/api/campaigns` | Lists all campaigns created by authenticated user | Yes |
| `GET` | `/api/campaigns/:id` | Returns single campaign detail with aggregate stats | Yes |

### Emails and Logs

| Method | Path | Description | Protected |
|:---|:---|:---|:---|
| `GET` | `/api/emails` | Paginated query of emails (supports status, search filters) | Yes |
| `GET` | `/api/emails/:id` | Returns specific email record with delivery logs | Yes |

### Uploads

| Method | Path | Description | Protected |
|:---|:---|:---|:---|
| `POST` | `/api/upload/csv` | Validates and parses uploaded CSV/TXT lead file | Yes |

### Analytics and System

| Method | Path | Description | Protected |
|:---|:---|:---|:---|
| `GET` | `/api/analytics/dashboard` | Returns total, scheduled, sent, and failed counters | Yes |
| `GET` | `/api/health` | Health check endpoint returning status of DB and Redis | No |
| `GET` | `/admin/queues` | Bull Board UI for queue monitoring and inspection | Admin |

---

## Environment Configuration

### Backend Variables (`backend/.env`)

```env
# Server
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://reachinbox-email-scheduler-orcin.vercel.app

# Database & Cache
DATABASE_URL=postgresql://user:password@ep-sample.region.neon.tech/dbname?sslmode=require
REDIS_URL=rediss://default:password@sample-redis.upstash.io:6379

# Authentication
JWT_SECRET=replace-with-a-secure-random-32-character-secret
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=https://reachinbox-email-scheduler-g01t.onrender.com/api/auth/google/callback

# Elasticsearch (Optional: falls back to PostgreSQL if unavailable)
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_INDEX=emails

# Slack Alerting
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX

# Worker & Rate Limiting Controls
WORKER_CONCURRENCY=5
MIN_EMAIL_DELAY_MS=2000
MAX_EMAILS_PER_HOUR=100

# SMTP Configuration (Port 465 recommended for Render production)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
SMTP_FROM="ReachInbox Scheduler <noreply@reachinbox.ai>"
```

### Frontend Variables (`frontend/.env`)

```env
VITE_API_BASE_URL=https://reachinbox-email-scheduler-g01t.onrender.com
```

---

## Local Development Quickstart

### Prerequisites
- Node.js version 20.x or higher
- Docker and Docker Compose (for local database containers)

### 1. Clone the Repository
```bash
git clone https://github.com/codebynikhil-cpp/reachinbox_email_scheduler.git
cd reachinbox_email_scheduler
```

### 2. Start Local Infrastructure via Docker
```bash
docker-compose up -d
```
This initializes:
- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`
- Elasticsearch on `localhost:9200`

### 3. Initialize and Start Backend
```bash
cd backend
npm install
npx prisma db push
npm run dev
```
The API server starts on `http://localhost:5000`.

### 4. Initialize and Start Frontend
In a separate terminal window:
```bash
cd frontend
npm install
npm run dev
```
The application opens on `http://localhost:3000`.

### 5. Test Campaign Dispatch
1. Open `http://localhost:3000` and sign in.
2. Click **Compose Campaign**.
3. Upload `sample_leads.csv` or `sample_5_leads.csv` from the project root.
4. Set the subject, body template, and inter-email delay.
5. Submit the campaign. Real-time delivery logs, countdown timers, and preview links will populate the dashboard.

---

## Automated Test Suite

The repository contains 27 automated test cases covering API routes, security guards, queue behaviors, distributed rate limits, and load conditions.

### Test Categories
1. **Health and Diagnostics**: Validates database and Redis connectivity responses.
2. **Authentication Guards**: Ensures unauthenticated requests to protected endpoints return HTTP 401.
3. **CSV Validation and Normalization**: Tests parsing of irregular whitespace, duplicate removal, header detection, and malformed email rejection.
4. **Distributed Rate Limiter**: Tests Redis Lua script execution, counter increment precision, and threshold deferral calculations.
5. **Deterministic Scheduling**: Confirms BullMQ deduplication with identical job keys.
6. **Concurrent Load Simulation**: Dispatches 100 simultaneous simulated emails across concurrent worker slots to verify zero duplicate delivery.

### Running Tests
```bash
cd backend
npm test
```

For coverage report generation:
```bash
npm run test:coverage
```

---

## Production Deployment Specifications

### Render Backend Configuration
- **Environment**: Node.js
- **Build Command**: `npm install && npx prisma generate && npm run build`
- **Start Command**: `npm run start`
- **Health Check Path**: `/api/health`
- **SMTP Port**: Set `SMTP_PORT=465` to utilize SSL and bypass outbound port 587 firewalls on shared cloud instances.

### Vercel Frontend Configuration
- **Framework Preset**: Vite
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Rewrites**: `vercel.json` routes all non-asset requests to `index.html` to support client-side routing.

---

## Security Practices

- **Cookie-Based JWT Storage**: Tokens are delivered in `HttpOnly`, `SameSite=None`, `Secure` cookies, safeguarding against Cross-Site Scripting (XSS) extraction.
- **Strict Input Validation**: Every request body and query string is verified against strict Zod schemas before hitting business logic.
- **CORS Allowlist**: Access is restricted to the explicitly defined `FRONTEND_URL` with credentials allowed.
- **Credential Hygiene**: No API keys, passwords, or OAuth tokens are committed to source control.
- **Recipient Deduplication**: Case-insensitive email normalization prevents unintentional duplicate messaging to outreach leads.
