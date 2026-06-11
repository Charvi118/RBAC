const modules = [
    { name: "Dashboard", page: "dashboard", permission: null },
    { name: "Profile", page: "profile", permission: null },
    { name: "Billing", page: "billing", permission: "update_billing" },
    { name: "User Management", page: "user-management", permission: "delete_user" },
    { name: "Admin Matrix", page: "admin-matrix", permission: "delete_user" }
];

function canAccess(requiredPermission, userPermissions) {
    if (!requiredPermission) return true;
    return userPermissions.includes(requiredPermission);
}

export { modules, canAccess };