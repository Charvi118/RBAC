/*
Dashboard page for the RBAC frontend.

Responsibilities:
- Restore and verify the current logged-in session.
- Load the current user's profile data from the backend.
- Show available modules based on the user's permissions.
- Show disabled modules with "No Permission" when access is not allowed.
- Redirect users to Access Denied when they try to open restricted pages.
- Provide logout functionality.

Module behavior:
- Dashboard uses the shared modules configuration file.
- Page access is decided using the shared canAccess helper.
- Modules without required permissions remain visible but appear disabled.
*/
import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import { modules, canAccess } from "../modules";

export default function Dashboard({ setCurrentPage, setDeniedPermission }) {
    /*
    Renders the Dashboard page.

    Props:
        setCurrentPage (function):
            Used for frontend page navigation.
        setDeniedPermission (function):
            Stores the required permission before redirecting
            to the Access Denied page.

    Behavior:
        - Calls /session_check when the page loads.
        - Redirects unauthenticated users to Login.
        - Calls /me to fetch current user information.
        - Uses shared module configuration to render module cards.
        - Lets the user log out using POST /logout.

    Returns:
        JSX.Element:
            A dashboard page with module cards, access control behavior,
            and logout support.
    */
    const [profile, setProfile] = useState(null);
    const [message, setMessage] = useState("Checking session...");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                const sessionData = await apiFetch("/session_check", {
                    method: "GET"
                });

                if (!sessionData.logged_in) {
                    setCurrentPage("login");
                    return;
                }

                const meData = await apiFetch("/me", {
                    method: "GET"
                });

                setProfile(meData);
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

                setMessage("Could not load dashboard");
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, [setCurrentPage, setDeniedPermission]);

    const hasPermission = (permission) => {
        if (!profile) return false;
        return profile.permissions.includes(permission);
    };

    const handleProtectedPage = (permission, pageName) => {
        if (!permission || hasPermission(permission)) {
            setCurrentPage(pageName);
        } else {
            setDeniedPermission(permission);
            setCurrentPage("access-denied");
        }
    };

    const handleLogout = async () => {
        try {
            await apiFetch("/logout", {
                method: "POST"
            });

            setCurrentPage("login");
        } catch (error) {
            setMessage("Could not log out");
        }
    };

    if (loading) {
        return <p>Loading dashboard...</p>;
    }

    return (
        <div style={{ padding: "30px" }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "20px"
                }}
            >
                <button
                    onClick={() => setCurrentPage("login")}
                    style={{
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: "1px solid #d8cbbd",
                        backgroundColor: "#ffffff",
                        cursor: "pointer"
                    }}
                >
                    ← Back
                </button>

                <button
                    onClick={handleLogout}
                    style={{
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: "none",
                        backgroundColor: "#9c7b63",
                        color: "#ffffff",
                        cursor: "pointer"
                    }}
                >
                    Logout
                </button>
            </div>

            <h1>Dashboard</h1>

            {profile && <p>Welcome, {profile.username}</p>}

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "20px",
                    marginTop: "24px"
                }}
            >
                {profile &&
                    modules
                        .filter((module) => module.page !== "dashboard")
                        .map((module) => {
                            const allowed = canAccess(module.permission, profile.permissions);

                            return (
                                <div
                                    key={module.page}
                                    onClick={() => handleProtectedPage(module.permission, module.page)}
                                    style={{
                                        padding: "20px",
                                        borderRadius: "14px",
                                        backgroundColor: "#ffffff",
                                        border: "1px solid #d8cbbd",
                                        cursor: "pointer",
                                        boxShadow: "0 6px 18px rgba(92, 74, 58, 0.08)",
                                        opacity: allowed ? 1 : 0.5
                                    }}
                                >
                                    <h3>{module.name}</h3>
                                    <p>{allowed ? "Enabled" : "No Permission"}</p>
                                </div>
                            );
                        })}
            </div>

            {message && <p>{message}</p>}
        </div>
    );
}