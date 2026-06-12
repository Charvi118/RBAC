"""
Role Based Access Control helper module.

Responsibilities:
- Check whether a user has a required permission.
- Resolve permissions through the user -> role -> permission relationship.
- Ensure inactive users are denied access.

Authorization rule:
A user is allowed access only if:
1. The user exists
2. The user is active
3. The user has at least one role
4. One of the user's roles contains the required permission

Security notes:
- This module performs backend authorization checks.
- Frontend permission hiding must never replace backend enforcement.
- Permission-denied attempts should be logged before production.

Production notes:
- Use select exists for yes/no permission checks.
- Add safer connection cleanup before production if needed.
"""
from app.db import get_connection


def check_permission(user_id: int, required_permission: str) -> bool:
    """
    Check whether a user has the required permission.

    Args:
        user_id (int): ID of the logged-in user.
        required_permission (str): Permission key required for the operation.

    Returns:
        bool:
            True if the user is active and has the required permission
            through at least one assigned role. False otherwise.

    Security note:
        This function must be called by all protected backend routes.
        Do not rely only on frontend UI restrictions.
    """
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        select exists(
            select 1
            from users u
            join user_roles ur on u.user_id = ur.user_id
            join roles r on ur.role_id = r.role_id
            join role_permissions rp on r.role_id = rp.role_id
            join permissions p on rp.permission_id = p.permission_id
            where u.user_id = %s
            and u.is_active = true
            and p.permission_key = %s
        )
        """,
        (user_id, required_permission),
    )

    allowed = cur.fetchone()[0]
    cur.close()
    conn.close()
    return allowed
