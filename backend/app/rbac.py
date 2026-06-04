from app.db import get_connection


def check_permission(user_id: int, required_permission: str) -> bool:
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        select count(1)
        from users u
        join user_roles ur on u.user_id = ur.user_id
        join roles r on ur.role_id = r.role_id
        join role_permissions rp on r.role_id = rp.role_id
        join permissions p on rp.permission_id = p.permission_id
        where u.user_id = %s
        and u.is_active = TRUE
        and p.permission_key = %s
        """,
        (user_id, required_permission),
    )

    count = cur.fetchone()[0]
    cur.close()
    conn.close()
    return count >= 1
