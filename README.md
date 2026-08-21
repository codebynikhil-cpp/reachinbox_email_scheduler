# ReachInbox - Full-Stack Email Job Scheduler

A high-performance, fault-tolerant, distributed Email Job Scheduler built for Outbox Labs assignment.

---

## Google OAuth Setup

> **Note for Reviewers**:
> The deployed application uses the application developer's Google OAuth credentials. Reviewers can sign in using their own Google accounts and do not need to create Google OAuth credentials.

To set up real Google OAuth for local development or custom deployments:

1. **Create a Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/).
   - Click **Select a project** $\rightarrow$ **New Project** (e.g. `reachinbox-scheduler`).

2. **Configure OAuth Consent Screen**:
   - Navigate to **APIs & Services** $\rightarrow$ **OAuth consent screen**.
   - Select **User Type**: **External**.
   - Fill in mandatory App Name, User support email, and Developer contact information.
   - Add scopes: `openid`, `.../auth/userinfo.email`, and `.../auth/userinfo.profile`.

3. **Create OAuth 2.0 Web Application Credentials**:
   - Navigate to **APIs & Services** $\rightarrow$ **Credentials**.
   - Click **Create Credentials** $\rightarrow$ **OAuth client ID**.
   - Application type: **Web application**.

4. **Add Authorized Redirect URIs**:
   - **Local Development**:
     ```text
     http://localhost:5000/api/auth/google/callback
     ```
   - **Production**:
     ```text
     https://<your-backend-domain>/api/auth/google/callback
     ```

5. **Configure Backend Environment Variables**:
   Update `backend/.env` with your OAuth Client ID & Secret:
   ```env
   GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
   FRONTEND_URL=http://localhost:3000
   JWT_SECRET=super-secret-jwt-key-minimum-32-characters
   ```

6. **Configure Frontend Environment Variable**:
   In `frontend/.env`:
   ```env
   VITE_API_URL=http://localhost:5000
   ```

7. **Start the Application**:
   ```bash
   # Start backend
   cd backend && npm run dev

   # Start frontend
   cd frontend && npm run dev
   ```

---

## Quick Start & Development

### 1. Start Infrastructure (PostgreSQL & Redis)
```bash
docker-compose up -d
```

### 2. Push Database Schema & Start Backend Server
```bash
cd backend
npm install
npx prisma db push
npm run dev
```

### 3. Start BullMQ Email Worker (in separate terminal)
```bash
cd backend
npm run worker
```

### 4. Start Frontend Web Client
```bash
cd frontend
npm install
npm run dev
```

---

## Running Automated Tests

Run the full suite of 25+ integration & unit tests:
```bash
cd backend
npm test
```

---

## Tech Stack & Key Features

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Backend**: Node.js, Express, TypeScript, Prisma ORM, PostgreSQL
- **Authentication**: Real Google OAuth 2.0 with HTTP-Only Cookie Sessions & JWT
- **Queue & Async Processing**: Redis, BullMQ
- **Email Dispatch**: Nodemailer + Ethereal Email (with instant preview link generation)
- **Key Architectures**:
  - **No Polling / No Cron**: Delayed BullMQ jobs with deterministic IDs (`email:<id>`)
  - **Application Idempotency**: Atomic state transitions (`SCHEDULED` -> `PROCESSING`) prevent duplicate sending.
  - **Distributed Send Slots**: Atomic Redis Lua scripts enforce global minimum delay across multiple worker nodes.
  - **Hourly Quota Control**: Atomic Redis Lua rate-limiting defers excess campaign emails to the next hourly window without dropping jobs or losing progress.
