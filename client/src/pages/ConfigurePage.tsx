import { useEffect, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";

interface TriageCondition {
  field: string;
  operator: "equals" | "contains";
  value: string;
}

interface TriageRule {
  id: string;
  name: string;
  conditions: TriageCondition[];
  assignee: string;
  priority: number;
  enabled: boolean;
}

interface Document {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface Employee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  location: string;
  role: string;
  tags?: string[];
  calendarAvailability?: any;
}

interface SearchResult {
  chunk: string;
  document: {
    id: string;
    title: string;
    category: string;
  };
  similarity: number;
}

type ActiveTab = "documents" | "employees";

export default function ConfigurePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("employees");

  // Rules state
  const [rules, setRules] = useState<TriageRule[]>([]);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<TriageRule | null>(null);

  // Documents state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [ragResponse, setRagResponse] = useState("");
  const [searching, setSearching] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    content: "",
    category: "policy",
    tags: "",
  });
  const [uploading, setUploading] = useState(false);

  // Employees state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeForm, setEmployeeForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    department: "",
    location: "",
    role: "",
    tags: "",
    calendarAvailability: "",
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [showDocAttachModal, setShowDocAttachModal] = useState(false);
  const [selectedEmployeeForDocs, setSelectedEmployeeForDocs] = useState<Employee | null>(null);
  const [employeeDocuments, setEmployeeDocuments] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch functions
  const fetchRules = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/rules`);
      if (!response.ok) throw new Error("Failed to fetch rules");
      const data = await response.json();
      setRules(Array.isArray(data) ? data : data.rules || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rules");
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents`);
      if (!response.ok) return; // Silently fail if not available
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err) {
      console.log("Documents not available");
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/employees`);
      if (!response.ok) return; // Silently fail if not available
      const data = await response.json();
      setEmployees(data.employees || []);

      // Extract all unique tags from employees
      const uniqueTags = new Set<string>();
      data.employees.forEach((emp: Employee) => {
        emp.tags?.forEach(tag => uniqueTags.add(tag));
      });
      setAllTags(Array.from(uniqueTags).sort());
    } catch (err) {
      console.log("Employees not available");
    }
  };

  useEffect(() => {
    fetchRules();
    fetchDocuments();
    fetchEmployees();
  }, []);

  // Rule handlers
  const handleCreateRule = () => {
    setEditingRule({
      id: "",
      name: "",
      conditions: [{ field: "requestType", operator: "equals", value: "" }],
      assignee: "",
      priority: rules.length + 1,
      enabled: true,
    });
    setShowRuleModal(true);
  };

  const handleEditRule = (rule: TriageRule) => {
    setEditingRule(rule);
    setShowRuleModal(true);
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Delete this rule?")) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/rules/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete rule");
      await fetchRules();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete rule");
    }
  };

  const handleToggleRule = async (rule: TriageRule) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/rules/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });

      if (!response.ok) throw new Error("Failed to update rule");
      await fetchRules();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update rule");
    }
  };

  // Document handlers
  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...uploadForm,
          tags: uploadForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });

      if (!response.ok) throw new Error("Failed to upload document");

      await fetchDocuments();
      setShowDocModal(false);
      setUploadForm({ title: "", content: "", category: "policy", tags: "" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!confirm("Delete this document?")) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete");
      await fetchDocuments();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, topK: 5 }),
      });

      if (!response.ok) throw new Error("Search failed");
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleRAGQuery = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    setRagResponse("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!response.ok) throw new Error("RAG query failed");
      const data = await response.json();
      setRagResponse(data.response || "");
    } catch (err) {
      alert(err instanceof Error ? err.message : "RAG query failed");
    } finally {
      setSearching(false);
    }
  };

  // Employee handlers
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      let calendarAvailability = null;
      if (employeeForm.calendarAvailability) {
        try {
          calendarAvailability = JSON.parse(employeeForm.calendarAvailability);
        } catch {
          // If it's not valid JSON, store as string
          calendarAvailability = { notes: employeeForm.calendarAvailability };
        }
      }

      const payload = {
        email: employeeForm.email,
        firstName: employeeForm.firstName,
        lastName: employeeForm.lastName,
        department: employeeForm.department,
        location: employeeForm.location,
        role: employeeForm.role,
        tags: selectedTags,
        calendarAvailability,
      };

      const response = await fetch(`${API_BASE_URL}/api/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to save employee");

      await fetchEmployees();
      setShowEmpModal(false);
      setEditingEmployee(null);
      setEmployeeForm({
        email: "",
        firstName: "",
        lastName: "",
        department: "",
        location: "",
        role: "",
        tags: "",
        calendarAvailability: "",
      });
      setSelectedTags([]);
      setTagInput("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save employee");
    } finally {
      setSaving(false);
    }
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setEmployeeForm({
      email: emp.email,
      firstName: emp.firstName,
      lastName: emp.lastName,
      department: emp.department,
      location: emp.location,
      role: emp.role,
      tags: emp.tags?.join(", ") || "",
      calendarAvailability: emp.calendarAvailability ? JSON.stringify(emp.calendarAvailability, null, 2) : "",
    });
    setSelectedTags(emp.tags || []);
    setTagInput("");
    setShowEmpModal(true);
  };

  const handleAddTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !selectedTags.includes(trimmedTag)) {
      setSelectedTags([...selectedTags, trimmedTag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedTags(selectedTags.filter(tag => tag !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (tagInput.trim()) {
        handleAddTag(tagInput);
      }
    } else if (e.key === "Backspace" && !tagInput && selectedTags.length > 0) {
      handleRemoveTag(selectedTags[selectedTags.length - 1]);
    }
  };

  const filteredTagSuggestions = allTags.filter(
    tag => tag.toLowerCase().includes(tagInput.toLowerCase()) && !selectedTags.includes(tag)
  );

  const handleSyncCalendar = async () => {
    if (!editingEmployee?.id) {
      alert("Please save the employee first before syncing calendar");
      return;
    }

    setSyncingCalendar(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/employees/${editingEmployee.id}/sync-calendar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) throw new Error("Failed to sync calendar");

      const data = await response.json();

      // Update the form with synced calendar data
      setEmployeeForm({
        ...employeeForm,
        calendarAvailability: JSON.stringify(data.availability, null, 2),
      });

      alert("✅ Calendar synced successfully from Calendly!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to sync calendar");
    } finally {
      setSyncingCalendar(false);
    }
  };

  const handleManageDocuments = async (emp: Employee) => {
    setSelectedEmployeeForDocs(emp);
    try {
      const response = await fetch(`${API_BASE_URL}/api/employees/${emp.id}/documents`);
      if (response.ok) {
        const data = await response.json();
        setEmployeeDocuments(data.documents || []);
      }
    } catch (err) {
      console.error("Failed to fetch employee documents:", err);
    }
    setShowDocAttachModal(true);
  };

  const handleAttachDocument = async (documentId: string) => {
    if (!selectedEmployeeForDocs) return;
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/employees/${selectedEmployeeForDocs.id}/documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId }),
        }
      );
      if (!response.ok) throw new Error("Failed to attach document");
      await handleManageDocuments(selectedEmployeeForDocs);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to attach document");
    }
  };

  const handleDetachDocument = async (documentId: string) => {
    if (!selectedEmployeeForDocs) return;
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/employees/${selectedEmployeeForDocs.id}/documents/${documentId}`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("Failed to detach document");
      await handleManageDocuments(selectedEmployeeForDocs);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to detach document");
    }
  };

  if (loading) {
    return (
      <div className="configure-page">
        <p>Loading configuration...</p>
      </div>
    );
  }

  if (error && activeTab === "rules") {
    return (
      <div className="configure-page">
        <p style={{ color: "#ef4444" }}>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="configure-page">
      {/* Tab Navigation */}
      <div className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === "employees" ? "active" : ""}`}
          onClick={() => setActiveTab("employees")}
        >
          👥 Employees
        </button>
        <button
          className={`tab-btn ${activeTab === "documents" ? "active" : ""}`}
          onClick={() => setActiveTab("documents")}
        >
          📚 Documents & RAG
        </button>
      </div>

      {/* Documents Tab */}
      {activeTab === "documents" && (
        <div className="tab-content">
          <div className="section-header">
            <div>
              <h2>Document Library & RAG</h2>
              <p>Manage company documents with semantic search and AI-powered Q&A</p>
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button className="btn btn-secondary" onClick={() => setShowSearchModal(true)}>
                🔍 Search & Ask AI
              </button>
              <button className="btn btn-primary" onClick={() => setShowDocModal(true)}>
                + Upload Document
              </button>
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="empty-state">
              <h3>No documents uploaded</h3>
              <p>Upload policies, templates, or guides to enable RAG-powered search.</p>
            </div>
          ) : (
            <div className="documents-grid">
              {documents.map((doc) => (
                <div key={doc.id} className="document-card">
                  <div className="document-header">
                    <div>
                      <h3>{doc.title}</h3>
                      <span className="category-badge">{doc.category}</span>
                    </div>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteDoc(doc.id)}
                    >
                      Delete
                    </button>
                  </div>
                  <p className="document-preview">
                    {doc.content.substring(0, 200)}
                    {doc.content.length > 200 ? "..." : ""}
                  </p>
                  {doc.tags.length > 0 && (
                    <div className="tags-list">
                      {doc.tags.map((tag, idx) => (
                        <span key={idx} className="tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="document-footer">
                    <small>Updated: {new Date(doc.updatedAt).toLocaleDateString()}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Employees Tab */}
      {activeTab === "employees" && (
        <div className="tab-content">
          <div className="section-header">
            <div>
              <h2>Employee Directory</h2>
              <p>Manage employee profiles for context-aware triage</p>
            </div>
            <button className="btn btn-primary" onClick={() => {
              setEditingEmployee(null);
              setSelectedTags([]);
              setTagInput("");
              setShowEmpModal(true);
            }}>
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
                      {emp.tags && emp.tags.length > 0 && (
                        emp.tags.map(tag => (
                          <span key={tag} className="detail-badge" style={{ background: "#3b82f6" }}>
                            {tag}
                          </span>
                        ))
                      )}
                    </div>
                    <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: "0.875rem", padding: "0.375rem 0.75rem" }}
                        onClick={() => handleEditEmployee(emp)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: "0.875rem", padding: "0.375rem 0.75rem" }}
                        onClick={() => handleManageDocuments(emp)}
                      >
                        Documents
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rule Modal */}
      {showRuleModal && editingRule && (
        <RuleModal
          rule={editingRule}
          onClose={() => {
            setShowRuleModal(false);
            setEditingRule(null);
          }}
          onSave={async () => {
            await fetchRules();
            setShowRuleModal(false);
            setEditingRule(null);
          }}
        />
      )}

      {/* Document Upload Modal */}
      {showDocModal && (
        <div className="modal-overlay" onClick={() => setShowDocModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Upload Document</h2>
              <button className="modal-close" onClick={() => setShowDocModal(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleUploadDoc}>
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, title: e.target.value })
                  }
                  placeholder="Employee Handbook"
                  required
                />
              </div>

              <div className="form-group">
                <label>Category</label>
                <select
                  value={uploadForm.category}
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, category: e.target.value })
                  }
                >
                  <option value="policy">Policy</option>
                  <option value="template">Template</option>
                  <option value="guide">Guide</option>
                  <option value="faq">FAQ</option>
                  <option value="contract">Contract</option>
                </select>
              </div>

              <div className="form-group">
                <label>Content</label>
                <textarea
                  value={uploadForm.content}
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, content: e.target.value })
                  }
                  placeholder="Document content..."
                  rows={10}
                  required
                />
              </div>

              <div className="form-group">
                <label>Tags (comma-separated)</label>
                <input
                  type="text"
                  value={uploadForm.tags}
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, tags: e.target.value })
                  }
                  placeholder="employment, contract, legal"
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowDocModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search Modal */}
      {showSearchModal && (
        <div className="modal-overlay" onClick={() => setShowSearchModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔍 Semantic Search & RAG</h2>
              <button className="modal-close" onClick={() => setShowSearchModal(false)}>
                ×
              </button>
            </div>

            <div className="search-container">
              <div className="form-group">
                <label>Ask a question or search for content</label>
                <textarea
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="What are the requirements for employment contracts?"
                  rows={3}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleSearch}
                  disabled={searching || !searchQuery.trim()}
                >
                  {searching ? "Searching..." : "🔍 Semantic Search"}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleRAGQuery}
                  disabled={searching || !searchQuery.trim()}
                >
                  {searching ? "Generating..." : "✨ Ask AI (RAG)"}
                </button>
              </div>

              {ragResponse && (
                <div className="rag-response">
                  <h3>AI Response:</h3>
                  <div className="response-content">{ragResponse}</div>
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="search-results">
                  <h3>Search Results ({searchResults.length}):</h3>
                  {searchResults.map((result, idx) => (
                    <div key={idx} className="search-result-card">
                      <div className="result-header">
                        <strong>{result.document.title}</strong>
                        <span className="similarity-score">
                          {Math.round(result.similarity * 100)}% match
                        </span>
                      </div>
                      <p className="result-content">{result.chunk}</p>
                      <small className="result-category">{result.document.category}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Employee Modal */}
      {showEmpModal && (
        <div className="modal-overlay" onClick={() => setShowEmpModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingEmployee ? "Edit Employee" : "Add Employee"}</h2>
              <button className="modal-close" onClick={() => setShowEmpModal(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSaveEmployee}>
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

              <div className="form-group">
                <label>Tags</label>
                <div className="tag-input-container">
                  <div className="tag-input-wrapper">
                    {selectedTags.map(tag => (
                      <span key={tag} className="selected-tag">
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="tag-remove"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagInputKeyDown}
                      placeholder={selectedTags.length === 0 ? "Type to add tags (e.g., VIP, Manager, Remote)..." : ""}
                      className="tag-input"
                    />
                  </div>
                  {tagInput && filteredTagSuggestions.length > 0 && (
                    <div className="tag-suggestions">
                      {filteredTagSuggestions.slice(0, 5).map(tag => (
                        <div
                          key={tag}
                          className="tag-suggestion"
                          onClick={() => handleAddTag(tag)}
                        >
                          {tag}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <small style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
                  Press Enter or comma to add a tag. Backspace to remove.
                </small>
              </div>

              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <label style={{ margin: 0 }}>Calendar Availability</label>
                  {editingEmployee && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: "0.875rem", padding: "0.375rem 0.75rem" }}
                      onClick={handleSyncCalendar}
                      disabled={syncingCalendar}
                    >
                      {syncingCalendar ? "🔄 Syncing..." : "📅 Sync from Calendly"}
                    </button>
                  )}
                </div>
                <textarea
                  value={employeeForm.calendarAvailability}
                  onChange={(e) =>
                    setEmployeeForm({ ...employeeForm, calendarAvailability: e.target.value })
                  }
                  placeholder='{"timezone": "PST", "hours": "9-5"} or "Available Mon-Fri"'
                  rows={8}
                  style={{ fontFamily: "monospace", fontSize: "0.875rem" }}
                />
                <small style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
                  Optional. Enter JSON manually or sync from Calendly (mock integration)
                </small>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEmpModal(false)}
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

      {/* Document Attachment Modal */}
      {showDocAttachModal && selectedEmployeeForDocs && (
        <div className="modal-overlay" onClick={() => setShowDocAttachModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                Manage Documents for {selectedEmployeeForDocs.firstName} {selectedEmployeeForDocs.lastName}
              </h2>
              <button className="modal-close" onClick={() => setShowDocAttachModal(false)}>
                ×
              </button>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <h3 style={{ marginBottom: "0.75rem" }}>Attached Documents ({employeeDocuments.length})</h3>
              {employeeDocuments.length === 0 ? (
                <p style={{ color: "#94a3b8" }}>No documents attached</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {employeeDocuments.map((doc: any) => (
                    <div
                      key={doc.id}
                      style={{
                        padding: "0.75rem",
                        background: "rgba(148, 163, 184, 0.1)",
                        borderRadius: "0.5rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <strong>{doc.title}</strong>
                        <br />
                        <small style={{ color: "#94a3b8" }}>{doc.category}</small>
                      </div>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: "0.875rem" }}
                        onClick={() => handleDetachDocument(doc.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 style={{ marginBottom: "0.75rem" }}>Available Documents</h3>
              {documents.length === 0 ? (
                <p style={{ color: "#94a3b8" }}>No documents available</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "300px", overflowY: "auto" }}>
                  {documents
                    .filter(doc => !employeeDocuments.some((empDoc: any) => empDoc.id === doc.id))
                    .map((doc) => (
                      <div
                        key={doc.id}
                        style={{
                          padding: "0.75rem",
                          background: "rgba(148, 163, 184, 0.1)",
                          borderRadius: "0.5rem",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <strong>{doc.title}</strong>
                          <br />
                          <small style={{ color: "#94a3b8" }}>{doc.category}</small>
                        </div>
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: "0.875rem" }}
                          onClick={() => handleAttachDocument(doc.id)}
                        >
                          Attach
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: "1.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDocAttachModal(false)}
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

// RuleModal component (same as before)
interface RuleModalProps {
  rule: TriageRule;
  onClose: () => void;
  onSave: () => void;
}

function RuleModal({ rule, onClose, onSave }: RuleModalProps) {
  const [formData, setFormData] = useState(rule);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = formData.id
        ? `${API_BASE_URL}/api/rules/${formData.id}`
        : `${API_BASE_URL}/api/rules`;

      const method = formData.id ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to save rule");

      onSave();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save rule");
    } finally {
      setSaving(false);
    }
  };

  const addCondition = () => {
    setFormData({
      ...formData,
      conditions: [
        ...formData.conditions,
        { field: "requestType", operator: "equals", value: "" },
      ],
    });
  };

  const removeCondition = (index: number) => {
    setFormData({
      ...formData,
      conditions: formData.conditions.filter((_, i) => i !== index),
    });
  };

  const updateCondition = (index: number, updates: Partial<TriageCondition>) => {
    const newConditions = [...formData.conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setFormData({ ...formData, conditions: newConditions });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{formData.id ? "Edit Rule" : "Create New Rule"}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Rule Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Sales Contracts - Australia"
              required
            />
          </div>

          <div className="form-group">
            <label>Assignee (Email)</label>
            <input
              type="email"
              value={formData.assignee}
              onChange={(e) =>
                setFormData({ ...formData, assignee: e.target.value })
              }
              placeholder="lawyer@acme.corp"
              required
            />
          </div>

          <div className="form-group">
            <label>Priority</label>
            <input
              type="number"
              value={formData.priority}
              onChange={(e) =>
                setFormData({ ...formData, priority: parseInt(e.target.value) })
              }
              min="1"
              required
            />
          </div>

          <div className="form-group">
            <label>Conditions (ALL must match)</label>
            {formData.conditions.map((condition, idx) => (
              <div key={idx} className="condition-row">
                <select
                  value={condition.field}
                  onChange={(e) =>
                    updateCondition(idx, { field: e.target.value })
                  }
                >
                  <option value="requestType">Request Type</option>
                  <option value="location">Location</option>
                  <option value="department">Department</option>
                </select>

                <select
                  value={condition.operator}
                  onChange={(e) =>
                    updateCondition(idx, {
                      operator: e.target.value as "equals" | "contains",
                    })
                  }
                >
                  <option value="equals">equals</option>
                  <option value="contains">contains</option>
                </select>

                <input
                  type="text"
                  value={condition.value}
                  onChange={(e) =>
                    updateCondition(idx, { value: e.target.value })
                  }
                  placeholder="Value"
                  required
                />

                {formData.conditions.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => removeCondition(idx)}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={addCondition}
            >
              + Add Condition
            </button>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) =>
                  setFormData({ ...formData, enabled: e.target.checked })
                }
              />
              <span style={{ marginLeft: "8px" }}>Enabled</span>
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save Rule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
