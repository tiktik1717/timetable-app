import { useState } from "react";
import {
  solveWithAgent,
} from "../scheduling/agentSolver";

export default function SchedulingAgentView({
  agentContext,
  validationReport,
  rules,
  onRulesChange,
  approvedExceptions,
  onApprovedExceptionsChange,
  messages,
  onMessagesChange,
  onSimulateScheduleMove,

  workspace,
  onStartWorkspace,
  onClearWorkspace,

  onTryWorkspaceMove,
  onTryWorkspaceMovePure,
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

  async function runAgentSolver(
    initialAction
  ) {
    const initialWorkspace =
      workspace ||
      onStartWorkspace?.();

    if (
      !initialWorkspace ||
      !onTryWorkspaceMovePure
    ) {
      return null;
    }

    const result =
      await solveWithAgent({
        initialAction,

        workspace:
          initialWorkspace,

        tryWorkspaceMove:
          onTryWorkspaceMovePure,

        evaluateAttempt:
          async ({
            attemptedAction,
            attemptResult,
          }) => {
            return await askAgentToEvaluateAttempt({
              attemptedAction,
              attemptResult,
            });
          },
      });

    console.log(
      "AGENT SOLVER RESULT:",
      result
    );

    return result;
  }

  function buildTeacherScheduleSummary(
    scheduleOverride = null
  ) {
    const schedule =
      scheduleOverride ||
      agentContext?.baseSchedule ||
      {};

    const units =
      agentContext?.schoolData?.teachingUnits || [];

    const teachers =
      agentContext?.schoolData?.teachers || [];

    const result = {};

    for (const teacher of teachers) {
      result[String(teacher.id)] = {
        teacherId: String(teacher.id),
        teacherName: teacher.name,
        days: {},
      };
    }

    for (const [day, daySchedule] of Object.entries(
      schedule
    )) {
      for (const [
        className,
        classSchedule,
      ] of Object.entries(daySchedule || {})) {
        for (const [
          hourKey,
          cellValue,
        ] of Object.entries(classSchedule || {})) {
          const hour = Number(hourKey);

          const unitIds = Array.isArray(cellValue)
            ? cellValue
            : cellValue
              ? [cellValue]
              : [];

          for (const unitId of unitIds) {
            const unit = units.find(
              (item) => item.id === unitId
            );

            if (!unit?.teacherId) {
              continue;
            }

            const teacherId = String(
              unit.teacherId
            );

            if (!result[teacherId]) {
              result[teacherId] = {
                teacherId,
                teacherName:
                  unit.teacherName || teacherId,
                days: {},
              };
            }

            if (!result[teacherId].days[day]) {
              result[teacherId].days[day] = [];
            }

            result[teacherId].days[day].push({
              hour,
              className,
              unitId,
              unitType: unit.type || null,
            });
          }
        }
      }
    }

    // מיון השעות בכל יום
    for (const teacher of Object.values(result)) {
      for (const day of Object.keys(
        teacher.days
      )) {
        teacher.days[day].sort(
          (a, b) => a.hour - b.hour
        );
      }
    }

    return result;
  }

  async function askAgentToEvaluateAttempt({
    attemptedAction,
    attemptResult,
  }) {
    const workspaceSchedule =
      attemptResult?.workspace
        ?.workingSchedule;

    const workspaceTeacherSummary =
      buildTeacherScheduleSummary(
        workspaceSchedule
      );

    const response = await fetch(
      "/.netlify/functions/scheduling-agent",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          message: `
בוצע עכשיו ניסיון אוטומטי בתוך Agent Workspace.

הפעולה שנוסתה:
${JSON.stringify(
            attemptedAction,
            null,
            2
          )}

תוצאת הניסיון:
${JSON.stringify(
            {
              success:
                attemptResult.success,

              error:
                attemptResult.error,

              validationComparison:
                attemptResult
                  .validationComparison,
            },
            null,
            2
          )}

זו אינה המערכת האמיתית אלא working schedule זמני.

בדוק עכשיו האם הניסיון פתר את הבעיה שביקש המשתמש לפתור.

אם הניסיון נכשל או לא פתר את הבעיה,
מצא בעצמך ניסיון אחר.

אם הניסיון פתר את הבעיה ולא יצר בעיית Core חדשה,
דווח שהמועמד מתאים להמשך בדיקה.
        `,

          conversationHistory:
            messages || [],

          validationSummary:
            attemptResult
              ?.validationReport || {},

          entitySummary: {
            teachers:
              agentContext?.schoolData
                ?.teachers?.map(
                  (teacher) => ({
                    id: teacher.id,
                    name: teacher.name,
                  })
                ) || [],

            classes:
              agentContext?.schoolData
                ?.classes || [],

            meetings:
              agentContext?.schoolData
                ?.meetings?.map(
                  (meeting) => ({
                    id: meeting.id,
                    name: meeting.name,
                  })
                ) || [],
          },

          teacherScheduleSummary:
            workspaceTeacherSummary,

          rules: rules || [],

          approvedExceptions:
            approvedExceptions || [],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
        "שגיאה בבדיקת ניסיון הסוכן"
      );
    }

    return data;
  }

  async function handleSend() {
    const text = input.trim();

    if (!text || isAgentThinking) {
      return;
    }

    // בדיקה זמנית:
    // בניית תקציר מערכת השעות לפי מורים.
    // בשלב זה עדיין לא שולחים אותו לסוכן.
    const teacherScheduleSummary =
      buildTeacherScheduleSummary();

    console.log(
      "RAW AGENT SCHEDULE:",
      agentContext?.baseSchedule
    );

    console.log(
      "RAW AGENT SCHOOL DATA:",
      agentContext?.schoolData
    );


    console.log(
      "Teacher schedule summary:",
      teacherScheduleSummary
    );

    console.log(
      "Kolodkin schedule:",
      teacherScheduleSummary["40"]
    );

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      type: "message",
      text,
      createdAt: new Date().toISOString(),
      actions: [],
    };

    onMessagesChange((prev) => [
      ...prev,
      userMessage,
    ]);

    setInput("");
    setIsAgentThinking(true);

    try {
      const response = await fetch(
        "/.netlify/functions/scheduling-agent",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            message: text,

            conversationHistory: [
              ...(messages || []),
              userMessage,
            ],

            validationSummary: {
              statistics:
                validationReport?.statistics || {},

              errors:
                validationReport?.errors || [],

              warnings:
                validationReport?.warnings || [],
            },

            entitySummary: {
              teachers:
                agentContext?.schoolData?.teachers?.map(
                  (teacher) => ({
                    id: teacher.id,
                    name: teacher.name,
                  })
                ) || [],

              classes:
                agentContext?.schoolData?.classes || [],

              meetings:
                agentContext?.schoolData?.meetings?.map(
                  (meeting) => ({
                    id: meeting.id,
                    name: meeting.name,
                  })
                ) || [],
            },

            teacherScheduleSummary,

            rules: rules || [],

            approvedExceptions:
              approvedExceptions || [],
          }),
        }
      );

      const data = await response.json();

      console.log(
        "Scheduling agent proposed action:",
        data.proposedAction
      );

      if (!response.ok) {
        throw new Error(
          data?.error ||
          "שגיאה בתקשורת עם סוכן השיבוץ"
        );
      }

      if (
        proposedAction?.type ===
        "proposeScheduleMove"
      ) {
        const solverResult =
          await runAgentSolver(
            proposedAction
          );

        console.log(
          "FINAL SOLVER RESULT:",
          solverResult
        );
      }
      
      const ruleCheckResults =
        Array.isArray(data.ruleCheckResults)
          ? data.ruleCheckResults
          : [];

      if (ruleCheckResults.length > 0) {
        onRulesChange((prev) =>
          prev.map((rule) => {
            const result =
              ruleCheckResults.find(
                (item) =>
                  item.ruleId === rule.id
              );

            if (!result) {
              return rule;
            }

            return {
              ...rule,

              checkStatus:
                result.status,

              checkSummary:
                result.summary,

              checkViolations:
                result.violations || [],

              checkedAt:
                new Date().toISOString(),
            };
          })
        );
      }

      let proposedAction =
        data.proposedAction;

      if (
        proposedAction?.type ===
        "proposeScheduleMove" &&
        onTryWorkspaceMove
      ) {
        const attemptResult =
          onTryWorkspaceMove(
            proposedAction
          );

        proposedAction = {
          ...proposedAction,

          simulation: {
            success:
              attemptResult.success,

            error:
              attemptResult.error || null,

            validationStatistics:
              attemptResult
                .validationReport
                ?.statistics || null,

            validationErrors:
              attemptResult
                .validationReport
                ?.errors || [],

            validationComparison:
              attemptResult
                .validationComparison ||
              null,

            workspaceAttemptCount:
              attemptResult.workspace
                ?.attempts?.length || 0,
          },
        };
        const evaluationData =
          await askAgentToEvaluateAttempt({
            attemptedAction:
              proposedAction,

            attemptResult,
          });

        console.log(
          "AGENT ATTEMPT EVALUATION:",
          evaluationData
        );
      }

      const agentMessage = {
        id: `agent-${Date.now()}`,
        role: "agent",
        type: "message",
        text:
          data.reply ||
          "הסוכן לא החזיר תשובה.",
        createdAt: new Date().toISOString(),

        actions: proposedAction
          ? [
            {
              ...proposedAction,
              status: "pending",
            },
          ]
          : [],
      };

      onMessagesChange((prev) => [
        ...prev,
        agentMessage,
      ]);
    } catch (error) {
      console.error(
        "Scheduling agent request failed:",
        error
      );

      const errorMessage = {
        id: `agent-error-${Date.now()}`,
        role: "agent",
        type: "error",
        text:
          "לא הצלחתי ליצור קשר עם סוכן השיבוץ. " +
          (error?.message || ""),
        createdAt: new Date().toISOString(),
        actions: [],
      };

      onMessagesChange((prev) => [
        ...prev,
        errorMessage,
      ]);
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

  function handleApproveAction(messageId, action) {
    if (
      action.type ===
      "approveMeetingParticipantException"
    ) {
      const newException = {
        type: "meetingParticipant",
        meetingId: action.meetingId,
        teacherId: String(action.teacherId),
      };

      onApprovedExceptionsChange((prev) => {
        const alreadyExists = prev.some(
          (exception) =>
            exception.type ===
            newException.type &&
            exception.meetingId ===
            newException.meetingId &&
            String(exception.teacherId) ===
            newException.teacherId
        );

        if (alreadyExists) {
          return prev;
        }

        return [...prev, newException];
      });

      onMessagesChange((prev) =>
        prev.map((message) => {
          if (message.id !== messageId) {
            return message;
          }

          return {
            ...message,

            actions: message.actions.map(
              (existingAction) =>
                existingAction === action
                  ? {
                    ...existingAction,
                    status: "approved",
                  }
                  : existingAction
            ),
          };
        })
      );
    }

    if (
      action.type === "updateRuleInterpretation"
    ) {
      onRulesChange((prev) =>
        prev.map((rule) => {
          if (rule.id !== action.ruleId) {
            return rule;
          }

          return {
            ...rule,

            status:
              action.formalizationStatus,

            interpretation:
              action.interpretation,

            formalRule: (() => {
              if (!action.formalRuleJson) {
                return null;
              }

              try {
                return JSON.parse(
                  action.formalRuleJson
                );
              } catch (error) {
                console.error(
                  "Failed to parse formal rule JSON:",
                  error
                );

                return null;
              }
            })(),

            clarificationQuestion:
              action.clarificationQuestion,

            parsedAt:
              new Date().toISOString(),
          };
        })
      );

      onMessagesChange((prev) =>
        prev.map((message) => {
          if (message.id !== messageId) {
            return message;
          }

          return {
            ...message,

            actions: message.actions.map(
              (existingAction) =>
                existingAction === action
                  ? {
                    ...existingAction,
                    status: "approved",
                  }
                  : existingAction
            ),
          };
        })
      );

      return;
    }
  }

  function handleDeleteRule(ruleId) {
    onRulesChange((prev) =>
      prev.filter((rule) => rule.id !== ruleId)
    );
  }

  function handleDeleteException(exceptionToDelete) {
    onApprovedExceptionsChange((prev) =>
      prev.filter(
        (exception) =>
          !(
            exception.type === exceptionToDelete.type &&
            exception.meetingId ===
            exceptionToDelete.meetingId &&
            String(exception.teacherId) ===
            String(exceptionToDelete.teacherId)
          )
      )
    );
  }

  return (
    <div className="scheduling-agent-view">
      <h2>סוכן שיבוץ AI</h2>
      <div className="scheduling-agent-workspace-controls">
        {!workspace ? (
          <button
            type="button"
            onClick={onStartWorkspace}
          >
            התחל סביבת עבודה
          </button>
        ) : (
          <>
            <div>
              סביבת עבודה פעילה
            </div>

            <div>
              ניסיונות:{" "}
              {workspace.attempts?.length || 0}
            </div>

            <button
              type="button"
              onClick={onClearWorkspace}
            >
              סגור סביבת עבודה
            </button>
          </>
        )}
      </div>
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
                {Array.isArray(message.actions) &&
                  message.actions.map(
                    (action, actionIndex) => (
                      <div
                        key={actionIndex}
                        className="scheduling-agent-action"
                      >
                        <div>
                          {action.explanation}
                        </div>

                        {action.status === "pending" &&
                          action.type !== "proposeScheduleMove" && (
                            <button
                              type="button"
                              onClick={() =>
                                handleApproveAction(
                                  message.id,
                                  action
                                )
                              }
                            >
                              {action.type ===
                                "approveMeetingParticipantException"
                                ? "אשר חריג"
                                : action.type ===
                                  "updateRuleInterpretation"
                                  ? "אשר פרשנות"
                                  : "אשר פעולה"}
                            </button>
                          )}

                        {action.status === "pending" &&
                          action.type === "proposeScheduleMove" && (
                            <div className="scheduling-agent-action-pending-validation">
                              הצעת שינוי — טרם נבדקה מול כלל אילוצי המערכת
                            </div>
                          )}

                        {action.status === "pending" &&
                          action.type === "proposeScheduleMove" && (
                            <div className="scheduling-agent-action-pending-validation">

                              {action.simulation?.success ? (
                                <>
                                  <div>
                                    ✓ השינוי עבר סימולציה
                                    ראשונית מול ה־validator.
                                  </div>

                                  <div>
                                    שגיאות Core Validator לאחר
                                    השינוי:{" "}
                                    {action.simulation
                                      ?.validationStatistics
                                      ?.errorCount ?? 0}
                                  </div>

                                  <div>
                                    עדיין נדרשת בדיקת חוקי־העל
                                    מול המערכת המדומה.
                                  </div>
                                </>
                              ) : (
                                <div>
                                  ✕ לא ניתן לבצע אפילו סימולציה
                                  של ההצעה:{" "}
                                  {action.simulation?.error ||
                                    "שגיאה לא ידועה"}
                                </div>
                              )}

                            </div>
                          )}

                        {action.simulation
                          ?.workspaceAttemptCount > 0 && (
                            <div>
                              ניסיון בסביבת העבודה:{" "}
                              {
                                action.simulation
                                  .workspaceAttemptCount
                              }
                            </div>
                          )}

                        {action.status === "approved" && (
                          <div className="scheduling-agent-action-approved">
                            ✓ החריג אושר
                          </div>
                        )}
                      </div>
                    )
                  )}
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
              <ul className="scheduling-agent-list">
                {rules.map((rule) => (
                  <li
                    key={rule.id}
                    className="scheduling-agent-list-item"
                  >
                    <div className="scheduling-agent-list-content">
                      <div>
                        {rule.originalText}
                      </div>

                      <small>
                        סטטוס: {rule.status}
                      </small>

                      {rule.checkStatus && (
                        <div className="scheduling-agent-rule-check">
                          <div>
                            מצב במערכת:{" "}
                            <strong>
                              {rule.checkStatus === "satisfied"
                                ? "✓ מתקיים"
                                : rule.checkStatus === "violated"
                                  ? "✕ מופר"
                                  : rule.checkStatus === "stale"
                                    ? "נדרשת בדיקה מחדש"
                                    : "לא ניתן לקבוע"}
                            </strong>
                          </div>

                          {rule.checkStatus === "stale" ? (
                            <div>
                              מערכת השעות השתנתה מאז הבדיקה האחרונה.
                            </div>
                          ) : (
                            <>
                              {rule.checkSummary && (
                                <div>
                                  {rule.checkSummary}
                                </div>
                              )}

                              {Array.isArray(rule.checkViolations) &&
                                rule.checkViolations.length > 0 && (
                                  <ul>
                                    {rule.checkViolations.map(
                                      (violation, index) => (
                                        <li key={index}>
                                          {violation.day &&
                                            `יום ${violation.day}: `}

                                          {violation.explanation}
                                        </li>
                                      )
                                    )}
                                  </ul>
                                )}
                            </>
                          )}
                        </div>
                      )}

                    </div>

                    <button
                      type="button"
                      className="scheduling-agent-delete-button"
                      onClick={() =>
                        handleDeleteRule(rule.id)
                      }
                    >
                      מחק
                    </button>
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
              <ul className="scheduling-agent-list">
                {approvedExceptions.map(
                  (exception, index) => (
                    <li
                      key={`${exception.type}-${exception.meetingId}-${exception.teacherId}-${index}`}
                      className="scheduling-agent-list-item"
                    >
                      <div className="scheduling-agent-list-content">
                        <div>
                          {exception.type}
                          {" — "}
                          {exception.teacherId || ""}
                        </div>

                        {exception.meetingId && (
                          <small>
                            {exception.meetingId}
                          </small>
                        )}
                      </div>

                      <button
                        type="button"
                        className="scheduling-agent-delete-button"
                        onClick={() =>
                          handleDeleteException(exception)
                        }
                      >
                        מחק
                      </button>
                    </li>
                  )
                )}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
