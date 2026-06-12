/*
Dashboard page for the RBAC frontend.

Responsibilities:
- restore and verify the current logged-in session
- load the current user's profile data from the backend
- show available modules based on the user's permissions
- show disabled modules with "No Permission" when access is not allowed
- redirect users to Access Denied when they try to open restricted pages
- provide logout functionality

Module behavior:
- dashboard uses the shared modules configuration file
- page access is decided using the shared canAccess helper
- modules without required permissions remain visible but appear disabled
*/
import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import { modules, canAccess } from "../modules";

export default function Dashboard({ setCurrentPage, setDeniedPermission }) {
    /*
    Renders the Dashboard page.

    Props:
        setCurrentPage (function):
            used for frontend page navigation
        setDeniedPermission (function):
            stores the required permission before redirecting
            to the Access Denied page

    Behavior:
        - calls /session_check when the page loads
        - redirects unauthenticated users to Login
        - calls /me to fetch current user information
        - uses shared module configuration to render module cards
        - lets the user log out using post /logout

    Returns:
        JSX.Element:
            a dashboard page with module cards, access control behavior,
            and logout support
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

                setMessage("Could not load dashboard");
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, [setCurrentPage]);

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