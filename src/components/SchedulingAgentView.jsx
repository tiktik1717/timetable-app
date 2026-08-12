import { useState } from "react";

export default function SchedulingAgentView({
  agentContext,
  validationReport,
  rules,
  onRulesChange,
  approvedExceptions,
  onApprovedExceptionsChange,
  messages,
  onMessagesChange,
}) {
  const [input, setInput] = useState("");
  const [newRuleText, setNewRuleText] = useState("");
  const [isAgentThinking, setIsAgentThinking] = useState(false);

  function createAgentMessage(text, type = "message", actions = []) {
    return {
      id: `agent-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: "agent",
      type,
      text,
      createdAt: new Date().toISOString(),
      actions,
    };
  }

  async function handleSend() {
    const text = input.trim();

    if (!text || isAgentThinking) {
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      type: "message",
      text,
      createdAt: new Date().toISOString(),
      actions: [],
    };

    onMessagesChange((prev) => [...prev, userMessage]);

    setInput("");
    setIsAgentThinking(true);

    try {
      const response = await fetch("/.netlify/functions/scheduling-agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          message: text,

          validationSummary: {
            statistics: validationReport?.statistics || {},

            errors: validationReport?.errors || [],

            warnings: validationReport?.warnings || [],
          },

          rules: rules || [],

          approvedExceptions: approvedExceptions || [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "שגיאה בתקשורת עם סוכן השיבוץ");
      }

      const agentMessage = {
        id: `agent-${Date.now()}`,
        role: "agent",
        type: "message",
        text: data.reply || "הסוכן לא החזיר תשובה.",
        createdAt: new Date().toISOString(),
        actions: [],
      };

      onMessagesChange((prev) => [...prev, agentMessage]);
    } catch (error) {
      console.error("Scheduling agent request failed:", error);

      const errorMessage = {
        id: `agent-error-${Date.now()}`,
        role: "agent",
        type: "error",
        text: "לא הצלחתי ליצור קשר עם סוכן השיבוץ. " + (error?.message || ""),
        createdAt: new Date().toISOString(),
        actions: [],
      };

      onMessagesChange((prev) => [...prev, errorMessage]);
    } finally {
      setIsAgentThinking(false);
    }
  }

  //const rules = agentContext?.rules || [];

  //const approvedExceptions = agentContext?.approvedExceptions || [];

  const statistics = validationReport?.statistics || {};

  function handleAddRule() {
    const text = newRuleText.trim();

    if (!text) {
      return;
    }

    const newRule = {
      id: `rule-${Date.now()}`,
      originalText: text,
      status: "unparsed",
      createdAt: new Date().toISOString(),
    };

    onRulesChange((prev) => [...prev, newRule]);

    setNewRuleText("");
  }

  return (
    <div className="scheduling-agent-view">
      <h2>סוכן שיבוץ AI</h2>

      <div className="scheduling-agent-layout">
        <section className="scheduling-agent-chat">
          <h3>שיחה עם הסוכן</h3>

          <div className="scheduling-agent-messages">
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={
                  message.role === "user"
                    ? "scheduling-agent-message user"
                    : "scheduling-agent-message agent"
                }
              >
                <strong>{message.role === "user" ? "אתה" : "הסוכן"}</strong>

                <div>{message.text}</div>
              </div>
            ))}
          </div>

          {isAgentThinking && (
            <div className="scheduling-agent-thinking">
              הסוכן בודק את הנתונים...
            </div>
          )}

          <div className="scheduling-agent-input-row">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="כתוב לסוכן..."
              rows={3}
            />

            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || isAgentThinking}
            >
              {isAgentThinking ? "חושב..." : "שלח"}
            </button>
          </div>
        </section>

        <aside className="scheduling-agent-sidebar">
          <div className="scheduling-agent-panel">
            <h3>חוקי־על</h3>

            <textarea
              value={newRuleText}
              onChange={(e) => setNewRuleText(e.target.value)}
              placeholder="לדוגמה: כל כיתות ד' חייבות לסיים בכל יום באותה שעה"
              rows={3}
              style={{ width: "100%" }}
            />

            <button
              type="button"
              onClick={handleAddRule}
              disabled={!newRuleText.trim()}
            >
              הוסף חוק
            </button>

            {rules.length === 0 ? (
              <p>עדיין לא הוגדרו חוקי־על.</p>
            ) : (
              <ul>
                {rules.map((rule) => (
                  <li key={rule.id}>
                    <div>{rule.originalText}</div>

                    <small>סטטוס: {rule.status}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="scheduling-agent-panel">
            <h3>חריגים מאושרים</h3>

            {approvedExceptions.length === 0 ? (
              <p>אין חריגים מאושרים.</p>
            ) : (
              <ul>
                {approvedExceptions.map((exception, index) => (
                  <li key={index}>
                    {exception.type}
                    {" — "}
                    {exception.teacherId || ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
