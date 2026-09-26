"""
Amigo — Security
JWT authentication, password hashing, authorization dependencies.
Hardened with rate limiting, CSRF protection, and audit logging.
"""
import logging
import re
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address

from .config import get_settings
from .database import get_db
from .models import User


settings = get_settings()
logger = logging.getLogger(__name__)

# Password hashing (Argon2id)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# JWT
security = HTTPBearer()

# Rate limiter
limiter = Limiter(key_func=get_remote_address)


# ============================================================================
# PASSWORD VALIDATION
# ============================================================================

class PasswordValidationError(Exception):
    """Raised when password doesn't meet policy requirements."""
    pass


def validate_password_strength(password: str) -> None:
    """
    Validate password meets security policy.
    Raises PasswordValidationError if requirements not met.
    """
    errors = []

    if len(password) < settings.PASSWORD_MIN_LENGTH:
        errors.append(f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters")

    if settings.PASSWORD_REQUIRE_UPPERCASE and not re.search(r'[A-Z]', password):
        errors.append("Password must contain at least one uppercase letter")

    if settings.PASSWORD_REQUIRE_LOWERCASE and not re.search(r'[a-z]', password):
        errors.append("Password must contain at least one lowercase letter")

    if settings.PASSWORD_REQUIRE_DIGIT and not re.search(r'\d', password):
        errors.append("Password must contain at least one digit")

    if settings.PASSWORD_REQUIRE_SPECIAL and not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        errors.append("Password must contain at least one special character")

    # Check for common weak passwords
    common_passwords = [
        "password123", "12345678", "qwerty123", "admin123",
        "letmein123", "welcome123", "monkey123", "dragon123"
    ]
    if password.lower() in common_passwords:
        errors.append("Password is too common")

    if errors:
        raise PasswordValidationError("; ".join(errors))


def hash_password(password: str) -> str:
    """Hash a password using Argon2id."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


# ============================================================================
# JWT TOKENS
# ============================================================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({
        "exp": expire,
        "type": "access",
        "iat": datetime.utcnow(),  # Issued at
    })
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """Create a JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({
        "exp": expire,
        "type": "refresh",
        "iat": datetime.utcnow(),
    })
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError as e:
        logger.warning(f"Invalid token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ============================================================================
# CSRF PROTECTION
# ============================================================================

def generate_csrf_token() -> str:
    """Generate a CSRF token."""
    import secrets
    return secrets.token_urlsafe(32)


def validate_csrf_token(request: Request, expected_token: str) -> bool:
    """Validate CSRF token from request."""
    token = request.headers.get("X-CSRF-Token") or request.cookies.get("csrf_token")
    return token == expected_token


# ============================================================================
# AUTHENTICATION DEPENDENCIES
# ============================================================================

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Dependency: extract and validate the current user from JWT.
    Raises 401 if token is invalid, 403 if user is inactive/deleted.
    """
    payload = decode_token(credentials.credentials)

    # Check token type
    if payload.get("type") != "access":
        logger.warning("Invalid token type used")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id: str = payload.get("sub")
    if user_id is None:
        logger.warning("Token missing subject")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject",
        )

    # Fetch user from database
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        logger.warning(f"User not found: {user_id}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user.is_active or user.deleted_at is not None:
        logger.warning(f"Inactive user attempted access: {user_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive or deleted",
        )

    # Log successful authentication
    logger.info(f"User authenticated: {user.email}")

    return user


async def get_current_active_user(
    user: User = Depends(get_current_user)
) -> User:
    """Alias for get_current_user with explicit active check."""
    return user


def verify_ownership(resource_user_id: str, current_user: User) -> None:
    """
    Verify that the current user owns the resource.
    Raises 403 if not.
    """
    if resource_user_id != current_user.id:
        logger.warning(
            f"Ownership violation: user {current_user.email} "
            f"attempted to access resource owned by {resource_user_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this resource",
        )


# ============================================================================
# AUDIT LOGGING
# ============================================================================

def log_security_event(
    event_type: str,
    user_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    details: Optional[dict] = None
) -> None:
    """
    Log security-relevant events.
    """
    log_data = {
        "event_type": event_type,
        "user_id": user_id,
        "ip_address": ip_address,
        "timestamp": datetime.utcnow().isoformat(),
        "details": details or {},
    }

    if event_type in ["login_failed", "unauthorized_access", "ownership_violation"]:
        logger.warning(f"Security event: {log_data}")
    else:
        logger.info(f"Security event: {log_data}")


# ============================================================================
# RATE LIMITING HELPERS
# ============================================================================

def get_auth_rate_limit_key(request: Request) -> str:
    """Rate limit key for auth endpoints (IP + email)."""
    ip = get_remote_address(request)
    # Try to extract email from request body (for login/register)
    # This is a simplified version; in production, parse the body properly
    return f"auth:{ip}"


def get_api_rate_limit_key(request: Request) -> str:
    """Rate limit key for general API endpoints (IP + user)."""
    ip = get_remote_address(request)
    auth_header = request.headers.get("Authorization")
    if auth_header:
        return f"api:{ip}:{auth_header[:20]}"
    return f"api:{ip}"
