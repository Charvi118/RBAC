/*
Admin RBAC Matrix page for the frontend.

Responsibilities:
- load the role-permission matrix from the backend
- render roles as rows and permissions as columns
- show checked checkboxes when a role-permission mapping exists
- add a mapping when a checkbox is checked
- remove a mapping when a checkbox is unchecked
- protect the locked SUPER_ADMIN and user:delete mapping
- redirect unauthenticated and unauthorized users correctly

RBAC behavior:
- access to this page currently requires the rbac:view permission
- updating mappings requires rbac:manage on the backend
- the SUPER_ADMIN and user:delete mapping is hard-locked in the UI
*/
import { useEffect, useState } from "react";
import { apiFetch } from "../api";

export default function AdminMatrixPage({ setCurrentPage, setDeniedPermission }) {
    /*
    Renders the Admin RBAC Matrix page.

    Props:
        setCurrentPage (function):
            used for frontend page navigation
        setDeniedPermission (function):
            stores the missing permission before redirecting
            to the Access Denied page

    Behavior:
        - calls get /admin/matrix when the page loads
        - redirects unauthenticated users to Login
        - redirects unauthorized users to Access Denied
        - uses post /admin/role-permission to add mappings
        - uses delete /admin/role-permission to remove mappings
        - refreshes the matrix after each successful change

    Returns:
        JSX.Element:
            a styled RBAC matrix table with interactive permission checkboxes
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
                setDeniedPermission("rbac:view");
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
        return roleName === "SUPER_ADMIN" && permissionKey === "user:delete";
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
                setDeniedPermission("rbac:manage");
                setCurrentPage("access-denied");
                return;
            }

            setMessage("Could not update permission");
        }
    };

    const formatPermissionLabel = (permissionKey) => {
        return permissionKey
            .replace(":", " ")
            .replace("_", " ")
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
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

            <h1
                style={{
                    fontSize: "40px",
                    color: "#3f3127",
                    marginBottom: "8px"
                }}
            >
                Admin RBAC Matrix
            </h1>
            {message && <p>{message}</p>}

            {matrix && (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        marginTop: "24px"
                    }}
                >
                    <div
                        style={{
                            backgroundColor: "#ffffff",
                            padding: "18px",
                            borderRadius: "18px",
                            boxShadow: "0 10px 28px rgba(92, 74, 58, 0.10)",
                            overflowX: "auto",
                            maxWidth: "100%"
                        }}
                    >
                        <table
                            style={{
                                borderCollapse: "collapse",
                                minWidth: "980px",
                                fontSize: "18px"
                            }}
                        >
                            <thead>
                                <tr style={{ backgroundColor: "#9c7b63", color: "#ffffff" }}>
                                    <th
                                        style={{
                                            padding: "16px 18px",
                                            textAlign: "left",
                                            border: "1px solid #d8cbbd"
                                        }}
                                    >
                                        Role / Permission
                                    </th>

                                    {matrix.permissions.map((permission) => (
                                        <th
                                            key={permission.permission_id}
                                            style={{
                                                padding: "16px 18px",
                                                textAlign: "center",
                                                border: "1px solid #d8cbbd",
                                                minWidth: "140px"
                                            }}
                                        >
                                            {formatPermissionLabel(permission.permission_key)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            <tbody>
                                {matrix.roles.map((role, rowIndex) => (
                                    <tr
                                        key={role.role_id}
                                        style={{
                                            backgroundColor: rowIndex % 2 === 0 ? "#fcfaf7" : "#f8f2eb"
                                        }}
                                    >
                                        <td
                                            style={{
                                                fontWeight: "600",
                                                padding: "14px 18px",
                                                border: "1px solid #d8cbbd"
                                            }}
                                        >
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
                                                    style={{
                                                        textAlign: "center",
                                                        padding: "14px 18px",
                                                        border: "1px solid #d8cbbd"
                                                    }}
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
                                                        style={{
                                                            transform: "scale(1.2)",
                                                            cursor: "pointer"
                                                        }}
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}