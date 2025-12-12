import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import ChatPage from "./pages/ChatPage";
import ConfigurePage from "./pages/ConfigurePage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import DebugPage from "./pages/DebugPage";
import "./App.css";

export default function App() {
  const location = useLocation();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      setUser(JSON.parse(userStr));
    }
  }, [location]);

  const isLoginPage = location.pathname === "/login";

  return (
    <div className="app-shell">
      {!isLoginPage && (
        <nav className="app-nav">
          <h2>Legal frontdoor</h2>
          <div className="nav-links">
            <NavLink
              to="/chat"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Chat
            </NavLink>
            <NavLink
              to="/configure"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Configure
            </NavLink>
            <NavLink
              to="/debug"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Debug
            </NavLink>
            {user && (
              <NavLink
                to="/profile"
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div className="nav-avatar">
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </div>
                  Profile
                </div>
              </NavLink>
            )}
          </div>
        </nav>
      )}

      <main className={isLoginPage ? "app-content-full" : "app-content"}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/configure" element={<ConfigurePage />} />
          <Route path="/debug" element={<DebugPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </main>
    </div>
  );
}
