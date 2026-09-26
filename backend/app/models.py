"""
Amigo — SQLAlchemy ORM Models
Mirrors the PostgreSQL schema in docs/DATABASE_SCHEMA.sql
"""
import uuid
from datetime import datetime, date, time
from sqlalchemy import (
    Column, String, Boolean, Integer, Float, Text, Date, Time, DateTime,
    ForeignKey, Index, CheckConstraint, UniqueConstraint, ARRAY, JSON
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from .database import Base


def generate_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(100))
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime(timezone=True))

    # Relationships
    preferences = relationship("UserPreferences", back_populates="user", uselist=False, cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="user", cascade="all, delete-orphan")
    categories = relationship("TaskCategory", back_populates="user", cascade="all, delete-orphan")
    commitments = relationship("FixedCommitment", back_populates="user", cascade="all, delete-orphan")


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    wake_up_time = Column(Time, nullable=False, default=time(7, 0))
    sleep_time = Column(Time, nullable=False, default=time(23, 0))
    timezone = Column(String(50), nullable=False, default="UTC")
    break_duration_minutes = Column(Integer, nullable=False, default=10)
    transition_buffer_minutes = Column(Integer, nullable=False, default=10)
    max_consecutive_work_min = Column(Integer, nullable=False, default=90)
    personalization_enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="preferences")


class TaskCategory(Base):
    __tablename__ = "task_categories"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    color = Column(String(7), nullable=False, default="#3b82f6")
    position = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    user = relationship("User", back_populates="categories")
    tasks = relationship("Task", back_populates="category")

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="task_categories_name_unique"),
    )


class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(UUID(as_uuid=False), ForeignKey("task_categories.id", ondelete="SET NULL"))
    title = Column(String(200), nullable=False)
    description = Column(Text)
    estimated_duration_minutes = Column(Integer, nullable=False)
    priority = Column(String(10), nullable=False, default="medium")
    is_fixed = Column(Boolean, nullable=False, default=False)
    is_locked = Column(Boolean, nullable=False, default=False)
    is_recurring = Column(Boolean, nullable=False, default=False)
    recurrence_frequency = Column(String(10))
    recurrence_days = Column(ARRAY(Integer))
    recurrence_interval = Column(Integer)
    preferred_time_of_day = Column(String(10))
    deadline = Column(Date)
    is_archived = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime(timezone=True))

    user = relationship("User", back_populates="tasks")
    category = relationship("TaskCategory", back_populates="tasks")
    executions = relationship("TaskExecution", back_populates="task")


class FixedCommitment(Base):
    __tablename__ = "fixed_commitments"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(UUID(as_uuid=False), ForeignKey("task_categories.id", ondelete="SET NULL"))
    title = Column(String(200), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    days_of_week = Column(ARRAY(Integer), nullable=False)
    is_locked = Column(Boolean, nullable=False, default=True)
    location = Column(String(200))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime(timezone=True))

    user = relationship("User", back_populates="commitments")


class ScheduleItem(Base):
    __tablename__ = "schedule_items"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    task_id = Column(UUID(as_uuid=False), ForeignKey("tasks.id", ondelete="SET NULL"))
    commitment_id = Column(UUID(as_uuid=False), ForeignKey("fixed_commitments.id", ondelete="SET NULL"))
    title = Column(String(200), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    is_fixed = Column(Boolean, nullable=False, default=False)
    is_locked = Column(Boolean, nullable=False, default=False)
    status = Column(String(15), nullable=False, default="pending")
    sort_order = Column(Integer, nullable=False, default=0)
    generated_by = Column(String(20), nullable=False, default="rule")
    generation_version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_schedule_items_user_date_order", "user_id", "date", "sort_order"),
    )


class TaskExecution(Base):
    __tablename__ = "task_executions"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    schedule_item_id = Column(UUID(as_uuid=False), ForeignKey("schedule_items.id", ondelete="SET NULL"))
    task_id = Column(UUID(as_uuid=False), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    planned_start_time = Column(Time, nullable=False)
    planned_end_time = Column(Time, nullable=False)
    planned_duration_minutes = Column(Integer, nullable=False)
    actual_start_time = Column(Time)
    actual_end_time = Column(Time)
    actual_duration_minutes = Column(Integer)
    status = Column(String(15), nullable=False)
    skip_reason = Column(String(30))
    postponement_count = Column(Integer, nullable=False, default=0)
    is_manual_override = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    task = relationship("Task", back_populates="executions")


class BehaviorEvent(Base):
    __tablename__ = "behavior_events"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    event_type = Column(String(30), nullable=False)
    task_id = Column(UUID(as_uuid=False), ForeignKey("tasks.id", ondelete="SET NULL"))
    category_id = Column(UUID(as_uuid=False), ForeignKey("task_categories.id", ondelete="SET NULL"))
    time_of_day = Column(String(10), nullable=False)
    day_of_week = Column(Integer, nullable=False)
    meta = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class PersonalizationInsight(Base):
    __tablename__ = "personalization_insights"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    insight_type = Column(String(30), nullable=False)
    description = Column(Text, nullable=False)
    data = Column(JSONB, nullable=False, default=dict)
    confidence = Column(Float, nullable=False)
    sample_size = Column(Integer, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    expires_at = Column(DateTime(timezone=True))


class Adaptation(Base):
    __tablename__ = "adaptations"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    adaptation_type = Column(String(30), nullable=False)
    task_id = Column(UUID(as_uuid=False), ForeignKey("tasks.id", ondelete="SET NULL"))
    description = Column(Text, nullable=False)
    reason = Column(Text, nullable=False)
    confidence = Column(Float, nullable=False)
    is_applied = Column(Boolean, nullable=False, default=False)
    is_dismissed = Column(Boolean, nullable=False, default=False)
    applied_at = Column(DateTime(timezone=True))
    dismissed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class WeeklyReview(Base):
    __tablename__ = "weekly_reviews"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    week_start_date = Column(Date, nullable=False)
    week_end_date = Column(Date, nullable=False)
    total_planned_minutes = Column(Integer, nullable=False, default=0)
    total_completed_minutes = Column(Integer, nullable=False, default=0)
    completion_rate = Column(Float, nullable=False, default=0)
    average_delay_minutes = Column(Float, nullable=False, default=0)
    total_tasks = Column(Integer, nullable=False, default=0)
    completed_tasks = Column(Integer, nullable=False, default=0)
    category_breakdown = Column(JSONB, nullable=False, default=list)
    best_time_windows = Column(JSONB, nullable=False, default=list)
    worst_time_windows = Column(JSONB, nullable=False, default=list)
    day_of_week_performance = Column(JSONB, nullable=False, default=list)
    frequently_postponed = Column(JSONB, nullable=False, default=list)
    frequently_skipped = Column(JSONB, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "week_start_date", name="weekly_reviews_unique_week"),
    )
