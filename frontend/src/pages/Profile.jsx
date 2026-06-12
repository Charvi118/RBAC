/*
Profile page for the RBAC frontend.

Responsibilities:
- restore and verify the logged-in user session
- load the current user's profile data from the backend
- show account summary, roles, permissions, and accessible pages
- use shared module configuration to display allowed and denied pages
- allow the user to go back to the dashboard or log out

Data shown on this page:
- user_id
- username
- active status
- assigned roles
- available permissions
- accessible modules/pages
*/
import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import { modules, canAccess } from "../modules";

export default function ProfilePage({ setCurrentPage }) {
    /*
    Renders the Profile page.

    Props:
        setCurrentPage (function):
            used for frontend page navigation

    Behavior:
        - calls /session_check when the page loads
        - redirects unauthenticated users to Login
        - calls /me to fetch current user details
        - calls /logout when the user clicks Logout
        - uses the shared modules configuration to show page access

    Returns:
        JSX.Element:
            a styled profile page with account summary, roles,
            permissions, and accessible page information
    */
    const [profile, setProfile] = useState(null);
    const [message, setMessage] = useState("Loading profile...");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const sessionData = await apiFetch("/session_check", {
                    method: "GET"
                });

                if (!sessionData.logged_in) {
                    setCurrentPage("login");
                    return;
                }

                const data = await apiFetch("/me", {
                    method: "GET"
                });

                setProfile(data);
                setMessage("");
            } catch (error) {
                if (error.message === "UNAUTHENTICATED") {
                    setCurrentPage("login");
                    return;
                }

                setMessage("Could not load profile");
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [setCurrentPage]);

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
        return <p>Loading profile...</p>;
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
                    onClick={() => setCurrentPage("dashboard")}
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

            <h1
                style={{
                    fontSize: "40px",
                    marginBottom: "10px",
                    color: "#3f3127"
                }}
            >
                Profile
            </h1>

            {message && <p>{message}</p>}

            {profile && (
                <div style={{ marginTop: "24px" }}>
                    <div
                        style={{
                            backgroundColor: "#ffffff",
                            border: "1px solid #d8cbbd",
                            borderRadius: "16px",
                            padding: "24px",
                            marginBottom: "20px",
                            boxShadow: "0 6px 18px rgba(92, 74, 58, 0.08)"
                        }}
                    >
                        <h3 style={{ marginBottom: "16px" }}>Account Summary</h3>
                        <div style={{ display: "grid", gap: "12px" }}>
                            <div>
                                <strong>User ID</strong>
                                <p style={{ marginTop: "4px", color: "#6b5747" }}>
                                    {profile.user_id}
                                </p>
                            </div>

                            <div>
                                <strong>Username</strong>
                                <p style={{ marginTop: "4px", color: "#6b5747" }}>
                                    {profile.username}
                                </p>
                            </div>

                            <div>
                                <strong>Active Status</strong>
                                <p style={{ marginTop: "4px", color: "#6b5747" }}>
                                    {profile.is_active ? "Active" : "Inactive"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                            gap: "20px"
                        }}
                    >
                        <div
                            style={{
                                backgroundColor: "#ffffff",
                                border: "1px solid #d8cbbd",
                                borderRadius: "16px",
                                padding: "24px",
                                boxShadow: "0 6px 18px rgba(92, 74, 58, 0.08)"
                            }}
                        >
                            <h3 style={{ marginBottom: "16px" }}>Roles</h3>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                                {profile.roles.map((role) => (
                                    <span
                                        key={role}
                                        style={{
                                            backgroundColor: "#f3ebe2",
                                            color: "#6b5747",
                                            padding: "8px 12px",
                                            borderRadius: "999px",
                                            fontSize: "14px",
                                            fontWeight: "500"
                                        }}
                                    >
                                        {role}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div
                            style={{
                                backgroundColor: "#ffffff",
                                border: "1px solid #d8cbbd",
                                borderRadius: "16px",
                                padding: "24px",
                                boxShadow: "0 6px 18px rgba(92, 74, 58, 0.08)"
                            }}
                        >
                            <h3 style={{ marginBottom: "16px" }}>Permissions</h3>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                                {profile.permissions.map((permission) => (
                                    <span
                                        key={permission}
                                        style={{
                                            backgroundColor: "#f8f2eb",
                                            color: "#7a624f",
                                            padding: "8px 12px",
                                            borderRadius: "999px",
                                            fontSize: "14px",
                                            fontWeight: "500"
                                        }}
                                    >
                                        {permission}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div
                            style={{
                                backgroundColor: "#ffffff",
                                border: "1px solid #d8cbbd",
                                borderRadius: "16px",
                                padding: "24px",
                                boxShadow: "0 6px 18px rgba(92, 74, 58, 0.08)"
                            }}
                        >
                            <h3 style={{ marginBottom: "16px" }}>Accessible Pages</h3>
                            <div style={{ display: "grid", gap: "12px" }}>
                                {modules.map((module) => {
                                    const allowed = canAccess(module.permission, profile.permissions);

                                    return (
                                        <div
                                            key={module.page}
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center"
                                            }}
                                        >
                                            <span>{module.name}</span>
                                            <span
                                                style={{
                                                    backgroundColor: allowed ? "#d8f0dd" : "#f4dddd",
                                                    color: allowed ? "#2f6a3d" : "#8a3d3d",
                                                    padding: "6px 10px",
                                                    borderRadius: "999px",
                                                    fontSize: "13px",
                                                    fontWeight: "600"
                                                }}
                                            >
                                                {allowed ? "Allowed" : "Denied"}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}