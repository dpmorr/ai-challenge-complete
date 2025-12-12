import { useEffect, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";

interface Document {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
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

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
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

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents`);
      if (!response.ok) throw new Error("Failed to fetch documents");
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
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
      setShowUploadModal(false);
      setUploadForm({ title: "", content: "", category: "policy", tags: "" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setUploading(false);
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

  const handleDelete = async (id: string) => {
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

  if (loading) {
    return (
      <div className="documents-page">
        <p>Loading documents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="documents-page">
        <p style={{ color: "#ef4444" }}>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="documents-page">
      <div className="page-header">
        <div>
          <h1>📚 Document Library</h1>
          <p>Manage company documents and knowledge base with semantic search</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button className="btn btn-secondary" onClick={() => setShowSearchModal(true)}>
            🔍 Search Documents
          </button>
          <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
            + Upload Document
          </button>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="empty-state">
          <h3>No documents uploaded</h3>
          <p>Upload your first policy, template, or guide to get started.</p>
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
                  onClick={() => handleDelete(doc.id)}
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

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Upload Document</h2>
              <button className="modal-close" onClick={() => setShowUploadModal(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleUpload}>
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
                  style={{ resize: "vertical" }}
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
                  onClick={() => setShowUploadModal(false)}
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
                  style={{ resize: "vertical" }}
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

              {/* RAG Response */}
              {ragResponse && (
                <div className="rag-response">
                  <h3>AI Response:</h3>
                  <div className="response-content">
                    {ragResponse}
                  </div>
                </div>
              )}

              {/* Search Results */}
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
    </div>
  );
}
