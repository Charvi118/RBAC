/*
Shared module configuration for the RBAC frontend.

Responsibilities:
- define frontend modules in one central place
- define which permission is required for each module
- provide a shared helper for access checks

Security note:
- frontend access checks improve UI behavior only
- backend permission checks remain the real source of authorization
*/

const modules = [
    { name: "Dashboard", page: "dashboard", permission: null },
    { name: "Profile", page: "profile", permission: null },
    { name: "Billing", page: "billing", permission: "billing:update" },
    { name: "User Management", page: "user-management", permission: "user:delete" },
    { name: "Admin Matrix", page: "admin-matrix", permission: "rbac:view" }
];

function canAccess(requiredPermission, userPermissions) {
    /*
    Check whether a user can access a frontend module.

    Args:
        requiredPermission: permission required for the module
        userPermissions: list of effective permissions for the current user

    Returns:
        bool:
            True if no permission is required or the user has the required
            permission. False otherwise.
    */
    if (!requiredPermission) return true;
    return userPermissions.includes(requiredPermission);
}
export { modules, canAccess };