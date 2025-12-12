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

export default function ConfigurePage() {
  const [rules, setRules] = useState<TriageRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<TriageRule | null>(null);

  const fetchRules = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/rules`);
      if (!response.ok) throw new Error("Failed to fetch rules");
      const data = await response.json();
      setRules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleCreateRule = () => {
    setEditingRule({
      id: "",
      name: "",
      conditions: [{ field: "requestType", operator: "equals", value: "" }],
      assignee: "",
      priority: rules.length + 1,
      enabled: true,
    });
    setShowModal(true);
  };

  const handleEditRule = (rule: TriageRule) => {
    setEditingRule(rule);
    setShowModal(true);
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Are you sure you want to delete this rule?")) return;

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

  if (loading) {
    return (
      <div className="configure-page">
        <p>Loading configuration...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="configure-page">
        <p style={{ color: "#ef4444" }}>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="configure-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Triage Rules Configuration</h1>
        <button className="btn btn-primary" onClick={handleCreateRule}>
          + New Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="empty-state">
          <h3>No triage rules configured</h3>
          <p>Create your first rule to start routing legal requests.</p>
        </div>
      ) : (
        <div className="rules-list">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`rule-card ${!rule.enabled ? "disabled" : ""}`}
            >
              <div className="rule-header">
                <div className="rule-title">
                  <h3>{rule.name}</h3>
                  <span className="rule-priority">Priority: {rule.priority}</span>
                </div>
                <div className="rule-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleToggleRule(rule)}
                  >
                    {rule.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleEditRule(rule)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDeleteRule(rule.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="rule-conditions">
                {rule.conditions.map((condition, idx) => (
                  <span key={idx} className="condition-tag">
                    {condition.field} {condition.operator} "{condition.value}"
                  </span>
                ))}
              </div>

              <div className="rule-assignee">
                Assign to: <strong>{rule.assignee}</strong>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && editingRule && (
        <RuleModal
          rule={editingRule}
          onClose={() => {
            setShowModal(false);
            setEditingRule(null);
          }}
          onSave={async () => {
            await fetchRules();
            setShowModal(false);
            setEditingRule(null);
          }}
        />
      )}
    </div>
  );
}

interface RuleModalProps {
  rule: TriageRule;
  onClose: () => void;
  onSave: () => void;
}

function RuleModal({ rule, onClose, onSave }: RuleModalProps) {
  const [formData, setFormData] = useState(rule);
  const [saving, setSaving] = useState(false);

  const handleAddCondition = () => {
    setFormData({
      ...formData,
      conditions: [
        ...formData.conditions,
        { field: "requestType", operator: "equals", value: "" },
      ],
    });
  };

  const handleRemoveCondition = (index: number) => {
    setFormData({
      ...formData,
      conditions: formData.conditions.filter((_, i) => i !== index),
    });
  };

  const handleConditionChange = (
    index: number,
    key: keyof TriageCondition,
    value: string
  ) => {
    const newConditions = [...formData.conditions];
    newConditions[index] = { ...newConditions[index], [key]: value };
    setFormData({ ...formData, conditions: newConditions });
  };

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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{formData.id ? "Edit Rule" : "Create New Rule"}</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Rule Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
              placeholder="e.g., Sales Contracts - Australia"
            />
          </div>

          <div className="form-group">
            <label>Assignee Email</label>
            <input
              type="email"
              value={formData.assignee}
              onChange={(e) =>
                setFormData({ ...formData, assignee: e.target.value })
              }
              required
              placeholder="legal-team@acme.corp"
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
              required
              min="1"
            />
          </div>

          <div className="form-group">
            <label>Conditions</label>
            <div className="conditions-builder">
              {formData.conditions.map((condition, index) => (
                <div key={index} className="condition-row">
                  <select
                    value={condition.field}
                    onChange={(e) =>
                      handleConditionChange(index, "field", e.target.value)
                    }
                  >
                    <option value="requestType">Request Type</option>
                    <option value="location">Location</option>
                    <option value="department">Department</option>
                  </select>

                  <select
                    value={condition.operator}
                    onChange={(e) =>
                      handleConditionChange(
                        index,
                        "operator",
                        e.target.value as "equals" | "contains"
                      )
                    }
                  >
                    <option value="equals">equals</option>
                    <option value="contains">contains</option>
                  </select>

                  <input
                    type="text"
                    value={condition.value}
                    onChange={(e) =>
                      handleConditionChange(index, "value", e.target.value)
                    }
                    placeholder="Value"
                    required
                  />

                  {formData.conditions.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => handleRemoveCondition(index)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                className="btn btn-secondary btn-sm btn-add-condition"
                onClick={handleAddCondition}
              >
                + Add Condition
              </button>
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Rule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
