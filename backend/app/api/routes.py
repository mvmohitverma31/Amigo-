"""
Amigo — API Routes
All endpoints in one file for simplicity. In production, split into separate modules.
"""
from datetime import datetime, timedelta, date
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_db
from .models import User, UserPreferences, Task, TaskCategory, FixedCommitment, ScheduleItem, TaskExecution, BehaviorEvent, PersonalizationInsight, Adaptation
from .schemas import (
    LoginRequest, RegisterRequest, AuthResponse, UserPublic,
    PreferencesResponse, UpdatePreferencesRequest,
    CategoryResponse, CreateCategoryRequest,
    TaskResponse, CreateTaskRequest, UpdateTaskRequest,
    CommitmentResponse, CreateCommitmentRequest,
    ScheduleItemResponse, GenerateScheduleResponse, ConflictResponse,
    ExecutionResponse, SkipExecutionRequest,
    AnalyticsSummaryResponse, CategoryBreakdownResponse, TimeWindowScoreResponse,
    InsightResponse, AdaptationResponse,
    DataStatusResponse,
    NLParseRequest, NLParseResponse, ParsedCommitmentResponse,
)
from .security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    get_current_user, verify_ownership,
    limiter, log_security_event,
    PasswordValidationError,
)


router = APIRouter()


# ============================================================================
# AUTH
# ============================================================================

@router.post("/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")  # Rate limit: 5 registrations per minute per IP
async def register(
    request: Request,
    register_data: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user."""
    try:
        # Check if email already exists
        result = await db.execute(select(User).where(User.email == register_data.email))
        if result.scalar_one_or_none():
            log_security_event("registration_failed", ip_address=request.client.host, details={"reason": "email_exists"})
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

        # Create user
        user = User(
            email=register_data.email,
            password_hash=hash_password(register_data.password),
            display_name=register_data.display_name,
        )
        db.add(user)
        await db.flush()

        # Create default preferences
        prefs = UserPreferences(user_id=user.id)
        db.add(prefs)

        # Create default categories
        default_categories = [
            ("Study", "#3b82f6"),
            ("Exercise", "#22c55e"),
            ("Work", "#f59e0b"),
            ("Personal", "#8b5cf6"),
        ]
        for name, color in default_categories:
            cat = TaskCategory(user_id=user.id, name=name, color=color)
            db.add(cat)

        await db.commit()

        # Generate tokens
        access_token = create_access_token(data={"sub": user.id})
        refresh_token = create_refresh_token(data={"sub": user.id})

        log_security_event("registration_success", user_id=user.id, ip_address=request.client.host)

        return AuthResponse(
            access_token=access_token,
            user=UserPublic(
                id=user.id,
                email=user.email,
                display_name=user.display_name,
                created_at=user.created_at,
            ),
        )
    except PasswordValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/auth/login", response_model=AuthResponse)
@limiter.limit("5/minute")  # Rate limit: 5 login attempts per minute per IP
async def login(
    request: Request,
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Login with email and password."""
    result = await db.execute(select(User).where(User.email == login_data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(login_data.password, user.password_hash):
        log_security_event(
            "login_failed",
            ip_address=request.client.host,
            details={"email": login_data.email, "reason": "invalid_credentials"}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active or user.deleted_at:
        log_security_event(
            "login_failed",
            user_id=user.id,
            ip_address=request.client.host,
            details={"reason": "account_inactive"}
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    access_token = create_access_token(data={"sub": user.id})
    refresh_token = create_refresh_token(data={"sub": user.id})

    log_security_event("login_success", user_id=user.id, ip_address=request.client.host)

    return AuthResponse(
        access_token=access_token,
        user=UserPublic(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            created_at=user.created_at,
        ),
    )


# ============================================================================
# PREFERENCES
# ============================================================================

@router.get("/preferences", response_model=PreferencesResponse)
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's preferences."""
    result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()

    if not prefs:
        raise HTTPException(status_code=404, detail="Preferences not found")

    return PreferencesResponse(
        id=prefs.id,
        user_id=prefs.user_id,
        wake_up_time=prefs.wake_up_time.strftime("%H:%M"),
        sleep_time=prefs.sleep_time.strftime("%H:%M"),
        timezone=prefs.timezone,
        break_duration_minutes=prefs.break_duration_minutes,
        transition_buffer_minutes=prefs.transition_buffer_minutes,
        max_consecutive_work_minutes=prefs.max_consecutive_work_min,
        personalization_enabled=prefs.personalization_enabled,
        created_at=prefs.created_at,
        updated_at=prefs.updated_at,
    )


@router.put("/preferences", response_model=PreferencesResponse)
async def update_preferences(
    request: UpdatePreferencesRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user's preferences."""
    result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()

    if not prefs:
        raise HTTPException(status_code=404, detail="Preferences not found")

    # Update fields
    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "wake_up_time" and value:
            h, m = map(int, value.split(":"))
            setattr(prefs, field, datetime.strptime(value, "%H:%M").time())
        elif field == "sleep_time" and value:
            setattr(prefs, field, datetime.strptime(value, "%H:%M").time())
        elif field == "max_consecutive_work_minutes":
            prefs.max_consecutive_work_min = value
        else:
            setattr(prefs, field, value)

    await db.commit()

    return await get_preferences(current_user, db)


# ============================================================================
# CATEGORIES
# ============================================================================

@router.get("/categories", response_model=List[CategoryResponse])
async def list_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all categories for current user."""
    result = await db.execute(
        select(TaskCategory)
        .where(TaskCategory.user_id == current_user.id)
        .order_by(TaskCategory.position)
    )
    categories = result.scalars().all()
    return [CategoryResponse.model_validate(c) for c in categories]


@router.post("/categories", response_model=CategoryResponse, status_code=201)
async def create_category(
    request: CreateCategoryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new category."""
    category = TaskCategory(
        user_id=current_user.id,
        name=request.name,
        color=request.color,
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return CategoryResponse.model_validate(category)


@router.delete("/categories/{category_id}", status_code=204)
async def delete_category(
    category_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a category."""
    result = await db.execute(
        select(TaskCategory).where(
            and_(TaskCategory.id == category_id, TaskCategory.user_id == current_user.id)
        )
    )
    category = result.scalar_one_or_none()

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    await db.delete(category)
    await db.commit()


# ============================================================================
# TASKS
# ============================================================================

@router.get("/tasks", response_model=List[TaskResponse])
async def list_tasks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all tasks for current user."""
    result = await db.execute(
        select(Task)
        .where(and_(Task.user_id == current_user.id, Task.deleted_at.is_(None)))
        .order_by(Task.created_at.desc())
    )
    tasks = result.scalars().all()
    return [TaskResponse.model_validate(t) for t in tasks]


@router.post("/tasks", response_model=TaskResponse, status_code=201)
async def create_task(
    request: CreateTaskRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new task."""
    task = Task(
        user_id=current_user.id,
        **request.model_dump(exclude_unset=True),
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return TaskResponse.model_validate(task)


@router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    request: UpdateTaskRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a task."""
    result = await db.execute(
        select(Task).where(and_(Task.id == task_id, Task.user_id == current_user.id))
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)

    await db.commit()
    await db.refresh(task)
    return TaskResponse.model_validate(task)


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete a task."""
    result = await db.execute(
        select(Task).where(and_(Task.id == task_id, Task.user_id == current_user.id))
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.deleted_at = datetime.utcnow()
    await db.commit()


# ============================================================================
# COMMITMENTS
# ============================================================================

@router.get("/commitments", response_model=List[CommitmentResponse])
async def list_commitments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all fixed commitments."""
    result = await db.execute(
        select(FixedCommitment)
        .where(and_(FixedCommitment.user_id == current_user.id, FixedCommitment.deleted_at.is_(None)))
    )
    commitments = result.scalars().all()
    return [CommitmentResponse.model_validate(c) for c in commitments]


@router.post("/commitments", response_model=CommitmentResponse, status_code=201)
async def create_commitment(
    request: CreateCommitmentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a fixed commitment."""
    commitment = FixedCommitment(
        user_id=current_user.id,
        **request.model_dump(exclude_unset=True),
    )
    db.add(commitment)
    await db.commit()
    await db.refresh(commitment)
    return CommitmentResponse.model_validate(commitment)


# ============================================================================
# SCHEDULE
# ============================================================================

@router.get("/schedule/{date_str}", response_model=List[ScheduleItemResponse])
async def get_schedule_for_date(
    date_str: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get schedule for a specific date."""
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    result = await db.execute(
        select(ScheduleItem)
        .where(and_(ScheduleItem.user_id == current_user.id, ScheduleItem.date == target_date))
        .order_by(ScheduleItem.sort_order)
    )
    items = result.scalars().all()
    return [ScheduleItemResponse.model_validate(i) for i in items]


@router.post("/schedule/generate", response_model=GenerateScheduleResponse)
async def generate_schedule(
    date_str: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a schedule for a specific date.
    This is a simplified version — full implementation would use the scheduling engine.
    """
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    # Get preferences
    prefs_result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    )
    prefs = prefs_result.scalar_one_or_none()
    if not prefs:
        raise HTTPException(status_code=404, detail="Preferences not found")

    # Get tasks and commitments
    tasks_result = await db.execute(
        select(Task).where(and_(Task.user_id == current_user.id, Task.deleted_at.is_(None)))
    )
    tasks = tasks_result.scalars().all()

    commitments_result = await db.execute(
        select(FixedCommitment).where(
            and_(FixedCommitment.user_id == current_user.id, FixedCommitment.deleted_at.is_(None))
        )
    )
    commitments = commitments_result.scalars().all()

    # Simplified scheduling logic (placeholder)
    # In production, this would call the full scheduling engine
    items = []
    conflicts = []
    warnings = []
    unscheduled = []

    # Add fixed commitments first
    day_of_week = target_date.weekday()
    for commitment in commitments:
        if day_of_week in commitment.days_of_week:
            item = ScheduleItem(
                user_id=current_user.id,
                date=target_date,
                commitment_id=commitment.id,
                title=commitment.title,
                start_time=commitment.start_time,
                end_time=commitment.end_time,
                duration_minutes=int((datetime.combine(target_date, commitment.end_time) -
                                     datetime.combine(target_date, commitment.start_time)).seconds / 60),
                is_fixed=True,
                is_locked=commitment.is_locked,
                status="pending",
                sort_order=len(items),
                generated_by="rule",
            )
            db.add(item)
            items.append(item)

    # Add flexible tasks (simplified — just append after commitments)
    current_time = prefs.sleep_time
    for task in tasks:
        if not task.is_fixed:
            # Simplified: just add tasks sequentially
            start = datetime.combine(target_date, current_time)
            end = start + timedelta(minutes=task.estimated_duration_minutes)
            item = ScheduleItem(
                user_id=current_user.id,
                date=target_date,
                task_id=task.id,
                title=task.title,
                start_time=start.time(),
                end_time=end.time(),
                duration_minutes=task.estimated_duration_minutes,
                is_fixed=False,
                is_locked=task.is_locked,
                status="pending",
                sort_order=len(items),
                generated_by="rule",
            )
            db.add(item)
            items.append(item)
            current_time = end.time()

    await db.commit()

    return GenerateScheduleResponse(
        items=[ScheduleItemResponse.model_validate(i) for i in items],
        conflicts=conflicts,
        warnings=warnings,
        unscheduled_task_ids=unscheduled,
    )


# ============================================================================
# EXECUTIONS
# ============================================================================

@router.get("/executions/recent", response_model=List[ExecutionResponse])
async def get_recent_executions(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get recent task executions."""
    since = date.today() - timedelta(days=days)
    result = await db.execute(
        select(TaskExecution)
        .where(and_(TaskExecution.user_id == current_user.id, TaskExecution.date >= since))
        .order_by(TaskExecution.date.desc())
    )
    executions = result.scalars().all()
    return [ExecutionResponse.model_validate(e) for e in executions]


@router.post("/executions/complete", response_model=ExecutionResponse)
async def complete_execution(
    schedule_item_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a schedule item as completed."""
    result = await db.execute(
        select(ScheduleItem).where(
            and_(ScheduleItem.id == schedule_item_id, ScheduleItem.user_id == current_user.id)
        )
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Schedule item not found")

    item.status = "completed"

    # Create execution record
    execution = TaskExecution(
        user_id=current_user.id,
        schedule_item_id=item.id,
        task_id=item.task_id,
        date=item.date,
        planned_start_time=item.start_time,
        planned_end_time=item.end_time,
        planned_duration_minutes=item.duration_minutes,
        actual_start_time=item.start_time,
        actual_end_time=item.end_time,
        actual_duration_minutes=item.duration_minutes,
        status="completed",
    )
    db.add(execution)

    await db.commit()
    await db.refresh(execution)
    return ExecutionResponse.model_validate(execution)


# ============================================================================
# ANALYTICS
# ============================================================================

@router.get("/analytics/summary", response_model=AnalyticsSummaryResponse)
async def get_analytics_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get analytics summary."""
    result = await db.execute(
        select(TaskExecution).where(TaskExecution.user_id == current_user.id)
    )
    executions = result.scalars().all()

    if not executions:
        return AnalyticsSummaryResponse(
            total_planned_minutes=0,
            total_completed_minutes=0,
            completion_rate=0,
            average_delay_minutes=0,
            average_duration_deviation=0,
            total_tasks=0,
            completed_tasks=0,
            skipped_tasks=0,
            postponed_tasks=0,
            streak_days=0,
        )

    completed = [e for e in executions if e.status == "completed"]
    skipped = [e for e in executions if e.status == "skipped"]
    postponed = [e for e in executions if e.status == "postponed"]

    total_planned = sum(e.planned_duration_minutes for e in executions)
    total_completed = sum(e.actual_duration_minutes or e.planned_duration_minutes for e in completed)

    return AnalyticsSummaryResponse(
        total_planned_minutes=total_planned,
        total_completed_minutes=total_completed,
        completion_rate=len(completed) / len(executions) if executions else 0,
        average_delay_minutes=0,  # Simplified
        average_duration_deviation=0,  # Simplified
        total_tasks=len(executions),
        completed_tasks=len(completed),
        skipped_tasks=len(skipped),
        postponed_tasks=len(postponed),
        streak_days=0,  # Simplified
    )


# ============================================================================
# INSIGHTS & ADAPTATIONS
# ============================================================================

@router.get("/insights", response_model=List[InsightResponse])
async def list_insights(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List personalization insights."""
    result = await db.execute(
        select(PersonalizationInsight)
        .where(and_(PersonalizationInsight.user_id == current_user.id, PersonalizationInsight.is_active == True))
        .order_by(PersonalizationInsight.confidence.desc())
    )
    insights = result.scalars().all()
    return [InsightResponse.model_validate(i) for i in insights]


@router.get("/adaptations", response_model=List[AdaptationResponse])
async def list_adaptations(
    pending: bool = True,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List adaptations."""
    query = select(Adaptation).where(Adaptation.user_id == current_user.id)
    if pending:
        query = query.where(and_(Adaptation.is_applied == False, Adaptation.is_dismissed == False))

    result = await db.execute(query)
    adaptations = result.scalars().all()
    return [AdaptationResponse.model_validate(a) for a in adaptations]


# ============================================================================
# DATA STATUS
# ============================================================================

@router.get("/data-status", response_model=DataStatusResponse)
async def get_data_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current data/learning status."""
    result = await db.execute(
        select(func.count(TaskExecution.id)).where(TaskExecution.user_id == current_user.id)
    )
    count = result.scalar() or 0

    if count < 5:
        level = "cold_start"
        message = "Not enough data yet. Using rule-based scheduling."
        percentage = min(100, count * 10)
    elif count < 15:
        level = "early"
        message = "Learning your patterns. Some personalization active."
        percentage = min(100, 10 + count * 3)
    elif count < 40:
        level = "developing"
        message = "Good data collected. Personalization improving."
        percentage = min(100, 30 + count)
    else:
        level = "mature"
        message = "Strong behavioral data. Full personalization active."
        percentage = 100

    return DataStatusResponse(
        level=level,
        message=message,
        percentage=percentage,
        total_data_points=count,
    )


# ============================================================================
# NATURAL LANGUAGE
# ============================================================================

@router.post("/parse-natural-language", response_model=NLParseResponse)
async def parse_natural_language(
    request: NLParseRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Parse natural language input into structured schedule data.
    Simplified version — in production, this would call an LLM or use advanced NLP.
    """
    # Placeholder implementation
    # In production, this would use the NL parser or call an LLM API
    return NLParseResponse(
        wake_up_time=None,
        sleep_time=None,
        commitments=[],
        ambiguities=["Natural language parsing is not yet implemented on the backend. Use the frontend parser."],
    )
