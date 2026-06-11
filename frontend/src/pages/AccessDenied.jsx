/*
Access Denied page for the RBAC frontend.

Responsibilities:
- Show a clear message when a logged-in user tries to open a restricted page.
- Display the required permission when available.
- Provide a button to return the user to the dashboard.

UI behavior:
- Shows a centered card with an access denied message.
- Uses the shared warm beige and white visual style of the frontend.
*/
export default function AccessDeniedPage({ setCurrentPage, deniedPermission }) {
    /*
    Renders the Access Denied page.

    Props:
        setCurrentPage (function):
            Used to send the user back to the dashboard.
        deniedPermission (string):
            The permission required to access the restricted page.
            Shown only when provided.

    Returns:
        JSX.Element:
            A styled access denied screen with an optional permission message
            and a button to go back to the dashboard.
    */
    return (
        <div
            style={{
                minHeight: "100vh",
                backgroundColor: "#efe6dc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "30px"
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: "520px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #d8cbbd",
                    borderRadius: "18px",
                    padding: "32px",
                    boxShadow: "0 8px 24px rgba(92, 74, 58, 0.08)",
                    textAlign: "center"
                }}
            >
                <h1
                    style={{
                        fontSize: "34px",
                        color: "#3f3127",
                        marginBottom: "12px"
                    }}
                >
                    Access Denied
                </h1>

                <p
                    style={{
                        color: "#6b5747",
                        marginBottom: "24px",
                        lineHeight: "1.6"
                    }}
                >
                    You do not have permission to access this page.
                </p>
                {deniedPermission && (
                    <p style={{
                        color: "#8a3d3d",
                        marginBottom: "24px",
                        fontWeight: "600"
                    }}
                    > Required permission: {deniedPermission}</p>
                )}

                <button
                    onClick={() => setCurrentPage("dashboard")}
                    style={{
                        padding: "12px 18px",
                        borderRadius: "10px",
                        border: "none",
                        backgroundColor: "#9c7b63",
                        color: "#ffffff",
                        cursor: "pointer",
                        fontWeight: "600"
                    }}
                >
                    Back to Dashboard
                </button>
            </div>
        </div>
    );
}