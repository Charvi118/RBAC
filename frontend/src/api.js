const API_BASE_URL = "http://localhost:8000";
const api_base = API_BASE_URL;

export async function apiFetch(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    if (response.status === 401) {
        throw new Error("UNAUTHENTICATED");
    }

    if (response.status === 403) {
        throw new Error("FORBIDDEN");
    }

    if (!response.ok) {
        throw new Error("SERVER_ERROR");
    }

    return response.json();
}

export { api_base };