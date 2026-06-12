/*
Billing page for the RBAC frontend.

Responsibilities:
- check whether the logged-in user can access the billing module
- call the protected backend billing route when the page opens
- redirect unauthenticated users to the Login page
- redirect unauthorized users to the Access Denied page with the
  required permission
- show a success message when billing access is granted

Access rule:
- this page currently expects the billing:update permission
*/
import { useEffect, useState } from "react";
import { apiFetch } from "../api";

export default function BillingPage({ setCurrentPage, setDeniedPermission }) {
    /*
    Renders the Billing page.

    Props:
        setCurrentPage (function):
            used for frontend page navigation
        setDeniedPermission (function):
            stores the missing permission before redirecting
            to the Access Denied page

    Behavior:
        - calls get /billing when the page loads
        - redirects unauthenticated users to Login
        - redirects unauthorized users to Access Denied
        - shows a success message when access is allowed

    Returns:
        JSX.Element:
            a simple protected page with a back button and billing access message
    */
    const [message, setMessage] = useState("Checking billing access...");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadBillingPage = async () => {
            try {
                await apiFetch("/billing", {
                    method: "GET"
                });

                setMessage("Billing page access granted.");
            } catch (error) {
                if (error.message === "UNAUTHENTICATED") {
                    setCurrentPage("login");
                    return;
                }

                if (error.message === "FORBIDDEN") {
                    setDeniedPermission("billing:update");
                    setCurrentPage("access-denied");
                    return;
                }

                setMessage("Could not load billing page");
            } finally {
                setLoading(false);
            }
        };

        loadBillingPage();
    }, [setCurrentPage, setDeniedPermission]);

    if (loading) {
        return <p>Loading billing page...</p>;
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

            <h1>Billing</h1>
            <p>{message}</p>
        </div>
    );
}