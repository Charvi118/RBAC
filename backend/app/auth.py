from app.db import get_connection
from passlib.context import CryptContext


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_user(username: str, password: str):
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
