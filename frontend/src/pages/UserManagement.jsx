/*
User Management page for the RBAC frontend.

Responsibilities:
- check whether the logged-in user can access the user management module
- call the backend protected route when the page opens
- redirect unauthenticated users to the Login page
- redirect unauthorized users to the Access Denied page with the required permission
- show a success message when access is granted

Current scope:
- this page checks access only
- actual delete-user functionality is not implemented yet
*/
import { useEffect, useState } from "react";
import { apiFetch } from "../api";

export default function UserManagementPage({ setCurrentPage, setDeniedPermission }) {
    /*
    Renders the User Management page.

    Props:
        setCurrentPage (function):
            used for frontend page navigation
        setDeniedPermission (function):
            stores the missing permission before redirecting to
            the Access Denied page

    Behavior:
        - calls get /delete-user when the page loads
        - if access is allowed, shows a success message
        - if the user is not logged in, sends them to Login
        - if the user lacks user:delete permission, sends them to Access Denied

    Returns:
        JSX.Element:
            a simple protected page with a back button and access message
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
                    setDeniedPermission("user:delete");
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