/*
Login page for the RBAC frontend.

Responsibilities:
- Collect username and password from the user.
- Call the backend login API when the form is submitted.
- Redirect the user to the dashboard after successful login.
- Show a clear error message when login fails.
- Clear the password field after each login attempt.

Security behavior:
- Password is submitted to the backend only during login.
- Password is not stored in localStorage or any persistent frontend storage.
- Session handling is done by backend cookies.
*/
import { useState } from "react";
import { apiFetch } from "../api";

export default function LoginPage({ setCurrentPage }) {
    /*
    Renders the Login page.

    Props:
        setCurrentPage (function):
            Used to move the user to the dashboard after successful login.

    Behavior:
        - Calls POST /login when the form is submitted.
        - Shows success or error messages based on backend response.
        - Lets the user show or hide the password field.
        - Clears the password field after the login attempt finishes.

    Returns:
        JSX.Element:
            A styled login form with username, password, show/hide password,
            and message display.
    */
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();

        try {
            const data = await apiFetch("/login", {
                method: "POST",
                body: JSON.stringify({
                    username,
                    password
                })
            });

            if (data.success) {
                setMessage("Login successful");
                setCurrentPage("dashboard");
            } else {
                setMessage(data.message);
            }
        } catch (error) {
            if (error.message === "SERVER_ERROR") {
                setMessage("Invalid credentials or server error");
            } else {
                setMessage("Something went wrong");
            }
        }

        setPassword("");
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "#efe6dc"
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: "380px",
                    backgroundColor: "#ffffff",
                    padding: "40px 32px",
                    borderRadius: "16px",
                    boxShadow: "0 10px 30px rgba(92, 74, 58, 0.12)"
                }}
            >
                <h1
                    style={{
                        textAlign: "center",
                        marginBottom: "28px",
                        fontSize: "32px",
                        color: "#4b3a2f",
                        fontWeight: "600"
                    }}
                >
                    Login
                </h1>

                <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: "16px" }}>
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "14px 16px",
                                borderRadius: "10px",
                                border: "1px solid #d8cbbd",
                                fontSize: "15px",
                                boxSizing: "border-box",
                                backgroundColor: "#fcfaf7"
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: "12px" }}>
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "14px 16px",
                                borderRadius: "10px",
                                border: "1px solid #d8cbbd",
                                fontSize: "15px",
                                boxSizing: "border-box",
                                backgroundColor: "#fcfaf7"
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: "20px" }}>
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                                background: "none",
                                border: "none",
                                padding: 0,
                                color: "#8a6f58",
                                cursor: "pointer",
                                fontSize: "14px"
                            }}
                        >
                            {showPassword ? "Hide password" : "Show password"}
                        </button>
                    </div>

                    <button
                        type="submit"
                        style={{
                            width: "100%",
                            padding: "14px",
                            borderRadius: "10px",
                            border: "none",
                            backgroundColor: "#9c7b63",
                            color: "#ffffff",
                            fontSize: "15px",
                            fontWeight: "600",
                            cursor: "pointer",
                            transition: "background-color 0.2s ease",
                            outline: "none"
                        }}
                    >
                        Login
                    </button>
                </form>

                {message && (
                    <p
                        style={{
                            marginTop: "18px",
                            textAlign: "center",
                            color: "#6b5747",
                            fontSize: "14px"
                        }}
                    >
                        {message}
                    </p>
                )}
            </div>
        </div>
    );
}