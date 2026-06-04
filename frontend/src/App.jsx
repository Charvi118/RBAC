import { useState } from "react";

const API = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export default function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [matrix, setMatrix] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      setMsg(data.message || (data.success ? "Logged in" : "Login failed"));
      if (data.success) {
        await loadMatrix();
      }
    } catch (err) {
      setMsg(`Error: ${err.message}`)
    }
  };
  const loadMatrix = async () => {
    try {
      const res = await fetch(`${API}/admin/matrix`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        setMsg("Not allowed to view admin matrix");
        return;
      }
      const data = await res.json();
      setMatrix(data);
    } catch (err) {
      setMsg(`Error: ${err.message}`);
    }
  };
  const togglePermission = async (roleId, permissionId, isChecked) => {
    const method = isChecked ? "DELETE" : "POST";
    const res = await fetch(`${API}/admin/role-permission`, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role_id: roleId, permission_id: permissionId }),
    });
    if (!res.ok) {
      setMsg("Failed to update mapping");
      return;
    }
    await loadMatrix();
  };
  const hasMapping = (roleId, permissionId) => {
    if (!matrix) return false;
    return matrix.mappings.some(
      (m) => m.role_id === roleId && m.permission_id === permissionId
    );
  };
  const isLockedCell = (roleName, permissionKey) => {
    return roleName == "SUPER_ADMIN" && permissionKey == "delete_user";
  }
  return (
    <div style={{ padding: 24 }}>
      <h2>LOGIN</h2>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <br /><br />
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <br /><br />
        <button type="submit">Login</button>
      </form>
      <p>{msg}</p>
      {matrix && (
        <>
          <h3>Admin Matrix(Read Only)</h3>
          <table border="1" cellPadding="8" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>ROLE/PERMISSIONS</th>
                {matrix.permissions.map((p) => (
                  <th key={p.permission_id}>{p.permission_key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.roles.map((r) => (
                <tr key={r.role_id}>
                  <td>{r.role_name}</td>
                  {matrix.permissions.map((p) => (
                    <td key={p.permission_id}>
                      <input type="checkbox"
                        checked={hasMapping(r.role_id, p.permission_id)}
                        disabled={isLockedCell(r.role_name, p.permission_key)}
                        onChange={() => togglePermission(r.role_id, p.permission_id,
                          hasMapping(r.role_id, p.permission_id))}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}