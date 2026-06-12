"""
Authentication helper module for the RBAC backend.

Responsibilities:
- verify user login credentials
- fetch stored password hash and active status from the database
- return user_id when authentication succeeds

This file must not be responsible for:
- creating sessions
- handling API responses
- deciding route-level permissions

Security note:
- passwords must never be stored in plaintext
- plaintext passwords must never be logged
- failed login should not expose the exact failure reason

Production note:
- login rate limiting and audit logging should be handled by the route layer
"""
from passlib.context import CryptContext

from app.db import get_connection

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_user(username: str, password: str):
    """
    Verify a user's login credentials.

    Args:
        username: username submitted by the user
        password: plaintext password submitted during login

    Returns:
        int | None:
            authenticated user_id when the username exists, the password is
            valid, and the user is active; otherwise None

    Security note:
        This function uses bcrypt verification and does not reveal the exact
        reason for login failure.
    """
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "select user_id, password_hash, is_active from users where username = %s",
        (username,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        return None

    user_id, password_hash, is_active = row
    if pwd_context.verify(password, password_hash) and is_active:
        return user_id

    return None
