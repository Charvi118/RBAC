"""
FastAPI applications entry point for the RBAC backend.

Responsibilities:
- Configure the FastAPI application.
- Configure session middleware.
- Configure CORS for frontend access.
- Expose login, logout, and session-check endpoints.
- Expose protected business routes.
- Expose admin RBAC matrix and role-permission management endpoints.

Authentication:
- User logs in through POST /login.
- On successful login, user_id is stored in the session.
- Protected routes read user_id from the session.

Authorization:
- Protected routes call check_permission() before allowing access.
- Missing session returns 401.
- Missing permission returns 403.

Known security issues:
- Session secret must not be hardcoded.
- Admin RBAC routes should not use delete_user permission.
- Login should return HTTP 401 for invalid credentials.
- Login should be rate-limited before production.
- /db-check should be disabled in production.
"""
from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware
from app.db import get_connection
from app.auth import verify_user
from app.rbac import check_permission
from fastapi.middleware.cors import CORSMiddleware
app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key="secretkey")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173",
                   "http://127.0.0.1:5173"],

    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LoginRequest(BaseModel):
    """
    Request body for user login.    


password: Plain-text password submitted by the user.
    Security note:
        Password must only be used for verification and must never be logged.
    """
    username: str
    password: str
    

class RolePermissionRequest(BaseModel):
    """
    Request body for assigning or removing a permission from a role.
    Fields:
        role_id: Target role ID.
        permission_id: Target permission ID.

    Security note:
        Changing role-permission mappings changes authorization behavior
        and must be audit logged before production.
    """
    role_id: int
    permission_id: int


class AssignRoleRequest(BaseModel):
    """
    Request body for assigning a role to a user.
    Fields:
        user_id: Target user ID.
        role_id: Role ID to be assigned to the user.

    Security note:
        Assigning roles changes to user's access level and should be
        restricted to authorized administrators only.
    """
    user_id: int
    role_id: int


@app.get("/")
def home():
    return {"RBAC backend is running."}


@app.get("/db-check")
def db_check():
    conn = get_connection()
    conn.close()
    return {"Database connection successful."}


@app.post("/login")
def login(data: LoginRequest, request: Request):
    """
    Authenticate a user and create a session.

    On success:
        - Stores user_id in the session.
        - Returns login success response.

    On failure:
        - Returns logic failure response.
        - Recommended: Raise HTTP 401 instead of returning success=False.

    Security note:
        Login should be rate-limited and failed attempts should be audited.
    """
    user_id = verify_user(data.username, data.password)
    if user_id is None:
        return {"success": False, "message": "Invalid credentials or inactive user."}

    request.session["user_id"] = user_id
    return {"success": True, "message": "Logged in", "user_id": user_id}


@app.get("/session_check")
def session_check(request: Request):
    """
    Check whether the current request has an active user session.

    Returns:
        dict:
            logged_in = False when no user_id exists in session.
            logged_in = True and user_id when session exists.
    
    Frontend use:
        Used by the UI to determine whether the user is currently logged in.
    """
    user_id = request.session.get("user_id")
    if not user_id:
        return {"logged_in": False}
    return {"logged_in": True, "user_id": user_id}


@app.post("/logout")
def logout(request: Request):
    """
    Clear the user session and log the user out.

    Security note:
        This clears only the current session.
        It does not revoke other sessions or tokens.
    """
    request.session.clear()
    return {"success": True, "message": "Logged out"}


@app.get("/dashboard")
def dashboard(request: Request):
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Login")
    return {"user_id": user_id}


@app.get("/billing")
def billing(request: Request):
    """
    Protected billing route.

    Current permission:
        update_billing

    Recommended permission:
        billing:view for GET access.
        billing:update should be reserved for modifying billing data.
    
    """
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Login needed")
    if not check_permission(user_id, "update_billing"):
        raise HTTPException(status_code=403, detail="Access denied")
    return {"user_id": user_id}


@app.get("/delete-user")
def delete_user(request: Request):
    """
    Protected user deletion access-check route.

    Current behavior:
        Does not delete a user.
        Only confirms that the user has delete_user permission.
    
    Recommended change:
        Rename this route if it is only an access  check.
        Use DELETE /admin/users/{user_id} for actual deletion.
    
    """
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Login needed")
    if not check_permission(user_id, "delete_user"):
        raise HTTPException(status_code=403, detail="Access denied")
    return {"message": "Delete user page allowed", "user_id": user_id}


@app.get("/admin/matrix")
def admin_matrix(request: Request):
    """
      Return the RBAC role-permission matrix.

      Response includes:
         - Role
         - Permissions
         - Role-permission mappings

       Current permission:
         - delete_user

       Recommended permission:
         - rbac:view

       Security note:
           Viewing RBAC configuration should have its own permission.
    """
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Login needed")
    if not check_permission(user_id, "delete_user"):
        raise HTTPException(status_code=403, detail="Access denied")
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT role_id, role_name from roles order by role_id")
    roles = [{"role_id": r[0], "role_name": r[1]} for r in cur.fetchall()]

    cur.execute(
        "select permission_id, permission_key from permissions order by permission_id")
    permissions = [{"permission_id": p[0], "permission_key": p[1]}
                   for p in cur.fetchall()]

    cur.execute("select role_id, permission_id from role_permissions")
    mappings = [{"role_id": m[0], "permission_id": m[1]}
                for m in cur.fetchall()]

    cur.close()
    conn.close()

    return {
        "roles": roles,
        "permissions": permissions,
        "mappings": mappings
    }


@app.post("/admin/role-permission")
def add_role_permission(data: RolePermissionRequest, request: Request):
    """
    Add a permission to a role.

    Request body:
        role_id: ID of the target role.
        permission_id: ID of the permission to assign.

    Current permission:
        delete_user
         
    Recommended permission:
        rbac:manage

    Security note:
        This action changes authorization behavior and must be audit logged.
    """
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Login needed")
    if not check_permission(user_id, "delete_user"):
        raise HTTPException(status_code=403, detail="Access denied")

    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        insert into role_permissions (role_id,permission_id) values (%s, %s) on conflict do nothing
""",
        (data.role_id, data.permission_id),
    )
    conn.commit()
    cur.close()
    conn.close()

    return {"success": True, "message": "Mapping added"}


@app.delete("/admin/role-permission")
def delete_role_permission(data: RolePermissionRequest, request: Request):
    """
    Remove a permission from a role.

    Request body:
        role_id: ID of the target role.
        permission_id: ID of the permission to remove.
    
    Current permission:
        delete_user

    Recommended permission:
        rbac:manage

    Security note:
        This action changes authorization behavior and must be audit logged.
    """
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Login needed")
    if not check_permission(user_id, "delete_user"):
        raise HTTPException(status_code=403, detail="Access denied")

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("select role_name from roles where role_id=%s",
                (data.role_id,))
    role_row = cur.fetchone()

    cur.execute(
        "select permission_key from permissions where permission_id=%s", (data.permission_id,))
    perm_row = cur.fetchone()

    if role_row and perm_row and role_row[0] == "SUPER_ADMIN" and perm_row[0] == "delete_user":
        cur.close()
        conn.close()
        raise HTTPException(
            status_code=400, detail="cannot remove locked SUPER_ADMIN permission")

    cur.execute(
        """
        delete from role_permissions
        where role_id = %s and permission_id = %s
        """,
        (data.role_id, data.permission_id)
    )
    conn.commit()
    cur.close()
    conn.close()

    return {"success": True, "message": "Mapping deleted"}


@app.post("/admin/assign-role")
def assign_role_to_user(data: AssignRoleRequest, request: Request):
    """
    Assign a role to a user.

    Request body:
        user_id: ID of the target user.
        role_id: ID of the role to assign.

    Current permission:
        delete_user
    
    Recommended permission:
        rbac:manage

    Security note:
        This action changes user access levels and should be restricted to 
        authorized administrators. Role assignments should be audit
        logged before productionuse.
    """
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Login needed")
    if not check_permission(user_id, "delete_user"):
        raise HTTPException(status_code=403, detail="Access denied")

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("select 1 from roles where role_id=%s", (data.role_id,))
    if not cur.fetchone():
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Role not found")

    cur.execute("select 1 from users where user_id= %s", (data.user_id,))
    if not cur.fetchone():
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    cur.execute(
        """
        insert into user_roles(user_id, role_id) values (%s, %s) on conflict do nothing
        """, (data.user_id, data.role_id),
    )
    conn.commit()
    cur.close()
    conn.close()

    return {"success": True, "message": "Role assigned to user"}
