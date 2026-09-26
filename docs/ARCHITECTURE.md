# Amigo — System Architecture

## 1. High-Level Overview

Amigo is a client-server application with a strict separation between:

- **Presentation layer** (React/TypeScript/Vite)
- **Application layer** (FastAPI/Python)
- **Domain layer** (Scheduling engine, Personalization engine, Analytics)
- **Persistence layer** (PostgreSQL)
- **ML layer** (Scikit-learn, Pandas — runs inside the application layer)

The frontend never talks directly to the database. Every mutation flows through authenticated, authorized API endpoints.

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  React UI    │  │  Local Cache │  │  IndexedDB       │  │
│  │  (Views)     │──│  (React ctx) │──│  (offline mirror)│  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS + JWT
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    API GATEWAY                              │
│  Rate limiting · CORS · CSP headers · Request validation    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 APPLICATION LAYER (FastAPI)                 │
│                                                             │
│  ┌────────────┐ ┌────────────┐ ┌──────────┐ ┌───────────┐ │
│  │ Auth       │ │ Scheduler  │ │ Personali│ │ Analytics │ │
│  │ Service    │ │ Engine     │ │ zation   │ │ Service   │ │
│  │            │ │            │ │ Engine   │ │           │ │
│  └────────────┘ └────────────┘ └──────────┘ └───────────┘ │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐│
│  │              Domain Models (Pydantic)                  ││
│  │   Strict schema validation on every input/output       ││
│  └────────────────────────────────────────────────────────┘│
└──────────────────────────┬──────────────────────────────────┘
                           │ SQLAlchemy ORM
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  PostgreSQL                                 │
│  Users · Tasks · Schedules · Executions · BehaviorEvents    │
│  Insights · Adaptations · WeeklyReviews                     │
└─────────────────────────────────────────────────────────────┘
```

## 2. Security Model

### 2.1 Authentication
- **Method**: JWT (access + refresh tokens)
- **Access token**: short-lived (15 min), stored in memory only
- **Refresh token**: longer-lived (7 days), stored in HttpOnly Secure SameSite=Strict cookie
- **Password hashing**: Argon2id (via `passlib`)
- **Session revocation**: token blacklist in Redis (or DB table)

### 2.2 Authorization
- Every endpoint requires a valid JWT
- Every query/mutation includes `WHERE user_id = :current_user_id`
- **Row-level security is NOT trusted alone** — application-level checks are mandatory
- No IDOR vulnerabilities: a user cannot access resources by guessing another user's UUID

### 2.3 Input Validation
- All inputs validated by Pydantic models before reaching business logic
- SQL injection prevented via SQLAlchemy ORM (parameterized queries)
- XSS prevented via React's default escaping + CSP headers
- CSRF prevented via SameSite cookies + CSRF token for state-changing requests

### 2.4 LLM/NL Input Handling
Natural language input is treated as **untrusted input**:

```
User text
    ↓
LLM (external API, no DB access)
    ↓
Structured JSON output
    ↓
Pydantic schema validation (strict)
    ↓
Business rule validation (times valid, durations sane, no conflicts)
    ↓
Authorization check (user owns the resources)
    ↓
Database write
```

The LLM never writes to the database. It only produces structured data that is validated at every step.

## 3. Data Flow — Scheduling

```
┌────────────────┐
│ User input     │ (preferences, tasks, commitments)
└───────┬────────┘
        ▼
┌────────────────┐
│ Scheduler      │ ← Hard constraints (fixed times, sleep, no overlaps)
│ Engine         │ ← Soft constraints (preferences, historical patterns)
└───────┬────────┘
        ▼
┌────────────────┐
│ Conflict       │ If impossible → return conflicts + suggestions
│ Detector       │ NEVER silently compress
└───────┬────────┘
        ▼
┌────────────────┐
│ Schedule       │ Saved to DB as ScheduleItem rows
│ Persistence    │
└───────┬────────┘
        ▼
┌────────────────┐
│ User executes  │ Marks tasks complete/skip/postpone
└───────┬────────┘
        ▼
┌────────────────┐
│ Behavior       │ TaskExecution + BehaviorEvent rows
│ Recorder       │
└───────┬────────┘
        ▼
┌────────────────┐
│ Personalization│ Analyzes patterns, generates Insights + Adaptations
│ Engine         │
└───────┬────────┘
        ▼
┌────────────────┐
│ Next schedule  │ Uses adjusted durations + time preferences
│ generation     │
└────────────────┘
```

## 4. Cold Start Strategy

The system tracks its own confidence level:

| Data Points | Level      | Behavior                                              |
|-------------|------------|-------------------------------------------------------|
| 0–4         | Cold start | Pure rule-based scheduling. No ML.                    |
| 5–14        | Early      | Duration stats per task (median). Simple heuristics.  |
| 15–39       | Developing | Time-of-day preferences. Day-of-week patterns.        |
| 40+         | Mature     | Full personalization. Category-specific patterns.     |

The UI **always shows the current data level** so the user knows what's real vs. estimated.

## 5. Frontend Data Layer

The frontend uses a **repository pattern** so it can swap between:
- **IndexedDB** (current, offline-first, single-user)
- **HTTP API client** (when backend is deployed)

```typescript
// src/data/repositories.ts
interface TaskRepository {
  list(userId: string): Promise<Task[]>;
  create(task: NewTask): Promise<Task>;
  update(task: Task): Promise<void>;
  delete(id: string): Promise<void>;
}

// Two implementations:
// - IndexedDBTaskRepository (current)
// - HttpTaskRepository (future, talks to FastAPI)
```

This means the UI code doesn't change when we add the backend.

## 6. File Structure (Target)

```
amigo/
├── backend/                       # Phase 2+
│   ├── app/
│   │   ├── main.py               # FastAPI app
│   │   ├── config.py             # Settings, env vars
│   │   ├── security.py           # Auth, JWT, hashing
│   │   ├── database.py           # SQLAlchemy engine + session
│   │   ├── models/               # SQLAlchemy ORM models
│   │   ├── schemas/              # Pydantic request/response schemas
│   │   ├── api/                  # Route handlers
│   │   │   ├── auth.py
│   │   │   ├── tasks.py
│   │   │   ├── schedule.py
│   │   │   ├── analytics.py
│   │   │   └── preferences.py
│   │   ├── services/             # Business logic
│   │   │   ├── scheduler.py
│   │   │   ├── personalization.py
│   │   │   ├── analytics.py
│   │   │   └── nl_parser.py
│   │   └── ml/                   # ML models
│   │       ├── duration.py
│   │       ├── completion.py
│   │       └── patterns.py
│   ├── migrations/               # Alembic migrations
│   ├── tests/
│   └── requirements.txt
│
├── frontend/                      # Current focus
│   ├── src/
│   │   ├── components/
│   │   ├── engine/               # Scheduling + personalization (TS port)
│   │   ├── data/                 # Repository pattern
│   │   ├── store/                # React context
│   │   ├── types/
│   │   └── App.tsx
│   └── ...
│
└── docs/
    ├── ARCHITECTURE.md           # This file
    └── DATABASE_SCHEMA.sql       # Phase 1 deliverable
```

## 7. Deployment Target

- **Frontend**: Static hosting (Vercel/Netlify/Cloudflare Pages)
- **Backend**: Containerized (Docker) on a VPS or managed platform
- **Database**: Managed PostgreSQL (Supabase, Neon, Railway, or self-hosted)
- **HTTPS**: Mandatory, enforced at the edge
- **Backups**: Daily automated PostgreSQL backups

## 8. What Phase 1 Delivers

✅ System architecture (this document)
✅ Database schema (PostgreSQL, normalized, indexed)
✅ Frontend data layer with repository pattern
✅ Type definitions aligned with the DB schema
✅ Scheduling engine (constraint-aware, in TypeScript)
✅ Personalization engine (statistical, in TypeScript)
✅ Natural language parser (rule-based, in TypeScript)
✅ Complete UI with all screens functional
✅ IndexedDB persistence for offline-first operation

## 9. What Phase 2 Will Add

- FastAPI backend
- JWT authentication
- SQLAlchemy models matching the schema
- API endpoints for every repository method
- Migration scripts (Alembic)
- Swap frontend from IndexedDB to HTTP client
- Real password hashing, rate limiting, security headers

## 10. Design Principles (Non-Negotiable)

1. **No silent failures.** Every error surfaces to the user with an actionable message.
2. **No fake data.** If we don't have data, we say "Not enough data yet."
3. **No impossible schedules.** Conflicts are reported, not hidden.
4. **User owns their data.** Export, delete, and disable personalization are always available.
5. **LLM output is untrusted.** Validated at every layer before touching the DB.
6. **Auth is server-side.** The frontend never authorizes anything.
7. **Beauty through purpose.** No decorative gradients, glows, or glass. Every pixel communicates information or enables action.
