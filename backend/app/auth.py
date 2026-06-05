"""
Authentication helper module for the RBAC backend. 

Responsibilities:
- Verify user credentials during login.
- Fetch user password hash and active status from the database.
- Validate password using bcrypt through passlib.
- Return the authenticated user's user_id when login is successful. 

Security notes:
- Passwords must never be stored in plaintext. 
- Plain text passwords must never be logged. 
- Login failures must not reveal whether the username, passoword, or active status caused failure.
- Failed login attempts should be rate-limited and audited before production. 
"""
from app.db import get_connection
from passlib.context import CryptContext


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_user(username: str, password: str):
    """
    Verifies a user's login credentials.

    Args:
        username (str): Username submitted by the user.
        password (str): Plain text password submitted during login.

    Returns:
        int|None:
            Returns user_id if the username exists, password is valid, and
            the user is active. Returns None otherwise.

    Security behavior:
        - Uses bcrypt password verification through passlib.
        - Does not authenticate inactive users.
        - Does not expose the exact login failure reason.
    """

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT user_id, password_hash, is_active FROM users WHERE username = %s",
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
