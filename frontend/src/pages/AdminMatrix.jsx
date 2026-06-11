/*
Admin RBAC Matrix page for the frontend.

Responsibilities:
- Load the role-permission matrix from the backend.
- Render roles as rows and permissions as columns.
- Show checked checkboxes when a role-permission mapping exists.
- Add a mapping when a checkbox is checked.
- Remove a mapping when a checkbox is unchecked.
- Protect the locked SUPER_ADMIN and delete_user mapping.
- Redirect unauthenticated and unauthorized users correctly.

RBAC behavior:
- Access to this page currently requires the delete_user permission.
- The SUPER_ADMIN and delete_user mapping is hard-locked in the UI.
*/
import { useEffect, useState } from "react";
import { apiFetch } from "../api";

export default function AdminMatrixPage({ setCurrentPage, setDeniedPermission }) {
    /*
    Renders the Admin RBAC Matrix page.

    Props:
        setCurrentPage (function):
            Used for frontend page navigation.
        setDeniedPermission (function):
            Stores the missing permission before redirecting
            to the Access Denied page.

    Behavior:
        - Calls GET /admin/matrix when the page loads.
        - Redirects unauthenticated users to Login.
        - Redirects unauthorized users to Access Denied.
        - Uses POST /admin/role-permission to add mappings.
        - Uses DELETE /admin/role-permission to remove mappings.
        - Refreshes the matrix after each successful change.

    Returns:
        JSX.Element:
            A styled RBAC matrix table with interactive permission checkboxes.
    */
    const [matrix, setMatrix] = useState(null);
    const [message, setMessage] = useState("Loading admin matrix...");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadMatrix();
    }, []);

    const loadMatrix = async () => {
        try {
            const data = await apiFetch("/admin/matrix", {
                method: "GET"
            });

            setMatrix(data);
            setMessage("");
        } catch (error) {
            if (error.message === "UNAUTHENTICATED") {
                setCurrentPage("login");
                return;
            }

            if (error.message === "FORBIDDEN") {
                setDeniedPermission("delete_user");
                setCurrentPage("access-denied");
                return;
            }

            setMessage("Could not load matrix");
        } finally {
            setLoading(false);
        }
    };

    const hasPermission = (roleId, permissionId, mappings) => {
        return mappings.some(
            (mapping) =>
                mapping.role_id === roleId &&
                mapping.permission_id === permissionId
        );
    };

    const isLockedCell = (roleName, permissionKey) => {
        return roleName === "SUPER_ADMIN" && permissionKey === "delete_user";
    };

    const togglePermission = async (roleId, permissionId, alreadyChecked) => {
        try {
            await apiFetch("/admin/role-permission", {
                method: alreadyChecked ? "DELETE" : "POST",
                body: JSON.stringify({
                    role_id: roleId,
                    permission_id: permissionId
                })
            });

            await loadMatrix();
        } catch (error) {
            if (error.message === "UNAUTHENTICATED") {
                setCurrentPage("login");
                return;
            }

            if (error.message === "FORBIDDEN") {
                setDeniedPermission("delete_user");
                setCurrentPage("access-denied");
                return;
            }

            setMessage("Could not update permission");
        }
    };

    if (loading) {
        return <p>Loading admin matrix...</p>;
    }

    return (
        <div style={{ padding: "30px" }}>
            <button
                onClick={() => setCurrentPage("dashboard")}
                style={{
                    marginBottom: "20px",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid #d8cbbd",
                    backgroundColor: "#ffffff",
                    cursor: "pointer"
                }}
            >
                ← Back
            </button>

            <h1>Admin RBAC Matrix</h1>
            <p style={{ color: "#6b5747", marginTop: "8px", marginBottom: "20px" }}>
                Manage which permissions are assigned to each role.
            </p>

            {message && <p>{message}</p>}

            {matrix && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: "24px" }}>
                    <table
                        border="1"
                        cellPadding="12"
                        style={{
                            borderCollapse: "collapse",
                            backgroundColor: "#ffffff",
                            minWidth: "700px",
                            boxShadow: "0 8px 24px rgba(92, 74, 58, 0.08)",
                            border: "1px solid #d8cbbd"
                        }}
                    >
                        <thead>
                            <tr style={{ backgroundColor: "#9c7b63", color: "#ffffff" }}>
                                <th>Role / Permission</th>
                                {matrix.permissions.map((permission) => (
                                    <th key={permission.permission_id}>
                                        {permission.permission_key}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody>
                            {matrix.roles.map((role) => (
                                <tr key={role.role_id}>
                                    <td style={{ fontWeight: "600", backgroundColor: "#f8f2eb" }}>
                                        {role.role_name}
                                    </td>

                                    {matrix.permissions.map((permission) => {
                                        const checked = hasPermission(
                                            role.role_id,
                                            permission.permission_id,
                                            matrix.mappings
                                        );

                                        return (
                                            <td
                                                key={permission.permission_id}
                                                style={{ textAlign: "center" }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    disabled={isLockedCell(role.role_name, permission.permission_key)}
                                                    onChange={() =>
                                                        togglePermission(
                                                            role.role_id,
                                                            permission.permission_id,
                                                            checked
                                                        )
                                                    }
                                                />
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}