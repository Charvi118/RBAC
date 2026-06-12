"""
FastAPI application entry point for the RBAC backend.

Responsibilities:
- configure the app and middleware
- expose auth, session, profile, and RBAC admin routes
- enforce session-based authentication and permission checks
- validate RBAC write requests and log sensitive RBAC changes

This file must not be responsible for:
- password hashing
- database connection creation
- core permission-resolution SQL

Security note:
- reads and writes authenticated sessions
- protects routes with backend permission checks
- rate-limits login attempts and avoids detailed login failure leaks

Production note:
- in-memory rate limiting resets on restart
- /db-check should stay disabled unless explicitly enabled
- database permission records must match the permission keys used here
"""
import logging
import os
import time
from collections import defaultdict, deque
from contextlib import closing

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware

from app.auth import verify_user
from app.db import get_connection
from app.rbac import check_permission

load_dotenv()

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

session_secret = os.getenv("SESSION_SECRET")
if not session_secret:
    raise RuntimeError("SESSION_SECRET is not set")

enable_db_check = os.getenv("ENABLE_DB_CHECK", "false").lower() == "true"
session_https_only = os.getenv("SESSION_HTTPS_ONLY", "false").lower() == "true"

rate_limit_window_seconds = 60
max_login_attempts = 5
login_attempts = defaultdict(deque)

app = FastAPI(
    title="RBAC Backend",
    description="Role-based access control backend prototype",
    version="1.0.0",
)

app.add_middleware(
    SessionMiddleware,
    secret_key=session_secret,
    same_site="lax",
    https_only=session_https_only,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MessageResponse(BaseModel):
    success: bool
    message: str


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginSuccessResponse(BaseModel):
    success: bool
    message: str
    user_id: int


class SessionCheckResponse(BaseModel):
    logged_in: bool
    user_id: int | None = None


class UserIdResponse(BaseModel):
    user_id: int


class RolePermissionRequest(BaseModel):
    role_id: int
    permission_id: int


class AssignRoleRequest(BaseModel):
    user_id: int
    role_id: int


class RoleOut(BaseModel):
    role_id: int
    role_name: str


class PermissionOut(BaseModel):
    permission_id: int
    permission_key: str


class MappingOut(BaseModel):
    role_id: int
    permission_id: int


class MatrixResponse(BaseModel):
    roles: list[RoleOut]
    permissions: list[PermissionOut]
    mappings: list[MappingOut]


class MeResponse(BaseModel):
    user_id: int
    username: str
    is_active: bool
    roles: list[str]
    permissions: list[str]


class PermissionListResponse(BaseModel):
    permissions: list[str]


def cleanup_attempts(bucket: deque, now: float) -> None:
    """
    Remove expired login-attempt timestamps from a rate-limit bucket.

    Args:
        bucket: deque containing prior attempt timestamps
        now: current unix timestamp
    """
    while bucket and now - bucket[0] > rate_limit_window_seconds:
        bucket.popleft()


def is_rate_limited(key: str) -> bool:
    """
    Check whether a login identity is currently rate limited.

    Args:
        key: unique rate-limit key, typically based on ip and username

    Returns:
        bool: True when the identity has exceeded the allowed attempts
        within the current time window.
    """
    now = time.time()
    bucket = login_attempts[key]
    cleanup_attempts(bucket, now)
    return len(bucket) >= max_login_attempts


def record_failed_attempt(key: str) -> None:
    """
    Store a failed login attempt for rate-limiting purposes.

    Args:
        key: unique rate-limit key, typically based on ip and username
    """
    now = time.time()
    bucket = login_attempts[key]
    cleanup_attempts(bucket, now)
    bucket.append(now)


def clear_failed_attempts(key: str) -> None:
    """
    Clear stored failed login attempts after a successful login.

    Args:
        key: unique rate-limit key, typically based on ip and username
    """
    login_attempts.pop(key, None)


def get_current_user_id(request: Request) -> int:
    """
    Return the authenticated user id from the current session.

    Args:
        request: FastAPI request object

    Returns:
        int: authenticated user id stored in the session

    Raises:
        HTTPException: 401 when no authenticated session exists

    Security note:
        This is the central session-based authentication dependency used by
        protected routes.
    """
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Login needed")
    return user_id


def require_permission(required_permission: str):
    """
    Build a FastAPI dependency that requires a specific permission.

    Args:
        required_permission: permission key required to access the route,
            for example rbac:view or billing:update

    Returns:
        callable: dependency function that returns the authenticated user id

    Raises:
        HTTPException: 403 when the authenticated user lacks the permission

    Security note:
        This dependency enforces backend authorization and must not be replaced
        by frontend-only hiding of UI elements.
    """

    def dependency(user_id: int = Depends(get_current_user_id)) -> int:
        if not check_permission(user_id, required_permission):
            raise HTTPException(status_code=403, detail="Access denied")
        return user_id

    return dependency


def ensure_role_exists(cur, role_id: int) -> None:
    """
    Ensure a role id exists before writing RBAC changes.

    Args:
        cur: active database cursor
        role_id: target role id

    Raises:
        HTTPException: 404 when the role does not exist
    """
    cur.execute("select 1 from roles where role_id = %s", (role_id,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Role not found")


def ensure_permission_exists(cur, permission_id: int) -> None:
    """
    Ensure a permission id exists before writing RBAC changes.

    Args:
        cur: active database cursor
        permission_id: target permission id

    Raises:
        HTTPException: 404 when the permission does not exist
    """
    cur.execute(
        "select 1 from permissions where permission_id = %s", (permission_id,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Permission not found")


def ensure_user_exists(cur, user_id: int) -> None:
    """
    Ensure a user id exists before assigning roles.

    Args:
        cur: active database cursor
        user_id: target user id

    Raises:
        HTTPException: 404 when the user does not exist
    """
    cur.execute("select 1 from users where user_id = %s", (user_id,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="User not found")


@app.get("/", tags=["system"])
def home():
    """
    Return a simple health message for the backend root route.

    Returns:
        dict: backend status message
    """
    return {"message": "RBAC backend is running."}


@app.get("/db-check", tags=["system"])
def db_check(user_id: int = Depends(get_current_user_id)):
    """
    Check database connectivity when the feature is explicitly enabled.

    Args:
        user_id: authenticated user id from session dependency

    Returns:
        dict: database connectivity message and current user id

    Raises:
        HTTPException: 404 when db-check is disabled

    Security note:
        This route is for debugging and should stay disabled in production
        unless deliberately enabled.
    """
    if not enable_db_check:
        raise HTTPException(status_code=404, detail="Not found")

    with closing(get_connection()) as conn:
        return {"message": "Database connection successful.", "user_id": user_id}


@app.post("/login", tags=["auth"], response_model=LoginSuccessResponse)
def login(data: LoginRequest, request: Request):
    """
    Authenticate a user and create a session.

    Args:
        data: login request body containing username and password
        request: FastAPI request object used to create the session

    Returns:
        LoginSuccessResponse: successful login response with user id

    Raises:
        HTTPException:
            401 when credentials are invalid or the user is inactive
            429 when too many login attempts occur in the current time window

    Security note:
        This route uses session-based authentication, avoids exposing the
        exact reason for login failure, and rate-limits repeated attempts.

    Production note:
        Rate limiting is in-memory and should be replaced with a shared
        store for multi-instance deployments.
    """
    client_ip = request.client.host if request.client else "unknown"
    rate_limit_key = f"{client_ip}:{data.username.lower()}"

    if is_rate_limited(rate_limit_key):
        logger.warning("login_rate_limited username=%s ip=%s",
                       data.username, client_ip)
        raise HTTPException(
            status_code=429, detail="Too many login attempts. Try again later.")

    user_id = verify_user(data.username, data.password)
    if user_id is None:
        record_failed_attempt(rate_limit_key)
        logger.warning("login_failed username=%s ip=%s",
                       data.username, client_ip)
        raise HTTPException(
            status_code=401, detail="Invalid credentials or inactive user.")

    clear_failed_attempts(rate_limit_key)
    request.session["user_id"] = user_id
    return {"success": True, "message": "Logged in", "user_id": user_id}


@app.get("/session_check", tags=["auth"], response_model=SessionCheckResponse)
def session_check(request: Request):
    """
    Check whether the current request has an active authenticated session.

    Args:
        request: FastAPI request object

    Returns:
        SessionCheckResponse: session status and optional user id
    """
    user_id = request.session.get("user_id")
    if not user_id:
        return {"logged_in": False}
    return {"logged_in": True, "user_id": user_id}


@app.post("/logout", tags=["auth"], response_model=MessageResponse)
def logout(request: Request):
    """
    Clear the current authenticated session.

    Args:
        request: FastAPI request object

    Returns:
        MessageResponse: logout confirmation message

    Security note:
        This clears only the current browser session.
    """
    request.session.clear()
    return {"success": True, "message": "Logged out"}


@app.get("/dashboard", tags=["app"], response_model=UserIdResponse)
def dashboard(user_id: int = Depends(get_current_user_id)):
    """
    Return a simple authenticated dashboard response.

    Args:
        user_id: authenticated user id from session dependency

    Returns:
        UserIdResponse: authenticated user id
    """
    return {"user_id": user_id}


@app.get("/billing", tags=["app"], response_model=UserIdResponse)
def billing(user_id: int = Depends(require_permission("billing:update"))):
    """
    Check access to the billing module.

    Args:
        user_id: authenticated user id with the required permission

    Returns:
        UserIdResponse: authenticated user id

    Security note:
        This route is protected by the billing:update permission.
    """
    return {"user_id": user_id}


@app.get("/delete-user", tags=["app"])
def delete_user_access_check(user_id: int = Depends(require_permission("user:delete"))):
    """
    Check access to the user management module.

    Args:
        user_id: authenticated user id with the required permission

    Returns:
        dict: access confirmation message and current user id

    Security note:
        This route does not actually delete users. It only confirms access
        to the user-management module.
    """
    return {"message": "Delete user page allowed", "user_id": user_id}


@app.get("/admin/matrix", tags=["rbac"], response_model=MatrixResponse)
def admin_matrix(user_id: int = Depends(require_permission("rbac:view"))):
    """
    Return the RBAC role-permission matrix.

    Args:
        user_id: authenticated user id with rbac:view permission

    Returns:
        MatrixResponse: roles, permissions, and role-permission mappings

    Security note:
        RBAC viewing is protected by a dedicated permission instead of
        reusing user deletion permissions.
    """
    with closing(get_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select role_id, role_name from roles order by role_id")
            roles = [{"role_id": r[0], "role_name": r[1]}
                     for r in cur.fetchall()]

            cur.execute(
                "select permission_id, permission_key from permissions order by permission_id")
            permissions = [{"permission_id": p[0], "permission_key": p[1]}
                           for p in cur.fetchall()]

            cur.execute("select role_id, permission_id from role_permissions")
            mappings = [{"role_id": m[0], "permission_id": m[1]}
                        for m in cur.fetchall()]

    logger.info("rbac_matrix_viewed actor_user_id=%s", user_id)

    return {
        "roles": roles,
        "permissions": permissions,
        "mappings": mappings,
    }


@app.post("/admin/role-permission", tags=["rbac"], response_model=MessageResponse)
def add_role_permission(
    data: RolePermissionRequest,
    user_id: int = Depends(require_permission("rbac:manage")),
):
    """
    Add a permission to a role.

    Args:
        data: request body containing role_id and permission_id
        user_id: authenticated user id with rbac:manage permission

    Returns:
        MessageResponse: mapping creation confirmation message

    Raises:
        HTTPException: 404 when role_id or permission_id does not exist

    Security note:
        This route changes authorization behavior and is audit logged.

    Production note:
        The write is wrapped in a transaction and rolls back on failure.
    """
    with closing(get_connection()) as conn:
        try:
            with conn.cursor() as cur:
                ensure_role_exists(cur, data.role_id)
                ensure_permission_exists(cur, data.permission_id)

                cur.execute(
                    """
                    insert into role_permissions (role_id, permission_id)
                    values (%s, %s)
                    on conflict do nothing
                    """,
                    (data.role_id, data.permission_id),
                )
            conn.commit()
        except Exception:
            conn.rollback()
            raise

    logger.info(
        "rbac_mapping_added actor_user_id=%s role_id=%s permission_id=%s",
        user_id,
        data.role_id,
        data.permission_id,
    )

    return {"success": True, "message": "Mapping added"}


@app.delete("/admin/role-permission", tags=["rbac"], response_model=MessageResponse)
def delete_role_permission(
    data: RolePermissionRequest,
    user_id: int = Depends(require_permission("rbac:manage")),
):
    """
    Remove a permission from a role.

    Args:
        data: request body containing role_id and permission_id
        user_id: authenticated user id with rbac:manage permission

    Returns:
        MessageResponse: mapping deletion confirmation message

    Raises:
        HTTPException:
            404 when role_id or permission_id does not exist
            400 when attempting to remove the locked SUPER_ADMIN mapping

    Security note:
        This route changes authorization behavior and is audit logged.
    """
    with closing(get_connection()) as conn:
        try:
            with conn.cursor() as cur:
                ensure_role_exists(cur, data.role_id)
                ensure_permission_exists(cur, data.permission_id)

                cur.execute(
                    "select role_name from roles where role_id = %s", (data.role_id,))
                role_row = cur.fetchone()

                cur.execute(
                    "select permission_key from permissions where permission_id = %s", (data.permission_id,))
                perm_row = cur.fetchone()

                if role_row and perm_row and role_row[0] == "SUPER_ADMIN" and perm_row[0] == "user:delete":
                    raise HTTPException(
                        status_code=400,
                        detail="cannot remove locked SUPER_ADMIN permission",
                    )

                cur.execute(
                    """
                    delete from role_permissions
                    where role_id = %s and permission_id = %s
                    """,
                    (data.role_id, data.permission_id),
                )
            conn.commit()
        except Exception:
            conn.rollback()
            raise

    logger.info(
        "rbac_mapping_deleted actor_user_id=%s role_id=%s permission_id=%s",
        user_id,
        data.role_id,
        data.permission_id,
    )

    return {"success": True, "message": "Mapping deleted"}


@app.post("/admin/assign-role", tags=["rbac"], response_model=MessageResponse)
def assign_role_to_user(
    data: AssignRoleRequest,
    user_id: int = Depends(require_permission("rbac:manage")),
):
    """
    Assign a role to a user.

    Args:
        data: request body containing user_id and role_id
        user_id: authenticated user id with rbac:manage permission

    Returns:
        MessageResponse: role-assignment confirmation message

    Raises:
        HTTPException: 404 when user_id or role_id does not exist

    Security note:
        This route changes a user's access level and is audit logged.
    """
    with closing(get_connection()) as conn:
        try:
            with conn.cursor() as cur:
                ensure_role_exists(cur, data.role_id)
                ensure_user_exists(cur, data.user_id)

                cur.execute(
                    """
                    insert into user_roles (user_id, role_id)
                    values (%s, %s)
                    on conflict do nothing
                    """,
                    (data.user_id, data.role_id),
                )
            conn.commit()
        except Exception:
            conn.rollback()
            raise

    logger.info(
        "user_role_assigned actor_user_id=%s target_user_id=%s role_id=%s",
        user_id,
        data.user_id,
        data.role_id,
    )

    return {"success": True, "message": "Role assigned to user"}


@app.get("/me", tags=["auth"], response_model=MeResponse)
def get_me(user_id: int = Depends(get_current_user_id)):
    """
    Return the current authenticated user's profile, roles, and permissions.

    Args:
        user_id: authenticated user id from session dependency

    Returns:
        MeResponse: current user's identity and effective access profile

    Raises:
        HTTPException: 404 when the user record no longer exists

    Security note:
        This route only returns data for the active session owner.
    """
    with closing(get_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select user_id, username, is_active from users where user_id = %s",
                (user_id,),
            )
            user_row = cur.fetchone()

            if not user_row:
                raise HTTPException(status_code=404, detail="User not found")

            cur.execute(
                """
                select r.role_name
                from user_roles ur
                join roles r on ur.role_id = r.role_id
                where ur.user_id = %s
                order by r.role_name
                """,
                (user_id,),
            )
            roles = [row[0] for row in cur.fetchall()]

            cur.execute(
                """
                select distinct p.permission_key
                from user_roles ur
                join role_permissions rp on ur.role_id = rp.role_id
                join permissions p on rp.permission_id = p.permission_id
                where ur.user_id = %s
                order by p.permission_key
                """,
                (user_id,),
            )
            permissions = [row[0] for row in cur.fetchall()]

    return {
        "user_id": user_row[0],
        "username": user_row[1],
        "is_active": user_row[2],
        "roles": roles,
        "permissions": permissions,
    }


@app.get("/me/permissions", tags=["auth"], response_model=PermissionListResponse)
def get_my_permissions(user_id: int = Depends(get_current_user_id)):
    """
    Return only the current authenticated user's effective permissions.

    Args:
        user_id: authenticated user id from session dependency

    Returns:
        PermissionListResponse: current user's permission keys

    Security note:
        This route exposes only the active session owner's permissions.
    """
    with closing(get_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select distinct p.permission_key
                from user_roles ur
                join role_permissions rp on ur.role_id = rp.role_id
                join permissions p on rp.permission_id = p.permission_id
                where ur.user_id = %s
                order by p.permission_key
                """,
                (user_id,),
            )
            permissions = [row[0] for row in cur.fetchall()]

    return {"permissions": permissions}
