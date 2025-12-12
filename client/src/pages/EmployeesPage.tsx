import { useEffect, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";

interface Employee {
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  location: string;
  role: string;
  createdAt?: string;
  isLawyer?: boolean;
  specialties?: string[];
}

interface RequestPattern {
  requestType: string;
  count: number;
  lastRequested: string;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPatternsModal, setShowPatternsModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [patterns, setPatterns] = useState<RequestPattern[]>([]);
  const [loadingPatterns, setLoadingPatterns] = useState(false);

  const [employeeForm, setEmployeeForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    department: "",
    location: "",
    role: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchEmployees = async () => {
    try {
      // Fetch both employees and lawyers
      const [employeesRes, lawyersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/employees`),
        fetch(`${API_BASE_URL}/api/lawyers`)
      ]);

      if (!employeesRes.ok) throw new Error("Failed to fetch employees");
      if (!lawyersRes.ok) throw new Error("Failed to fetch lawyers");

      const employeesData = await employeesRes.json();
      const lawyersData = await lawyersRes.json();

      // Convert lawyers to employee format
      const lawyerEmployees = (lawyersData.lawyers || []).map((lawyer: any) => {
        const [firstName, ...lastNameParts] = lawyer.name.split(' ');
        return {
          email: lawyer.email,
          firstName,
          lastName: lastNameParts.join(' '),
          department: 'Legal',  // Lawyers always belong to Legal department
          location: lawyer.locations?.[0] || 'Unknown',
          role: `Lawyer${lawyer.specialties?.length > 0 ? ' - ' + lawyer.specialties.join(', ') : ''}`,
          isLawyer: true,
          specialties: lawyer.specialties,
          createdAt: lawyer.createdAt
        };
      });

      // Combine and sort
      setEmployees([...lawyerEmployees, ...(employeesData.employees || [])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(employeeForm),
      });

      if (!response.ok) throw new Error("Failed to save employee");

      await fetchEmployees();
      setShowAddModal(false);
      setEmployeeForm({
        email: "",
        firstName: "",
        lastName: "",
        department: "",
        location: "",
        role: "",
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save employee");
    } finally {
      setSaving(false);
    }
  };

  const handleViewPatterns = async (email: string) => {
    setSelectedEmployee(email);
    setShowPatternsModal(true);
    setLoadingPatterns(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/employees/${encodeURIComponent(email)}/patterns`
      );
      if (!response.ok) throw new Error("Failed to fetch patterns");
      const data = await response.json();
      setPatterns(data.patterns || []);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load patterns");
      setPatterns([]);
    } finally {
      setLoadingPatterns(false);
    }
  };

  if (loading) {
    return (
      <div className="employees-page">
        <p>Loading employees...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="employees-page">
        <p style={{ color: "#ef4444" }}>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="employees-page">
      <div className="page-header">
        <div>
          <h1>👥 Employee Directory</h1>
          <p>Manage employee profiles for context-aware triage</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          + Add Employee
        </button>
      </div>

      {employees.length === 0 ? (
        <div className="empty-state">
          <h3>No employees registered</h3>
          <p>Add employees to enable auto-context detection in chat.</p>
        </div>
      ) : (
        <div className="employees-grid">
          {employees.map((emp) => (
            <div key={emp.email} className="employee-card">
              <div className="employee-avatar">
                {emp.firstName[0]}
                {emp.lastName[0]}
              </div>
              <div className="employee-info">
                <h3>
                  {emp.firstName} {emp.lastName}
                </h3>
                <p className="employee-email">{emp.email}</p>
                <div className="employee-details">
                  <span className="detail-badge">{emp.role}</span>
                  <span className="detail-badge">{emp.department}</span>
                  <span className="detail-badge">{emp.location}</span>
                </div>
              </div>
              <div className="employee-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleViewPatterns(emp.email)}
                >
                  View Patterns
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Employee</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={employeeForm.email}
                  onChange={(e) =>
                    setEmployeeForm({ ...employeeForm, email: e.target.value })
                  }
                  placeholder="john.doe@acme.corp"
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    value={employeeForm.firstName}
                    onChange={(e) =>
                      setEmployeeForm({ ...employeeForm, firstName: e.target.value })
                    }
                    placeholder="John"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    value={employeeForm.lastName}
                    onChange={(e) =>
                      setEmployeeForm({ ...employeeForm, lastName: e.target.value })
                    }
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Department</label>
                <select
                  value={employeeForm.department}
                  onChange={(e) =>
                    setEmployeeForm({ ...employeeForm, department: e.target.value })
                  }
                  required
                >
                  <option value="">Select department</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Sales">Sales</option>
                  <option value="Marketing">Marketing</option>
                  <option value="HR">HR</option>
                  <option value="Finance">Finance</option>
                  <option value="Legal">Legal</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>

              <div className="form-group">
                <label>Location</label>
                <select
                  value={employeeForm.location}
                  onChange={(e) =>
                    setEmployeeForm({ ...employeeForm, location: e.target.value })
                  }
                  required
                >
                  <option value="">Select location</option>
                  <option value="United States">United States</option>
                  <option value="Australia">Australia</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Canada">Canada</option>
                  <option value="Germany">Germany</option>
                  <option value="Singapore">Singapore</option>
                </select>
              </div>

              <div className="form-group">
                <label>Role</label>
                <input
                  type="text"
                  value={employeeForm.role}
                  onChange={(e) =>
                    setEmployeeForm({ ...employeeForm, role: e.target.value })
                  }
                  placeholder="Software Engineer"
                  required
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patterns Modal */}
      {showPatternsModal && (
        <div className="modal-overlay" onClick={() => setShowPatternsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Request Patterns - {selectedEmployee}</h2>
              <button
                className="modal-close"
                onClick={() => setShowPatternsModal(false)}
              >
                ×
              </button>
            </div>

            {loadingPatterns ? (
              <p>Loading patterns...</p>
            ) : patterns.length === 0 ? (
              <div className="empty-state">
                <p>No request patterns yet for this employee.</p>
              </div>
            ) : (
              <div className="patterns-list">
                <p className="patterns-intro">
                  Common request types based on conversation history:
                </p>
                {patterns.map((pattern, idx) => (
                  <div key={idx} className="pattern-card">
                    <div className="pattern-header">
                      <strong>{pattern.requestType}</strong>
                      <span className="pattern-count">{pattern.count} requests</span>
                    </div>
                    <small className="pattern-date">
                      Last: {new Date(pattern.lastRequested).toLocaleDateString()}
                    </small>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowPatternsModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
