# ReachInbox Full-Stack Email Job Scheduler - Backend

A high-performance, distributed, fault-tolerant Email Job Scheduler backend built with Node.js, TypeScript, Express, PostgreSQL, Prisma ORM, Redis, BullMQ, and Nodemailer (Ethereal Email).

---

## 1. System Architecture

```
[ Frontend Client (React) ]
        │ (HTTP REST / JWT / HttpOnly Cookie)
        ▼
[ Express.js API Layer ] ────────► [ PostgreSQL / Prisma ORM ]
        │                                  │ (Campaigns, Emails, Users)
        ▼ (Deterministic Job Enqueue: email:<id>)
[ BullMQ Email Queue ] ──────────► [ Redis ]
        ▲
        │ (Multi-worker Pull with Configurable Concurrency)
[ BullMQ Worker(s) ]
        ├── 1. Distributed Hourly Rate Limiter (Atomic Redis Lua Script: email-rate:<sender>:<hour>)
        ├── 2. Idempotent State Transition (SCHEDULED -> PROCESSING)
        ├── 3. Distributed Send-Slot Reservation (Atomic Redis Lua Script: email-send-slot:<sender>)
        └── 4. Nodemailer Dispatch ──► [ Ethereal SMTP / Custom SMTP ]
```

### Component Breakdown
- **API Server (`Express.js`)**: Handles Google OAuth / JWT authentication, campaign scheduling, email log querying, lead CSV parsing, and dashboard statistics.
- **Database (`PostgreSQL + Prisma`)**: Single source of truth for persistent users, campaigns, and individual email records with status lifecycle (`SCHEDULED`, `PROCESSING`, `SENT`, `FAILED`).
- **Distributed Queue (`BullMQ + Redis`)**: Manages delayed job scheduling, exponential backoff retries, and persistence.
- **Worker (`BullMQ Worker`)**: Pulls jobs concurrently according to configured concurrency, reserves atomic send slots, guarantees idempotency, checks hourly quotas, and executes SMTP deliveries.
- **Email Service (`Nodemailer + Ethereal`)**: Dispatches emails and provides zero-config preview URLs for inspection and testing.

---

## 2. Key Design Mechanisms

### 🕒 Scheduling via Delayed BullMQ Jobs (No Polling / No Cron)
- When a campaign is submitted with $N$ recipients, staggered `scheduledAt` timestamps are computed:
  $$\text{scheduledAt}_i = \text{startTime} + (i \times \text{delayMs})$$
- A delayed job is pushed to BullMQ with a calculated delay:
  $$\text{delay} = \max(0, \text{scheduledAt}_i - \text{Date.now}())$$
- **Deterministic Job IDs**: Every job is assigned `jobId: email:<emailId>`. BullMQ deduplicates any redundant enqueue attempts.

### 💾 Persistence & Backend Crash Survival
- All campaigns and email records are committed to **PostgreSQL within an atomic transaction** before jobs are enqueued.
- BullMQ stores jobs in Redis with AOF persistence enabled. If the backend or worker crashes and restarts, Redis retains all delayed jobs and executes them when due.
- **Startup Reconciler**: If a server crash occurs between PostgreSQL commit and Redis enqueueing, the reconciler checks for orphaned `SCHEDULED` emails in PostgreSQL and enqueues them into BullMQ. Because job IDs are deterministic, no duplicate jobs are created.

### 🔒 Application-Level Idempotency
To prevent race conditions across multiple concurrent workers:
```sql
UPDATE emails
SET status = 'PROCESSING', attempts = attempts + 1
WHERE id = :emailId AND status = 'SCHEDULED';
```
- Only the worker whose update affects **exactly 1 row** proceeds to rate limiting and sending.
- If 0 rows are updated, the job is cleanly dropped because another worker already claimed it or the email was already processed.

### ⏱️ Distributed Minimum Send Delay via Redis Send-Slots
- An in-memory `sleep()` inside workers allows concurrent workers to send emails simultaneously.
- To enforce a **strict global minimum delay across any number of workers and instances**, the backend uses an atomic **Redis Send-Slot Reservation Lua script**:
  ```lua
  local now = tonumber(ARGV[1])
  local delayMs = tonumber(ARGV[2])
  local lastSlot = tonumber(redis.call('GET', KEYS[1]) or '0')
  local targetSlot = math.max(now, lastSlot + delayMs)
  redis.call('SET', KEYS[1], tostring(targetSlot), 'EX', tonumber(ARGV[3]))
  return tostring(targetSlot)
  ```
- Workers atomically reserve non-overlapping timestamp slots spaced apart by at least `delayMs`. Even if 5 workers pull jobs at the same millisecond, they are assigned staggered slots ($T_0, T_0+2s, T_0+4s, T_0+6s, T_0+8s$) and execute with perfect spacing.

### 📈 Redis-Backed Atomic Hourly Rate Limiting
- Rates are tracked in Redis using atomic UTC hourly keys scoped by sender (`email-rate:<senderId>:<YYYY-MM-DDTHH>`).
- An **atomic Redis Lua script** checks the quota and increments the counter in a single atomic round-trip:
  ```lua
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
  end
  if current <= tonumber(ARGV[1]) then
    return {1, current}
  else
    return {0, current}
  end
  ```
- **Safe Rescheduling on Limit Exhaustion**:
  - When the limit is reached, the worker calculates the exact milliseconds until the start of the next hour window (`msUntilNextHour`).
  - The email status in PostgreSQL remains `SCHEDULED` with `scheduledAt` adjusted to the start of the next window.
  - The BullMQ job is rescheduled for the next hour window (`addEmailJob(emailId, nextWindowDate)`).
  - **No jobs are dropped or lost, no retry attempts are wasted, and workers do not spin in CPU-intensive retry loops.**

---

## 3. Scaling: The 1000+ Email Scenario

Suppose a campaign has **1,000 recipients** with `MAX_EMAILS_PER_HOUR = 100` and `delayMs = 2000`:
1. **Hour 1**: First 100 emails are sent with 2-second spacing (~200 seconds).
2. **Hour 1 (limit reached)**: Email #101 arrives at the worker. The atomic Lua script detects `current (101) > maxLimit (100)` and returns `allowed = 0` with the remaining time until Hour 2.
3. **Rescheduling**: Email #101 is rescheduled to the beginning of Hour 2. Subsequent jobs in the queue that fire in Hour 1 also detect the quota exhaustion and are cleanly deferred to Hour 2.
4. **Hour 2 through Hour 10**: 100 emails are dispatched each hour.
5. **Result**: 1,000 emails are distributed smoothly across 10 hourly windows without dropped jobs, duplicate sends, or memory leaks.

---

## 4. Failure Recovery & Reliability Matrix

| Scenario | Behavior | Recovery Mechanism |
| :--- | :--- | :--- |
| **Server crash during enqueue** | PostgreSQL has `SCHEDULED` emails; BullMQ was not enqueued | Startup reconciler in `server.ts` queries orphaned `SCHEDULED` emails and enqueues them with deterministic IDs. |
| **Worker crash during SMTP send** | DB email remains `PROCESSING` | BullMQ lock expires; job is re-delivered. Idempotency checks prevent duplicate sends if `SENT` was committed. |
| **Redis restart / crash** | Queue state preserved via Redis AOF persistence | On restart, BullMQ re-reads delayed jobs; delayed timers resume based on epoch timestamps. |
| **SMTP temporary failure (5xx/network)** | SMTP call throws error | Worker reverts email to `SCHEDULED`, logs attempt, and re-throws for BullMQ exponential backoff retry. |
| **Max retry attempts reached** | Retries exhausted (e.g. 5 attempts) | Worker marks email status as `FAILED` with detailed error in DB. |
| **Hourly quota exhausted** | Counter exceeds `hourlyLimit` | Job rescheduled for the start of the next UTC hour window without consuming retry attempts. |

---

## 5. Setup & Running Instructions

### Prerequisites
- Node.js (v18+)
- Docker & Docker Compose (or local PostgreSQL and Redis)

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default `.env` configuration:
```ini
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
JWT_SECRET=super-secret-jwt-key-change-this-in-production

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/email_scheduler?schema=public"
REDIS_URL="redis://localhost:6379"

# Google OAuth (Optional: Leave empty for mock or provide Google Cloud Console credentials)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# SMTP (Leave empty for automatic Ethereal test account generation)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="ReachInbox Scheduler <noreply@reachinbox.ai>"

WORKER_CONCURRENCY=5
MIN_EMAIL_DELAY_MS=2000
MAX_EMAILS_PER_HOUR=100
```

### 3. Start PostgreSQL and Redis via Docker
```bash
docker-compose up -d
```

### 4. Run Prisma Database Push
```bash
npx prisma db push
```

### 5. Start the API Server
```bash
npm run dev
```

### 6. Start the BullMQ Worker (In a separate terminal)
```bash
npm run worker
```

---

## 6. API Endpoints

### 🩺 Health
- `GET /api/health`: Health status check (`{ "status": "ok" }`).

### 🔐 Authentication (Google OAuth & JWT)
- `GET /api/auth/google`: Initiates Google OAuth redirect.
- `GET /api/auth/google/url`: Returns Google OAuth URL as JSON.
- `GET /api/auth/google/callback`: OAuth callback, upserts user, sets session cookie and redirects.
- `GET /api/auth/me`: Returns profile of the authenticated user.
- `POST /api/auth/logout`: Clears authentication session cookie.

### 📨 Campaigns & Scheduling
- `POST /api/campaigns`: Schedule a new email campaign.
  ```json
  {
    "subject": "Product Announcement",
    "body": "Hi there,\nCheck out our latest release!",
    "recipients": ["alice@example.com", "bob@example.com"],
    "startTime": "2026-08-20T10:00:00.000Z",
    "delayMs": 2000,
    "hourlyLimit": 100
  }
  ```

### 📋 Email Logs & Stats
- `GET /api/emails/scheduled?page=1&limit=20`: List scheduled emails for authenticated user.
- `GET /api/emails/sent?page=1&limit=20`: List sent/failed emails with message IDs and error messages.
- `GET /api/emails/stats`: Aggregated status counts (scheduled, processing, sent, failed).

### 📁 Lead Upload (CSV)
- `POST /api/uploads/leads` (or `/api/upload/csv`): Upload CSV/Text lead file (`multipart/form-data` with field `file`).
  Returns:
  ```json
  {
    "totalRows": 100,
    "validEmails": 95,
    "duplicates": 3,
    "uniqueEmails": 92,
    "emails": ["user1@example.com", "user2@example.com"]
  }
  ```

---

## 7. Running Tests

Run the complete automated test suite:
```bash
npm test
```
To run tests in watch mode:
```bash
npm run test:watch
```

---

## 8. Trade-Offs & Distributed Systems Guarantees

### ⚠️ SMTP Exactly-Once Delivery Window
- While the scheduler implements strict **application-level idempotency** before sending:
  1. Worker atomically transitions status `SCHEDULED` $\rightarrow$ `PROCESSING`.
  2. Worker reserves a non-colliding send slot.
  3. Worker sends the email to SMTP server (SMTP server accepts the message).
  4. If the worker process or node experiences a catastrophic hardware failure *after* SMTP acceptance but *before* the database status update (`SENT`) completes:
     - On restart, BullMQ might retry the unacknowledged job or consider it failed.
- **Distributed Reality**:
  - Standard SMTP protocols lack two-phase commit (2PC) transactions with application databases. Therefore, true mathematical "exactly-once" delivery over external SMTP cannot be 100% guaranteed across independent distributed networks.
  - This architecture achieves **at-least-once delivery with minimized duplicate windows**, deterministic job IDs (`email:<emailId>`), conditional database state transitions, and unique message IDs.
