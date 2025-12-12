import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  location: string;
  role: string;
  tags?: string[];
  calendarAvailability?: any;
  createdAt: string;
}

interface Document {
  id: string;
  title: string;
  category: string;
  attachedAt: string;
  notes?: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const userStr = localStorage.getItem("user");
        if (!userStr) {
          navigate("/login");
          return;
        }

        const userData = JSON.parse(userStr);
        setUser(userData);

        // Fetch user's attached documents
        const response = await fetch(
          `${API_BASE_URL}/api/employees/${userData.id}/documents`
        );
        if (response.ok) {
          const data = await response.json();
          setDocuments(data.documents || []);
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("authToken");
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="profile-page">
        <p>Loading profile...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <div className="profile-avatar-large">
            {user.firstName[0]}
            {user.lastName[0]}
          </div>
          <div className="profile-header-info">
            <h1>
              {user.firstName} {user.lastName}
            </h1>
            <p className="profile-email">{user.email}</p>
          </div>
          <button className="btn btn-secondary" onClick={handleLogout}>
            Sign Out
          </button>
        </div>

        <div className="profile-sections">
          <div className="profile-section">
            <h2>Profile Information</h2>
            <div className="profile-info-grid">
              <div className="profile-info-item">
                <label>Department</label>
                <span>{user.department}</span>
              </div>
              <div className="profile-info-item">
                <label>Location</label>
                <span>{user.location}</span>
              </div>
              <div className="profile-info-item">
                <label>Role</label>
                <span>{user.role}</span>
              </div>
              <div className="profile-info-item">
                <label>Member Since</label>
                <span>{new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {user.tags && user.tags.length > 0 && (
              <div className="profile-tags">
                <label>Tags</label>
                <div className="tags-list">
                  {user.tags.map((tag) => (
                    <span key={tag} className="tag-badge">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {user.calendarAvailability && (
              <div className="profile-availability">
                <label>Calendar Availability</label>
                <pre className="availability-display">
                  {typeof user.calendarAvailability === "string"
                    ? user.calendarAvailability
                    : JSON.stringify(user.calendarAvailability, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <div className="profile-section">
            <h2>My Documents ({documents.length})</h2>
            {documents.length === 0 ? (
              <p className="empty-message">No documents attached to your profile</p>
            ) : (
              <div className="documents-list">
                {documents.map((doc) => (
                  <div key={doc.id} className="document-item">
                    <div className="document-icon">📄</div>
                    <div className="document-info">
                      <h3>{doc.title}</h3>
                      <p className="document-meta">
                        <span className="category-badge">{doc.category}</span>
                        <span className="document-date">
                          Attached {new Date(doc.attachedAt).toLocaleDateString()}
                        </span>
                      </p>
                      {doc.notes && (
                        <p className="document-notes">{doc.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
