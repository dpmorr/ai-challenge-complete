import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";

type Role = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
}

const createMessage = (overrides?: Partial<ChatMessage>): ChatMessage => ({
  id: Math.random().toString(36).slice(2),
  role: "assistant",
  content: "",
  ...overrides,
});

// Demo email examples
const demoEmails = [
  {
    from: "ceo@acme.corp",
    subject: "Urgent: Employment contract review",
    body: "I need someone to review an executive employment contract ASAP. This is for a VP-level hire.",
    description: "VIP Executive - Employment Contract"
  },
  {
    from: "sales.au@acme.corp",
    subject: "Sales contract question",
    body: "I have a question about a sales contract with a client in Sydney. Can someone assist?",
    description: "Australia Sales - Sales Contract"
  },
  {
    from: "eng.au@acme.corp",
    subject: "Need NDA for vendor",
    body: "I'm working with a new vendor and they need an NDA signed before we can proceed. Can someone help?",
    description: "Australia Engineering - NDA"
  },
  {
    from: "marketing.head@acme.corp",
    subject: "Marketing materials review",
    body: "I need a quick review of our new marketing campaign materials to make sure we're not making any claims that could get us in trouble.",
    description: "VIP Marketing - Marketing Review"
  }
];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDemoMenu, setShowDemoMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const canSubmit = useMemo(
    () => input.trim().length > 0 && !isStreaming,
    [input, isStreaming]
  );

  // Auto-populate employee email if user is logged in
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.email) {
          setEmployeeEmail(user.email);
        }
      } catch (err) {
        console.error("Failed to parse user from localStorage:", err);
      }
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInput(event.target.value);
  };

  const loadDemoEmail = (demo: typeof demoEmails[0]) => {
    setEmployeeEmail(demo.from);
    setInput(`Subject: ${demo.subject}\n\n${demo.body}`);
    setShowDemoMenu(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const userText = input.trim();

    if (!userText || isStreaming) {
      return;
    }

    const userMessage = createMessage({ role: "user", content: userText });
    const assistantMessage = createMessage({ role: "assistant", content: "" });

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");
    setError(null);
    setIsStreaming(true);

    const conversation = [...messages, { role: "user", content: userText }]
      .map(({ role, content }) => ({ role, content }))
      .filter(
        (message): message is { role: Role; content: string } =>
          typeof message.role === "string" &&
          typeof message.content === "string"
      );

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: conversation,
          employeeEmail: employeeEmail.trim() || undefined
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to connect to chat service");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        if (value) {
          assistantText += decoder.decode(value, { stream: true });
          const currentText = assistantText;
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessage.id
                ? { ...message, content: currentText }
                : message
            )
          );
        }
      }

      assistantText += decoder.decode();

      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantMessage.id
            ? { ...message, content: assistantText }
            : message
        )
      );
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong";
      console.error(caughtError);
      setError(message);
      setMessages((prev) =>
        prev.filter((msg) => msg.id !== assistantMessage.id)
      );
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="chat-page">
      <header className="chat-header">
        <div>
          <h1>Frontdoor</h1>
          <p>AI-powered legal request triage with context-aware routing</p>
        </div>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowDemoMenu(!showDemoMenu)}
            className="demo-button"
            style={{
              padding: "8px 16px",
              background: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            📧 Demo Emails
          </button>
          {showDemoMenu && (
            <div
              className="demo-menu"
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "8px",
                background: "white",
                border: "1px solid #ddd",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                zIndex: 1000,
                minWidth: "320px"
              }}
            >
              <div style={{ padding: "12px", borderBottom: "1px solid #eee", fontWeight: 600 }}>
                Example Email Scenarios
              </div>
              {demoEmails.map((demo, index) => (
                <button
                  key={index}
                  onClick={() => loadDemoEmail(demo)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    textAlign: "left",
                    border: "none",
                    borderBottom: index < demoEmails.length - 1 ? "1px solid #eee" : "none",
                    background: "white",
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                >
                  <div style={{ fontWeight: 600, marginBottom: "4px", color: "#333" }}>
                    {demo.description}
                  </div>
                  <div style={{ fontSize: "12px", color: "#666" }}>
                    From: {demo.from}
                  </div>
                  <div style={{ fontSize: "12px", color: "#999", marginTop: "2px" }}>
                    {demo.subject}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="chat-window">
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p className="placeholder" style={{ marginBottom: "16px" }}>
              No messages yet... Make a request!
            </p>
            <button
              onClick={() => setShowDemoMenu(true)}
              style={{
                padding: "10px 20px",
                background: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              📧 Try a Demo Email
            </button>
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`message message-${message.role}`}>
            <span className="message-role">
              {message.role === "user" ? "You" : "Assistant"}
            </span>
            <p style={{ whiteSpace: "pre-wrap" }}>
              {message.content ||
                (message.role === "assistant" && isStreaming ? "…" : "")}
            </p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {error && <div className="chat-error">{error}</div>}

      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          id="employee-email"
          type="email"
          value={employeeEmail}
          onChange={(e) => setEmployeeEmail(e.target.value)}
          placeholder="Your email (optional - enables auto-context)"
          disabled={isStreaming}
          style={{ flex: "0 0 250px" }}
        />
        <textarea
          id="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What legal request do you have? (or click 'Demo Emails' above)"
          disabled={isStreaming}
          rows={3}
          style={{ flex: 1, resize: "vertical", padding: "8px", fontFamily: "inherit" }}
        />
        <button type="submit" disabled={!canSubmit}>
          {isStreaming ? "Thinking…" : "Send"}
        </button>
      </form>
    </div>
  );
}
