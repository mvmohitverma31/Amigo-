"""
Amigo — Pydantic Schemas
Request/response validation. Must match src/api/contract.ts exactly.
"""
from datetime import datetime, date, time
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, EmailStr, Field, field_validator
import re


# ============================================================================
# AUTH
# ============================================================================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=12, max_length=128)

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=12, max_length=128)
    display_name: Optional[str] = Field(None, min_length=1, max_length=100)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Validate password meets security policy."""
        from .security import validate_password_strength, PasswordValidationError
        try:
            validate_password_strength(v)
        except PasswordValidationError as e:
            raise ValueError(str(e))
        return v

class UserPublic(BaseModel):
    id: str
    email: str
    display_name: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class AuthResponse(BaseModel):
    access_token: str
    user: UserPublic

class TokenRefreshResponse(BaseModel):
    access_token: str


# ============================================================================
# PREFERENCES
# ============================================================================

class PreferencesResponse(BaseModel):
    id: str
    user_id: str
    wake_up_time: str
    sleep_time: str
    timezone: str
    break_duration_minutes: int
    transition_buffer_minutes: int
    max_consecutive_work_minutes: int
    personalization_enabled: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class UpdatePreferencesRequest(BaseModel):
    wake_up_time: Optional[str] = None
    sleep_time: Optional[str] = None
    timezone: Optional[str] = None
    break_duration_minutes: Optional[int] = Field(None, ge=0, le=60)
    transition_buffer_minutes: Optional[int] = Field(None, ge=0, le=60)
    max_consecutive_work_minutes: Optional[int] = Field(None, ge=15, le=240)
    personalization_enabled: Optional[bool] = None

    @field_validator("wake_up_time", "sleep_time")
    @classmethod
    def validate_time(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not re.match(r"^\d{2}:\d{2}$", v):
            raise ValueError("Time must be in HH:mm format")
        return v


# ============================================================================
# CATEGORIES
# ============================================================================

class CategoryResponse(BaseModel):
    id: str
    user_id: str
    name: str
    color: str
    position: int
    created_at: datetime

    class Config:
        from_attributes = True

class CreateCategoryRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: str = Field(..., pattern=r"^#[0-9a-fA-F]{6}$")


# ============================================================================
# TASKS
# ============================================================================

class TaskResponse(BaseModel):
    id: str
    user_id: str
    category_id: Optional[str]
    title: str
    description: Optional[str]
    estimated_duration_minutes: int
    priority: str
    is_fixed: bool
    is_locked: bool
    is_recurring: bool
    recurrence_frequency: Optional[str]
    recurrence_days: Optional[List[int]]
    recurrence_interval: Optional[int]
    preferred_time_of_day: Optional[str]
    deadline: Optional[date]
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CreateTaskRequest(BaseModel):
    category_id: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    estimated_duration_minutes: int = Field(..., ge=5, le=480)
    priority: str = Field("medium", pattern=r"^(critical|high|medium|low)$")
    is_fixed: bool = False
    is_locked: bool = False
    is_recurring: bool = False
    recurrence_frequency: Optional[str] = Field(None, pattern=r"^(daily|weekly|custom)$")
    recurrence_days: Optional[List[int]] = Field(None, min_length=1, max_length=7)
    recurrence_interval: Optional[int] = Field(None, gt=0, le=365)
    preferred_time_of_day: Optional[str] = Field(None, pattern=r"^(morning|afternoon|evening|night)$")
    deadline: Optional[date] = None

class UpdateTaskRequest(BaseModel):
    category_id: Optional[str] = None
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    estimated_duration_minutes: Optional[int] = Field(None, ge=5, le=480)
    priority: Optional[str] = Field(None, pattern=r"^(critical|high|medium|low)$")
    is_fixed: Optional[bool] = None
    is_locked: Optional[bool] = None
    is_recurring: Optional[bool] = None
    preferred_time_of_day: Optional[str] = Field(None, pattern=r"^(morning|afternoon|evening|night)$")
    deadline: Optional[date] = None


# ============================================================================
# COMMITMENTS
# ============================================================================

class CommitmentResponse(BaseModel):
    id: str
    user_id: str
    category_id: Optional[str]
    title: str
    start_time: str
    end_time: str
    days_of_week: List[int]
    is_locked: bool
    location: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CreateCommitmentRequest(BaseModel):
    category_id: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=200)
    start_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    days_of_week: List[int] = Field(..., min_length=1, max_length=7)
    is_locked: bool = True
    location: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("days_of_week")
    @classmethod
    def validate_days(cls, v: List[int]) -> List[int]:
        if not all(0 <= d <= 6 for d in v):
            raise ValueError("Days must be 0-6 (Sunday-Saturday)")
        return v


# ============================================================================
# SCHEDULE
# ============================================================================

class ScheduleItemResponse(BaseModel):
    id: str
    user_id: str
    date: date
    task_id: Optional[str]
    commitment_id: Optional[str]
    title: str
    start_time: str
    end_time: str
    duration_minutes: int
    is_fixed: bool
    is_locked: bool
    status: str
    sort_order: int
    generated_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ConflictResponse(BaseModel):
    type: str
    items: List[str]
    message: str
    total_required_minutes: Optional[int] = None
    available_minutes: Optional[int] = None

class GenerateScheduleResponse(BaseModel):
    items: List[ScheduleItemResponse]
    conflicts: List[ConflictResponse]
    warnings: List[str]
    unscheduled_task_ids: List[str]


# ============================================================================
# EXECUTIONS
# ============================================================================

class ExecutionResponse(BaseModel):
    id: str
    user_id: str
    schedule_item_id: Optional[str]
    task_id: str
    date: date
    planned_start_time: str
    planned_end_time: str
    planned_duration_minutes: int
    actual_start_time: Optional[str]
    actual_end_time: Optional[str]
    actual_duration_minutes: Optional[int]
    status: str
    skip_reason: Optional[str]
    postponement_count: int
    is_manual_override: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SkipExecutionRequest(BaseModel):
    schedule_item_id: str
    reason: Optional[str] = Field(None, pattern=r"^(too_tired|took_longer|didnt_feel_like_it|unexpected_event|schedule_unrealistic|higher_priority|other)$")


# ============================================================================
# ANALYTICS
# ============================================================================

class AnalyticsSummaryResponse(BaseModel):
    total_planned_minutes: int
    total_completed_minutes: int
    completion_rate: float
    average_delay_minutes: int
    average_duration_deviation: int
    total_tasks: int
    completed_tasks: int
    skipped_tasks: int
    postponed_tasks: int
    streak_days: int

class CategoryBreakdownResponse(BaseModel):
    category_id: str
    category_name: str
    planned_minutes: int
    completed_minutes: int
    completion_rate: float

class TimeWindowScoreResponse(BaseModel):
    time_window: str
    completion_rate: float
    average_delay_minutes: int
    sample_size: int


# ============================================================================
# INSIGHTS & ADAPTATIONS
# ============================================================================

class InsightResponse(BaseModel):
    id: str
    user_id: str
    insight_type: str
    description: str
    data: Dict[str, Any]
    confidence: float
    sample_size: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AdaptationResponse(BaseModel):
    id: str
    user_id: str
    adaptation_type: str
    task_id: Optional[str]
    description: str
    reason: str
    confidence: float
    is_applied: bool
    is_dismissed: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# DATA STATUS
# ============================================================================

class DataStatusResponse(BaseModel):
    level: str
    message: str
    percentage: int
    total_data_points: int


# ============================================================================
# NATURAL LANGUAGE
# ============================================================================

class NLParseRequest(BaseModel):
    input: str = Field(..., min_length=1, max_length=2000)

class ParsedCommitmentResponse(BaseModel):
    title: str
    start_time: Optional[str]
    end_time: Optional[str]
    duration_minutes: Optional[int]
    is_fixed: bool
    time_of_day: Optional[str]

class NLParseResponse(BaseModel):
    wake_up_time: Optional[str]
    sleep_time: Optional[str]
    commitments: List[ParsedCommitmentResponse]
    ambiguities: List[str]


# ============================================================================
# ERROR
# ============================================================================

class ApiError(BaseModel):
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None
