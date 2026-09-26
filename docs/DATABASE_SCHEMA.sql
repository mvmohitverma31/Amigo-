-- ============================================================================
-- AMIGO — PostgreSQL Database Schema
-- Version: 1.0.0
-- ============================================================================
-- Design principles:
--   • Every row has a user_id (ownership)
--   • Every mutation must filter by user_id (authorization)
--   • Timezone-aware timestamps (TIMESTAMPTZ)
--   • Soft deletes where appropriate (deleted_at)
--   • Indexes on common query patterns
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- USERS
-- ============================================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,  -- Argon2id hash
    display_name    VARCHAR(100),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;

-- ============================================================================
-- USER PREFERENCES
-- One row per user. Stores scheduling configuration.
-- ============================================================================
CREATE TABLE user_preferences (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Core schedule bounds
    wake_up_time                TIME NOT NULL DEFAULT '07:00:00',
    sleep_time                  TIME NOT NULL DEFAULT '23:00:00',
    timezone                    VARCHAR(50) NOT NULL DEFAULT 'UTC',

    -- Scheduling parameters
    break_duration_minutes      SMALLINT NOT NULL DEFAULT 10
                                CHECK (break_duration_minutes BETWEEN 0 AND 60),
    transition_buffer_minutes   SMALLINT NOT NULL DEFAULT 10
                                CHECK (transition_buffer_minutes BETWEEN 0 AND 60),
    max_consecutive_work_min    SMALLINT NOT NULL DEFAULT 90
                                CHECK (max_consecutive_work_min BETWEEN 15 AND 240),

    -- Personalization
    personalization_enabled     BOOLEAN NOT NULL DEFAULT TRUE,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT user_preferences_user_unique UNIQUE (user_id)
);

CREATE INDEX idx_user_preferences_user ON user_preferences(user_id);

-- ============================================================================
-- TASK CATEGORIES
-- ============================================================================
CREATE TABLE task_categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    color       CHAR(7) NOT NULL DEFAULT '#3b82f6',  -- Hex color
    position    SMALLINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT task_categories_color_format CHECK (color ~* '^#[0-9a-f]{6}$'),
    CONSTRAINT task_categories_name_unique UNIQUE (user_id, name)
);

CREATE INDEX idx_task_categories_user ON task_categories(user_id);

-- ============================================================================
-- TASKS
-- Flexible or fixed activities the user wants to schedule.
-- ============================================================================
CREATE TABLE tasks (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id                 UUID REFERENCES task_categories(id) ON DELETE SET NULL,

    -- Core fields
    title                       VARCHAR(200) NOT NULL,
    description                 TEXT,

    -- Duration
    estimated_duration_minutes  SMALLINT NOT NULL
                                CHECK (estimated_duration_minutes BETWEEN 5 AND 480),

    -- Scheduling attributes
    priority                    VARCHAR(10) NOT NULL DEFAULT 'medium'
                                CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    is_fixed                    BOOLEAN NOT NULL DEFAULT FALSE,  -- Cannot be auto-moved
    is_locked                   BOOLEAN NOT NULL DEFAULT FALSE,  -- User locked in place
    is_recurring                BOOLEAN NOT NULL DEFAULT FALSE,

    -- Recurrence
    recurrence_frequency        VARCHAR(10)
                                CHECK (recurrence_frequency IS NULL OR
                                       recurrence_frequency IN ('daily', 'weekly', 'custom')),
    recurrence_days             SMALLINT[],  -- Array of day-of-week (0=Sun, 6=Sat)
    recurrence_interval         SMALLINT CHECK (recurrence_interval IS NULL OR recurrence_interval > 0),

    -- Timing preferences
    preferred_time_of_day       VARCHAR(10)
                                CHECK (preferred_time_of_day IS NULL OR
                                       preferred_time_of_day IN ('morning', 'afternoon', 'evening', 'night')),
    deadline                    DATE,

    -- Lifecycle
    is_archived                 BOOLEAN NOT NULL DEFAULT FALSE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at                  TIMESTAMPTZ
);

CREATE INDEX idx_tasks_user ON tasks(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_user_category ON tasks(user_id, category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_user_priority ON tasks(user_id, priority) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_user_deadline ON tasks(user_id, deadline) WHERE deleted_at IS NULL AND deadline IS NOT NULL;
CREATE INDEX idx_tasks_user_recurring ON tasks(user_id) WHERE is_recurring = TRUE AND deleted_at IS NULL;

-- ============================================================================
-- FIXED COMMITMENTS
-- Non-negotiable recurring time blocks (classes, work, meetings).
-- ============================================================================
CREATE TABLE fixed_commitments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id     UUID REFERENCES task_categories(id) ON DELETE SET NULL,

    title           VARCHAR(200) NOT NULL,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    days_of_week    SMALLINT[] NOT NULL,  -- 0=Sun, 6=Sat
    is_locked       BOOLEAN NOT NULL DEFAULT TRUE,
    location        VARCHAR(200),
    notes           TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT fixed_commitments_time_order CHECK (end_time > start_time),
    CONSTRAINT fixed_commitments_days_valid CHECK (
        array_length(days_of_week, 1) > 0 AND
        array_length(days_of_week, 1) <= 7
    )
);

CREATE INDEX idx_fixed_commitments_user ON fixed_commitments(user_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- SCHEDULE ITEMS
-- Generated daily schedule. One row per time block per day.
-- ============================================================================
CREATE TABLE schedule_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    date                DATE NOT NULL,
    task_id             UUID REFERENCES tasks(id) ON DELETE SET NULL,
    commitment_id       UUID REFERENCES fixed_commitments(id) ON DELETE SET NULL,

    title               VARCHAR(200) NOT NULL,
    start_time          TIME NOT NULL,
    end_time            TIME NOT NULL,
    duration_minutes    SMALLINT NOT NULL
                        CHECK (duration_minutes > 0),

    is_fixed            BOOLEAN NOT NULL DEFAULT FALSE,
    is_locked           BOOLEAN NOT NULL DEFAULT FALSE,
    status              VARCHAR(15) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'active', 'paused',
                                          'completed', 'skipped', 'postponed')),
    sort_order          SMALLINT NOT NULL DEFAULT 0,

    -- Generation metadata
    generated_by        VARCHAR(20) NOT NULL DEFAULT 'rule'
                        CHECK (generated_by IN ('rule', 'personalized', 'ml', 'manual')),
    generation_version  INTEGER NOT NULL DEFAULT 1,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT schedule_items_time_order CHECK (end_time > start_time),
    CONSTRAINT schedule_items_source CHECK (
        (task_id IS NOT NULL AND commitment_id IS NULL) OR
        (task_id IS NULL AND commitment_id IS NOT NULL)
    )
);

CREATE INDEX idx_schedule_items_user_date ON schedule_items(user_id, date);
CREATE INDEX idx_schedule_items_user_date_order ON schedule_items(user_id, date, sort_order);
CREATE INDEX idx_schedule_items_user_status ON schedule_items(user_id, status) WHERE status != 'pending';
CREATE INDEX idx_schedule_items_task ON schedule_items(task_id) WHERE task_id IS NOT NULL;

-- ============================================================================
-- TASK EXECUTIONS
-- Records of actual task execution behavior. The core data for personalization.
-- ============================================================================
CREATE TABLE task_executions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    schedule_item_id            UUID REFERENCES schedule_items(id) ON DELETE SET NULL,
    task_id                     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

    date                        DATE NOT NULL,

    -- Planned values (from schedule)
    planned_start_time          TIME NOT NULL,
    planned_end_time            TIME NOT NULL,
    planned_duration_minutes    SMALLINT NOT NULL,

    -- Actual values (recorded when user acts)
    actual_start_time           TIME,
    actual_end_time             TIME,
    actual_duration_minutes     SMALLINT
                                CHECK (actual_duration_minutes IS NULL OR actual_duration_minutes > 0),

    -- Outcome
    status                      VARCHAR(15) NOT NULL
                                CHECK (status IN ('pending', 'active', 'paused',
                                                  'completed', 'skipped', 'postponed')),
    skip_reason                 VARCHAR(30)
                                CHECK (skip_reason IS NULL OR skip_reason IN (
                                    'too_tired', 'took_longer', 'didnt_feel_like_it',
                                    'unexpected_event', 'schedule_unrealistic',
                                    'higher_priority', 'other'
                                )),
    postponement_count          SMALLINT NOT NULL DEFAULT 0
                                CHECK (postponement_count >= 0),
    is_manual_override          BOOLEAN NOT NULL DEFAULT FALSE,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_executions_user ON task_executions(user_id);
CREATE INDEX idx_task_executions_user_date ON task_executions(user_id, date);
CREATE INDEX idx_task_executions_user_task ON task_executions(user_id, task_id);
CREATE INDEX idx_task_executions_user_status ON task_executions(user_id, status);
CREATE INDEX idx_task_executions_task_date ON task_executions(task_id, date);

-- ============================================================================
-- BEHAVIOR EVENTS
-- Granular events for pattern detection.
-- ============================================================================
CREATE TABLE behavior_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    date            DATE NOT NULL,
    event_type      VARCHAR(30) NOT NULL
                    CHECK (event_type IN (
                        'completion', 'skip', 'postpone', 'start_delay',
                        'duration_deviation', 'manual_override', 'reschedule'
                    )),

    task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,
    category_id     UUID REFERENCES task_categories(id) ON DELETE SET NULL,

    -- Context
    time_of_day     VARCHAR(10) NOT NULL
                    CHECK (time_of_day IN ('morning', 'afternoon', 'evening', 'night')),
    day_of_week     SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),

    -- Flexible metadata (JSONB for extensibility)
    meta            JSONB NOT NULL DEFAULT '{}',

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_behavior_events_user ON behavior_events(user_id);
CREATE INDEX idx_behavior_events_user_date ON behavior_events(user_id, date);
CREATE INDEX idx_behavior_events_user_type ON behavior_events(user_id, event_type);
CREATE INDEX idx_behavior_events_user_task ON behavior_events(user_id, task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_behavior_events_user_category ON behavior_events(user_id, category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_behavior_events_meta ON behavior_events USING GIN (meta);

-- ============================================================================
-- PERSONALIZATION INSIGHTS
-- Patterns the system has identified from behavioral data.
-- ============================================================================
CREATE TABLE personalization_insights (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    insight_type    VARCHAR(30) NOT NULL
                    CHECK (insight_type IN (
                        'duration', 'time_preference', 'completion_pattern',
                        'postponement_pattern', 'productivity_pattern',
                        'category_pattern', 'day_pattern'
                    )),

    description     TEXT NOT NULL,
    data            JSONB NOT NULL DEFAULT '{}',

    -- Confidence and evidence
    confidence      REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    sample_size     INTEGER NOT NULL CHECK (sample_size >= 0),

    -- Lifecycle
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ  -- Insights can expire if patterns change
);

CREATE INDEX idx_insights_user ON personalization_insights(user_id) WHERE is_active = TRUE;
CREATE INDEX idx_insights_user_type ON personalization_insights(user_id, insight_type) WHERE is_active = TRUE;
CREATE INDEX idx_insights_data ON personalization_insights USING GIN (data);

-- ============================================================================
-- ADAPTATIONS
-- Suggested or applied changes to the schedule based on insights.
-- ============================================================================
CREATE TABLE adaptations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    adaptation_type VARCHAR(30) NOT NULL
                    CHECK (adaptation_type IN (
                        'time_shift', 'duration_adjustment', 'frequency_change',
                        'priority_adjustment', 'buffer_addition', 'category_move'
                    )),

    task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,

    description     TEXT NOT NULL,
    reason          TEXT NOT NULL,
    confidence      REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),

    -- Lifecycle
    is_applied      BOOLEAN NOT NULL DEFAULT FALSE,
    is_dismissed    BOOLEAN NOT NULL DEFAULT FALSE,
    applied_at      TIMESTAMPTZ,
    dismissed_at    TIMESTAMPTZ,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT adaptations_not_both CHECK (NOT (is_applied AND is_dismissed))
);

CREATE INDEX idx_adaptations_user ON adaptations(user_id);
CREATE INDEX idx_adaptations_user_pending ON adaptations(user_id)
    WHERE is_applied = FALSE AND is_dismissed = FALSE;
CREATE INDEX idx_adaptations_task ON adaptations(task_id) WHERE task_id IS NOT NULL;

-- ============================================================================
-- WEEKLY REVIEWS
-- Aggregated weekly performance snapshots.
-- ============================================================================
CREATE TABLE weekly_reviews (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    week_start_date         DATE NOT NULL,  -- Monday
    week_end_date           DATE NOT NULL,  -- Sunday

    -- Aggregate metrics
    total_planned_minutes   INTEGER NOT NULL DEFAULT 0,
    total_completed_minutes INTEGER NOT NULL DEFAULT 0,
    completion_rate         REAL NOT NULL DEFAULT 0 CHECK (completion_rate BETWEEN 0 AND 1),
    average_delay_minutes   REAL NOT NULL DEFAULT 0,
    total_tasks             INTEGER NOT NULL DEFAULT 0,
    completed_tasks         INTEGER NOT NULL DEFAULT 0,

    -- Breakdowns (stored as JSONB for flexibility)
    category_breakdown      JSONB NOT NULL DEFAULT '[]',
    best_time_windows       JSONB NOT NULL DEFAULT '[]',
    worst_time_windows      JSONB NOT NULL DEFAULT '[]',
    day_of_week_performance JSONB NOT NULL DEFAULT '[]',

    -- Lists of task IDs
    frequently_postponed    JSONB NOT NULL DEFAULT '[]',
    frequently_skipped      JSONB NOT NULL DEFAULT '[]',

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT weekly_reviews_date_range CHECK (week_end_date > week_start_date),
    CONSTRAINT weekly_reviews_unique_week UNIQUE (user_id, week_start_date)
);

CREATE INDEX idx_weekly_reviews_user ON weekly_reviews(user_id);
CREATE INDEX idx_weekly_reviews_user_date ON weekly_reviews(user_id, week_start_date DESC);

-- ============================================================================
-- PREDICTIONS (ML outputs)
-- Cached predictions from the ML layer.
-- ============================================================================
CREATE TABLE predictions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    prediction_type     VARCHAR(30) NOT NULL
                        CHECK (prediction_type IN (
                            'duration', 'completion_probability',
                            'optimal_time', 'postponement_risk'
                        )),

    task_id             UUID REFERENCES tasks(id) ON DELETE CASCADE,
    category_id         UUID REFERENCES task_categories(id) ON DELETE SET NULL,

    -- Prediction value (type depends on prediction_type)
    predicted_value     REAL NOT NULL,
    confidence          REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),

    -- Model metadata
    model_version       VARCHAR(50) NOT NULL,
    features_used       JSONB NOT NULL DEFAULT '{}',

    -- Validity
    valid_from          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until         TIMESTAMPTZ NOT NULL,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_predictions_user ON predictions(user_id);
CREATE INDEX idx_predictions_user_type ON predictions(user_id, prediction_type);
CREATE INDEX idx_predictions_task ON predictions(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_predictions_validity ON predictions(user_id, valid_from, valid_until);

-- ============================================================================
-- AUDIT LOG
-- Security-relevant events (login, data deletion, etc.)
-- ============================================================================
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,

    event_type      VARCHAR(50) NOT NULL,
    description     TEXT NOT NULL,
    ip_address      INET,
    user_agent      TEXT,

    -- Flexible metadata
    meta            JSONB NOT NULL DEFAULT '{}',

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_event ON audit_log(event_type);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- ============================================================================
-- TRIGGERS — Auto-update updated_at timestamps
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_preferences_updated
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tasks_updated
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_commitments_updated
    BEFORE UPDATE ON fixed_commitments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_schedule_updated
    BEFORE UPDATE ON schedule_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_executions_updated
    BEFORE UPDATE ON task_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_insights_updated
    BEFORE UPDATE ON personalization_insights
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (defense in depth)
-- Application-level checks are mandatory; RLS is a backup.
-- ============================================================================
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavior_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE personalization_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE adaptations ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

-- Note: Actual RLS policies require a session variable (e.g., current_user_id)
-- set by the application on each request. Example policy:
--
-- CREATE POLICY user_preferences_owner ON user_preferences
--     FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);
--
-- These are created per-deployment based on the auth mechanism.

-- ============================================================================
-- SEED: Default categories (optional, inserted per-user on signup)
-- ============================================================================
-- This would be handled by application logic on user creation:
-- INSERT INTO task_categories (user_id, name, color) VALUES
--     ($1, 'Study', '#3b82f6'),
--     ($1, 'Exercise', '#22c55e'),
--     ($1, 'Work', '#f59e0b'),
--     ($1, 'Personal', '#8b5cf6');
