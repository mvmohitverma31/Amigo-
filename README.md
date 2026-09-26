# Amigo — Adaptive Personal Scheduler

An intelligent scheduling system that learns from your behavior and continuously adapts future schedules around your real patterns.

## 🎯 What Makes Amigo Different

Most schedulers are static — you input tasks, they fill slots. Amigo is **adaptive**:

- **Tracks your actual behavior** (completion times, delays, skip patterns)
- **Identifies patterns** (you complete study better in evenings, you underestimate project work by 30min)
- **Adjusts future schedules** based on what it learns
- **Never silently fails** — conflicts are reported, not hidden
- **Cold start aware** — doesn't pretend to have learned from 3 data points

## 📦 What's Included

### Phase 1 (Complete)
✅ **Full frontend application** (React/TypeScript/Vite/Tailwind)
✅ **Constraint-aware scheduling engine** (hard + soft constraints)
✅ **Personalization engine** (statistical pattern detection)
✅ **Analytics engine** (completion rates, trends, breakdowns)
✅ **Natural language parser** (describe your day in plain English)
✅ **Complete UI** (8 screens, all functional)
✅ **IndexedDB persistence** (offline-first, single-user)
✅ **Architecture documentation** (system design, security model)
✅ **Database schema** (PostgreSQL, normalized, indexed)
✅ **API contract** (TypeScript interfaces for backend integration)
✅ **Repository pattern** (swap IndexedDB ↔ HTTP without changing UI)

### Phase 2 (Next)
⏳ FastAPI backend
⏳ PostgreSQL database
⏳ JWT authentication
⏳ API endpoints
⏳ Multi-user support

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

Open `http://localhost:5173` in your browser.

## 📖 Usage Guide

### First Time Setup

1. **Onboarding** (7 steps)
   - Choose natural language or manual input
   - Describe your schedule: "I wake up at 7, have college from 9 to 12, want to go to the gym for 1.5 hours in the evening, study DSA for 2 hours..."
   - Review parsed data (Amigo shows what it understood, asks for confirmation)
   - Set preferences (wake/sleep times, break duration, etc.)

2. **Add Tasks**
   - Go to **Tasks** page
   - Click **+ Add Task** or use **Natural Input**
   - Set duration, priority, preferred time, deadline
   - Organize with categories

3. **Generate Schedule**
   - Go to **Calendar** page
   - Click **Generate Schedule**
   - Amigo creates a realistic daily plan respecting your constraints

4. **Track Execution**
   - Go to **Dashboard**
   - See current activity, next up, day timeline
   - Mark tasks complete/skip/postpone
   - Optionally provide reasons (helps personalization)

5. **See Insights**
   - Go to **Adaptation** page
   - See what Amigo learned: "Your DSA sessions average 94 minutes instead of 120"
   - Review suggested changes: "Move DSA to evening (your best time window)"
   - Apply or dismiss suggestions

6. **Weekly Review**
   - Go to **Review** page
   - See completion rates, category performance, best/worst time windows
   - Understand what worked and what didn't

### Key Features

**Dashboard**
- Current activity with progress bar
- Next upcoming task
- Day timeline with quick actions
- Key metrics (progress, completed, remaining, streak)
- Upcoming deadlines

**Calendar**
- Day view (hourly timeline)
- Week view (7-day grid)
- Schedule generation with conflict detection
- Visual indicators for fixed/locked/completed tasks

**Tasks**
- Full CRUD operations
- Categories with colors
- Natural language input
- Priority, duration, deadline, preferred time
- Recurring tasks

**Analytics**
- Completion rate, average delay, duration accuracy
- Productivity by hour (bar chart)
- Weekly trend (line chart)
- Day-of-week performance
- Time window scores
- Category breakdowns

**Adaptation Center**
- Learning status (cold start → early → developing → mature)
- Insights: "You complete tasks most consistently around 7 PM"
- Suggested changes: "Adjust DSA duration from 120 to 94 minutes"
- Apply or dismiss with one click

**Settings**
- Schedule preferences (wake/sleep, breaks, buffers)
- Personalization toggle (enable/disable behavioral tracking)
- Category management
- Data export (JSON)
- Delete all data

## 🏗️ Architecture

See `docs/ARCHITECTURE.md` for full system design.

**Key principles:**
- **No silent failures** — every error surfaces to the user
- **No fake data** — if we don't have data, we say "Not enough data yet"
- **No impossible schedules** — conflicts are reported, not hidden
- **User owns their data** — export, delete, disable tracking always available
- **LLM output is untrusted** — validated at every layer
- **Auth is server-side** — frontend never authorizes (Phase 2)
- **Beauty through purpose** — no decorative gradients, glows, or glass

## 📊 Data Model

See `docs/DATABASE_SCHEMA.sql` for full PostgreSQL schema.

**Core entities:**
- `users` — authentication
- `user_preferences` — scheduling configuration
- `tasks` — flexible activities
- `fixed_commitments` — non-negotiable time blocks
- `schedule_items` — generated daily schedule
- `task_executions` — behavioral tracking (core ML data)
- `behavior_events` — granular pattern detection
- `personalization_insights` — learned patterns
- `adaptations` — suggested schedule changes
- `weekly_reviews` — aggregated performance

## 🔌 API Contract

See `src/api/contract.ts` for TypeScript interfaces defining every endpoint.

**Repository pattern:**
```typescript
// Current: IndexedDB (offline-first)
const repos = getRepositories('indexeddb');

// Future: HTTP (when backend is deployed)
const repos = getRepositories('http', 'https://api.amigo.app');

// UI code doesn't change
const tasks = await repos.tasks.list();
```

## 🧪 Testing the Adaptive Features

To see personalization in action:

1. Complete onboarding
2. Add 3-5 recurring tasks (e.g., "Study DSA", "Gym", "Project work")
3. Generate schedule for today
4. Complete some tasks, skip others, postpone a few
5. Provide reasons when skipping/postponing
6. Repeat for 5-7 days
7. Go to **Adaptation** page — you'll see insights like:
   - "Your Study DSA sessions average 94 minutes instead of 120"
   - "You complete tasks most consistently around 7 PM"
   - "Gym sessions after 6 PM have higher completion"
8. Apply suggested adaptations
9. Generate next week's schedule — it will use adjusted durations and time preferences

## 🎨 Design System

**No decorative fluff:**
- ❌ No purple gradients
- ❌ No glowing effects
- ❌ No glassmorphism
- ❌ No sparkles or emoji icons
- ❌ No fake data or statistics

**Purposeful design:**
- ✅ Dark charcoal surfaces (#0a0a0b, #111113, #1a1a1d)
- ✅ Strong blue accent (#3b82f6)
- ✅ High contrast, clear hierarchy
- ✅ Compact, information-dense layouts
- ✅ Accessible (keyboard navigation, ARIA labels, focus states)
- ✅ Responsive (desktop, tablet, mobile)

## 📁 Project Structure

```
amigo/
├── docs/
│   ├── ARCHITECTURE.md          # System architecture
│   ├── DATABASE_SCHEMA.sql      # PostgreSQL schema
│   └── PHASE_1_SUMMARY.md       # What was delivered
│
├── src/
│   ├── api/
│   │   ├── contract.ts          # API interfaces
│   │   └── repositories.ts      # Data source abstraction
│   │
│   ├── components/
│   │   ├── ui/                  # Design system components
│   │   ├── layout/              # App layout + navigation
│   │   ├── dashboard/           # Dashboard page
│   │   ├── calendar/            # Calendar page
│   │   ├── tasks/               # Tasks page
│   │   ├── analytics/           # Analytics + Weekly Review
│   │   ├── insights/            # Adaptation Center
│   │   ├── settings/            # Settings page
│   │   └── onboarding/          # Onboarding flow
│   │
│   ├── engine/
│   │   ├── scheduler.ts         # Constraint-aware scheduling
│   │   ├── personalization.ts   # Pattern detection + insights
│   │   ├── analytics.ts         # Metrics + aggregations
│   │   └── nlParser.ts          # Natural language parsing
│   │
│   ├── store/
│   │   └── AppContext.tsx       # State management
│   │
│   ├── types/
│   │   └── index.ts             # TypeScript types
│   │
│   ├── db/
│   │   └── index.ts             # IndexedDB (Dexie)
│   │
│   └── App.tsx                  # Main app component
│
├── index.html
├── package.json
└── vite.config.ts
```

## 🔒 Security (Phase 1)

**Current (frontend-only):**
- All data stored locally in IndexedDB
- No network requests
- No authentication (single-user)
- No server-side validation needed

**Phase 2 will add:**
- JWT authentication (access + refresh tokens)
- Argon2id password hashing
- Server-side authorization (user ownership checks)
- Input validation (Pydantic schemas)
- SQL injection prevention (SQLAlchemy ORM)
- XSS protection (React escaping + CSP headers)
- CSRF protection (SameSite cookies)
- Rate limiting
- Security headers
- Audit logging

## 🌐 Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Android)

Requires IndexedDB support (all modern browsers).

## 📝 License

MIT

## 🤝 Contributing

This is a demonstration project. For production use, proceed to Phase 2 (backend implementation).

## 📧 Contact

For questions about the architecture or implementation, refer to:
- `docs/ARCHITECTURE.md` — system design
- `docs/DATABASE_SCHEMA.sql` — data model
- `docs/PHASE_1_SUMMARY.md` — what was delivered
- `src/api/contract.ts` — API specification

---

**Built with:** React 18, TypeScript, Vite, Tailwind CSS, Dexie (IndexedDB), Recharts, date-fns, uuid

**Phase 1 Status:** ✅ Complete
**Phase 2 Status:** ⏳ Ready to begin (FastAPI backend)
