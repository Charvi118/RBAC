/*
User Management page for the RBAC frontend.

Responsibilities:
- Check whether the logged-in user can access the user management module.
- Call the backend protected route when the page opens.
- Redirect unauthenticated users to the Login page.
- Redirect unauthorized users to the Access Denied page with the required permission.
- Show a success message when access is granted.

Current scope:
- This page checks access only.
- Actual delete-user functionality is not implemented yet.
*/
import { useEffect, useState } from "react";
import { apiFetch } from "../api";

export default function UserManagementPage({ setCurrentPage, setDeniedPermission }) {
    /*
   Renders the User Management page.

   Props:
       setCurrentPage (function):
           Used for frontend page navigation.
       setDeniedPermission (function):
           Stores the missing permission before redirecting to
           the Access Denied page.

   Behavior:
       - Calls GET /delete-user when the page loads.
       - If access is allowed, shows a success message.
       - If the user is not logged in, sends them to Login.
       - If the user lacks delete_user permission, sends them to Access Denied.

   Returns:
       JSX.Element:
           A simple protected page with a back button and access message.
   */
    const [message, setMessage] = useState("Checking user management access...");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadUserManagementPage = async () => {
            try {
                await apiFetch("/delete-user", {
                    method: "GET"
                });

                setMessage("User Management access granted.");
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

                setMessage("Could not load user management page");
            } finally {
                setLoading(false);
            }
        };

        loadUserManagementPage();
    }, [setCurrentPage, setDeniedPermission]);

    if (loading) {
        return <p>Loading user management page...</p>;
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

            <h1>User Management</h1>
            <p>{message}</p>
        </div>
    );
}