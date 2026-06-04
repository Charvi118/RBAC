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
    username: str
    password: str


class RolePermissionRequest(BaseModel):
    role_id: int
    permission_id: int


class AssignRoleRequest(BaseModel):
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
    user_id = verify_user(data.username, data.password)
    if user_id is None:
        return {"success": False, "message": "Invalid credentials or inactive user."}

    request.session["user_id"] = user_id
    return {"success": True, "message": "Logged in", "user_id": user_id}


@app.get("/session_check")
def session_check(request: Request):
    user_id = request.session.get("user_id")
    if not user_id:
        return {"logged_in": False}
    return {"logged_in": True, "user_id": user_id}


@app.post("/logout")
def logout(request: Request):
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
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Login needed")
    if not check_permission(user_id, "update_billing"):
        raise HTTPException(status_code=403, detail="Access denied")
    return {"user_id": user_id}


@app.get("/delete-user")
def delete_user(request: Request):
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Login needed")
    if not check_permission(user_id, "delete_user"):
        raise HTTPException(status_code=403, detail="Access denied")
    return {"message": "Delete user page allowed", "user_id": user_id}


@app.get("/admin/matrix")
def admin_matrix(request: Request):
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
