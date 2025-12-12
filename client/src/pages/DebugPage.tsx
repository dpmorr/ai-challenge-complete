import { useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8999';

interface ChatTrace {
  traceId: string;
  timestamp: string;
  employeeEmail?: string;
  employeeContext?: {
    id: string;
    name: string;
    department: string;
    location: string;
    tags?: string[];
  };
  messages: Array<{ role: string; content: string }>;
  extractedInfo?: Record<string, any>;
  fuzzyMatches?: {
    requestType?: { original: string; matched: string; confidence: number };
    location?: { original: string; matched: string; confidence: number };
    department?: { original: string; matched: string; confidence: number };
  };
  ragContext?: {
    documentsSearched: number;
    documentsRetrieved: number;
    documents: Array<{
      title: string;
      category: string;
      similarity: number;
      chunkPreview: string;
    }>;
  };
  ruleMatching?: {
    rulesEvaluated: number;
    matchedRule?: {
      id: string;
      name: string;
      assignee: string;
      matchedConditions: Array<{ field: string; operator: string; value: string }>;
    };
  };
  aiResponse?: {
    model: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    latencyMs: number;
  };
  errors?: Array<{
    stage: string;
    error: string;
    stack?: string;
  }>;
  performance?: {
    totalDurationMs: number;
    stages: Record<string, number>;
  };
}

export default function DebugPage() {
  const [traces, setTraces] = useState<ChatTrace[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<ChatTrace | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchTraces = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/traces?limit=50`);
      const data = await response.json();
      if (data.success) {
        setTraces(data.traces);
      }
    } catch (error) {
      console.error('Failed to fetch traces:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTraces();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchTraces();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const clearAllTraces = async () => {
    if (!confirm('Are you sure you want to clear all traces?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/traces`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        setTraces([]);
        setSelectedTrace(null);
      }
    } catch (error) {
      console.error('Failed to clear traces:', error);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Debug Panel</h1>
        </div>
        <p style={{ textAlign: 'center', marginTop: '2rem' }}>Loading traces...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Debug Panel - Chat Observability</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (5s)
          </label>
          <button className="btn btn-secondary" onClick={fetchTraces}>
            Refresh Now
          </button>
          <button className="btn btn-danger" onClick={clearAllTraces}>
            Clear All Traces
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '1.5rem', height: 'calc(100vh - 200px)' }}>
        {/* Trace List */}
        <div style={{ overflow: 'auto' }}>
          <h3 style={{ marginBottom: '1rem', color: '#94a3b8' }}>
            Recent Traces ({traces.length})
          </h3>
          {traces.length === 0 ? (
            <p style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>
              No traces yet. Start a chat conversation to see traces here.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {traces.map((trace) => (
                <div
                  key={trace.traceId}
                  onClick={() => setSelectedTrace(trace)}
                  style={{
                    padding: '1rem',
                    background: selectedTrace?.traceId === trace.traceId
                      ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                      : 'rgba(30, 41, 59, 0.7)',
                    border: `1px solid ${selectedTrace?.traceId === trace.traceId ? '#3b82f6' : 'rgba(148, 163, 184, 0.3)'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 150ms ease'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedTrace?.traceId !== trace.traceId) {
                      e.currentTarget.style.borderColor = '#3b82f6';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedTrace?.traceId !== trace.traceId) {
                      e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.3)';
                    }
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                    {formatTimestamp(trace.timestamp)}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#f8fafc', fontWeight: 500, marginBottom: '0.25rem' }}>
                    {trace.employeeEmail || 'Anonymous'}
                  </div>
                  {trace.employeeContext && (
                    <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                      {trace.employeeContext.department} - {trace.employeeContext.location}
                    </div>
                  )}
                  {trace.errors && trace.errors.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.5rem', fontWeight: 500 }}>
                      ❌ {trace.errors.length} error(s)
                    </div>
                  )}
                  {trace.performance && (
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                      ⏱️ {trace.performance.totalDurationMs}ms
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trace Details */}
        <div style={{ overflow: 'auto', padding: '1.5rem', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
          {!selectedTrace ? (
            <p style={{ color: '#64748b', textAlign: 'center', marginTop: '3rem' }}>
              Select a trace to view details
            </p>
          ) : (
            <div>
              <h2 style={{ marginBottom: '1.5rem', color: '#f8fafc' }}>Trace Details</h2>

              {/* Trace ID */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Trace ID</div>
                <code style={{ fontSize: '0.875rem', color: '#3b82f6', padding: '0.5rem', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '4px', display: 'block' }}>
                  {selectedTrace.traceId}
                </code>
              </div>

              {/* Employee Context */}
              {selectedTrace.employeeContext && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', color: '#cbd5e1', marginBottom: '0.75rem' }}>👤 Employee Context</h3>
                  <div style={{ padding: '1rem', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.875rem' }}><strong>Name:</strong> {selectedTrace.employeeContext.name}</div>
                    <div style={{ fontSize: '0.875rem' }}><strong>Department:</strong> {selectedTrace.employeeContext.department}</div>
                    <div style={{ fontSize: '0.875rem' }}><strong>Location:</strong> {selectedTrace.employeeContext.location}</div>
                    {selectedTrace.employeeContext.tags && selectedTrace.employeeContext.tags.length > 0 && (
                      <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                        <strong>Tags:</strong> {selectedTrace.employeeContext.tags.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Extracted Info */}
              {selectedTrace.extractedInfo && Object.keys(selectedTrace.extractedInfo).length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', color: '#cbd5e1', marginBottom: '0.75rem' }}>📊 Extracted Information</h3>
                  <pre style={{ padding: '1rem', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '8px', overflow: 'auto', fontSize: '0.875rem' }}>
                    {JSON.stringify(selectedTrace.extractedInfo, null, 2)}
                  </pre>
                </div>
              )}

              {/* Fuzzy Matches */}
              {selectedTrace.fuzzyMatches && Object.keys(selectedTrace.fuzzyMatches).length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', color: '#cbd5e1', marginBottom: '0.75rem' }}>🔮 Fuzzy Matching</h3>
                  <div style={{ padding: '1rem', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '8px' }}>
                    {Object.entries(selectedTrace.fuzzyMatches).map(([field, match]: [string, any]) => (
                      <div key={field} style={{ marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                        <strong>{field}:</strong> "{match.original}" → "{match.matched}"
                        <span style={{ color: match.confidence > 0.9 ? '#10b981' : match.confidence > 0.7 ? '#f59e0b' : '#ef4444', marginLeft: '0.5rem' }}>
                          ({(match.confidence * 100).toFixed(0)}% confidence)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* RAG Context */}
              {selectedTrace.ragContext && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', color: '#cbd5e1', marginBottom: '0.75rem' }}>📚 RAG Document Retrieval</h3>
                  <div style={{ padding: '1rem', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                      <strong>Documents Searched:</strong> {selectedTrace.ragContext.documentsSearched}<br />
                      <strong>Documents Retrieved:</strong> {selectedTrace.ragContext.documentsRetrieved}
                    </div>
                    {selectedTrace.ragContext.documents && selectedTrace.ragContext.documents.length > 0 && (
                      <div style={{ marginTop: '1rem' }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Top Documents:</div>
                        {selectedTrace.ragContext.documents.map((doc, idx) => (
                          <div key={idx} style={{ marginBottom: '0.75rem', padding: '0.75rem', background: 'rgba(30, 41, 59, 0.7)', borderRadius: '6px', fontSize: '0.875rem' }}>
                            <div><strong>{doc.title}</strong> ({doc.category})</div>
                            <div style={{ color: '#3b82f6', marginTop: '0.25rem' }}>Similarity: {(doc.similarity * 100).toFixed(1)}%</div>
                            <div style={{ color: '#94a3b8', marginTop: '0.5rem', fontSize: '0.8125rem' }}>{doc.chunkPreview.substring(0, 100)}...</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Rule Matching */}
              {selectedTrace.ruleMatching && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', color: '#cbd5e1', marginBottom: '0.75rem' }}>⚙️ Rule Matching</h3>
                  <div style={{ padding: '1rem', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '8px', fontSize: '0.875rem' }}>
                    <div><strong>Rules Evaluated:</strong> {selectedTrace.ruleMatching.rulesEvaluated}</div>
                    {selectedTrace.ruleMatching.matchedRule ? (
                      <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '6px' }}>
                        <div style={{ color: '#22c55e', fontWeight: 500 }}>✅ Matched Rule</div>
                        <div style={{ marginTop: '0.5rem' }}><strong>Name:</strong> {selectedTrace.ruleMatching.matchedRule.name}</div>
                        <div><strong>Assignee:</strong> {selectedTrace.ruleMatching.matchedRule.assignee}</div>
                        {selectedTrace.ruleMatching.matchedRule.matchedConditions && selectedTrace.ruleMatching.matchedRule.matchedConditions.length > 0 && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <strong>Conditions:</strong>
                            <ul style={{ marginTop: '0.25rem', marginLeft: '1.5rem' }}>
                              {selectedTrace.ruleMatching.matchedRule.matchedConditions.map((cond, idx) => (
                                <li key={idx}>{cond.field} {cond.operator} "{cond.value}"</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ marginTop: '0.75rem', color: '#f59e0b' }}>No matching rule found</div>
                    )}
                  </div>
                </div>
              )}

              {/* AI Response */}
              {selectedTrace.aiResponse && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', color: '#cbd5e1', marginBottom: '0.75rem' }}>🤖 AI Response</h3>
                  <div style={{ padding: '1rem', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '8px', fontSize: '0.875rem' }}>
                    <div><strong>Model:</strong> {selectedTrace.aiResponse.model}</div>
                    {selectedTrace.aiResponse.totalTokens && (
                      <div><strong>Tokens:</strong> {selectedTrace.aiResponse.totalTokens}</div>
                    )}
                    <div><strong>Latency:</strong> {selectedTrace.aiResponse.latencyMs}ms</div>
                  </div>
                </div>
              )}

              {/* Performance */}
              {selectedTrace.performance && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', color: '#cbd5e1', marginBottom: '0.75rem' }}>⏱️ Performance</h3>
                  <div style={{ padding: '1rem', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '8px', fontSize: '0.875rem' }}>
                    <div><strong>Total Duration:</strong> {selectedTrace.performance.totalDurationMs}ms</div>
                    {Object.keys(selectedTrace.performance.stages).length > 0 && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <strong>Stage Timings:</strong>
                        <ul style={{ marginTop: '0.25rem', marginLeft: '1.5rem' }}>
                          {Object.entries(selectedTrace.performance.stages).map(([stage, ms]) => (
                            <li key={stage}>{stage}: {ms}ms</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Errors */}
              {selectedTrace.errors && selectedTrace.errors.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', color: '#ef4444', marginBottom: '0.75rem' }}>❌ Errors</h3>
                  {selectedTrace.errors.map((error, idx) => (
                    <div key={idx} style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', fontSize: '0.875rem' }}>
                      <div><strong>Stage:</strong> {error.stage}</div>
                      <div><strong>Error:</strong> {error.error}</div>
                      {error.stack && (
                        <pre style={{ marginTop: '0.5rem', fontSize: '0.75rem', overflow: 'auto', maxHeight: '200px' }}>
                          {error.stack}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Messages */}
              {selectedTrace.messages && selectedTrace.messages.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', color: '#cbd5e1', marginBottom: '0.75rem' }}>💬 Conversation ({selectedTrace.messages.length} messages)</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {selectedTrace.messages.map((msg, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.75rem',
                          background: msg.role === 'assistant' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(30, 41, 59, 0.7)',
                          border: `1px solid ${msg.role === 'assistant' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(148, 163, 184, 0.2)'}`,
                          borderRadius: '8px',
                          fontSize: '0.875rem'
                        }}
                      >
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem', fontWeight: 500, textTransform: 'uppercase' }}>
                          {msg.role}
                        </div>
                        <div style={{ color: '#e2e8f0' }}>{msg.content}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
