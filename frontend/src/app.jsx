/*
Main application component for the RBAC frontend.

Responsibilities:
- Restore the user session when the app first loads.
- Keep track of the current frontend page.
- Store the denied permission for the Access Denied page.
- Render the correct page component based on currentPage.
- Pass navigation and permission state down to child pages.

Frontend routing approach:
- This project uses simple state-based page switching with currentPage.
- It does not use full URL routing.
*/
import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import ProfilePage from "./pages/Profile";
import BillingPage from "./pages/Billing";
import UserManagementPage from "./pages/UserManagement";
import AdminMatrixPage from "./pages/AdminMatrix";
import AccessDeniedPage from "./pages/AccessDenied";

export default function App() {
    /*
    Renders the main frontend application shell.

    State:
        currentPage:
            Stores which page should currently be displayed.
        deniedPermission:
            Stores the missing permission when a user is redirected
            to the Access Denied page.
        checkingSession:
            Shows whether the app is still restoring the session
            on first load.

    Behavior:
        - Calls /session_check when the app opens.
        - Sends authenticated users to the dashboard.
        - Keeps unauthenticated users on the login page.
        - Shows a temporary loading message while checking session.

    Returns:
        JSX.Element:
            The currently active page component for the RBAC frontend.
    */
    const [currentPage, setCurrentPage] = useState("login");
    const [deniedPermission, setDeniedPermission] = useState("");
    const [checkingSession, setCheckingSession] = useState(true);

    useEffect(() => {
        const restoreSession = async () => {
            try {
                const sessionData = await apiFetch("/session_check", {
                    method: "GET"
                });

                if (sessionData.logged_in) {
                    setCurrentPage("dashboard");
                } else {
                    setCurrentPage("login");
                }
            } catch (error) {
                setCurrentPage("login");
            } finally {
                setCheckingSession(false);
            }
        };

        restoreSession();
    }, []);

    if (checkingSession) {
        return <p style={{ padding: "30px" }}>Checking session...</p>;
    }

    return (
        <div>
            {currentPage === "login" && (
                <LoginPage setCurrentPage={setCurrentPage} />
            )}

            {currentPage === "dashboard" && (
                <DashboardPage
                    setCurrentPage={setCurrentPage}
                    setDeniedPermission={setDeniedPermission}
                />
            )}

            {currentPage === "profile" && (
                <ProfilePage setCurrentPage={setCurrentPage} />
            )}

            {currentPage === "billing" && (
                <BillingPage
                    setCurrentPage={setCurrentPage}
                    setDeniedPermission={setDeniedPermission}
                />
            )}

            {currentPage === "user-management" && (
                <UserManagementPage
                    setCurrentPage={setCurrentPage}
                    setDeniedPermission={setDeniedPermission}
                />
            )}

            {currentPage === "admin-matrix" && (
                <AdminMatrixPage
                    setCurrentPage={setCurrentPage}
                    setDeniedPermission={setDeniedPermission}
                />
            )}

            {currentPage === "access-denied" && (
                <AccessDeniedPage
                    setCurrentPage={setCurrentPage}
                    deniedPermission={deniedPermission}
                />
            )}
        </div>
    );
}