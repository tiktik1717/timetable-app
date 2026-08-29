import { useMemo, useState } from "react";
import {
  solveWithAgent,
} from "../scheduling/agentSolver";
import {
  evaluateFormalRules,
  formalRuleEvaluationsToRuleCheckResults,
} from "../scheduling/ruleEvaluator";
import {
  validateSemanticContract,
  repairFormalRuleSemanticContract,
  buildExistsRepairFromSemanticOnly,
  preserveSafePartialFormalRule,
} from "../scheduling/semanticContractValidator";
import { validateSchedule } from "../scheduling/scheduleValidator";


function downloadJsonFile(data, filename) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function buildRuleCompilerExportFilename(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") +
    "_" +
    [
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds()),
    ].join("-");

  return `rule-compiler-output-${stamp}.json`;
}


function getRuleKindLabel(ruleKind) {
  const labels = {
    hard_constraint: "אילוץ על התוצאה",
    soft_preference: "העדפה על התוצאה",
    comparison_objective: "יעד השוואתי / אופטימיזציה",
    search_strategy: "אסטרטגיית חיפוש",
    semantic_guidance: "הנחיה סמנטית",
  };
  return labels[ruleKind] || "טרם סווג";
}

function isFlexibleSemanticRule(rule) {
  return (
    rule?.status === "semantic_only" &&
    [
      "comparison_objective",
      "search_strategy",
      "semantic_guidance",
      "soft_preference",
    ].includes(rule?.ruleKind)
  );
}

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
  onStartGenerationWorkspace,
  onClearWorkspace,

  onTryWorkspaceMove,
  onTryWorkspaceMovePure,
  onApplyGenerationCandidate,
  onRecordGenerationAttemptFailure,
}) {
  const [input, setInput] = useState("");
  const [newRuleText, setNewRuleText] = useState("");
  const [newRuleSeverity, setNewRuleSeverity] = useState("auto");
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [isSandboxTesting, setIsSandboxTesting] = useState(false);
  const [sandboxTestResult, setSandboxTestResult] = useState(null);
  const [isBridgeTesting, setIsBridgeTesting] = useState(false);
  const [bridgeTestResult, setBridgeTestResult] = useState(null);
  const [isFailureTesting, setIsFailureTesting] = useState(false);
  const [failureTestResult, setFailureTestResult] = useState(null);
  const [isAutoRepairTesting, setIsAutoRepairTesting] = useState(false);
  const [autoRepairTestResult, setAutoRepairTestResult] = useState(null);
  const [isRuleCompiling, setIsRuleCompiling] = useState(false);
  const [isGenerationRunning, setIsGenerationRunning] = useState(false);
  const [generationRunResult, setGenerationRunResult] = useState(null);
  const [ruleCompilerResult, setRuleCompilerResult] = useState(null);
  const [ruleCompilerPhase, setRuleCompilerPhase] = useState("");
  const [agentTelemetry, setAgentTelemetry] = useState({
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    totalDurationMs: 0,
    lastModel: null,
    lastContextChars: 0,
    lastContextProfile: null,
  });

  function recordTelemetry(telemetry) {
    if (!telemetry) return;

    setAgentTelemetry((prev) => ({
      calls: prev.calls + 1,
      inputTokens:
        prev.inputTokens +
        (Number(telemetry.inputTokens) || 0),
      outputTokens:
        prev.outputTokens +
        (Number(telemetry.outputTokens) || 0),
      totalTokens:
        prev.totalTokens +
        (Number(telemetry.totalTokens) || 0),
      totalDurationMs:
        prev.totalDurationMs +
        (Number(telemetry.durationMs) || 0),
      lastModel:
        telemetry.model || prev.lastModel,
      lastContextChars:
        Number(telemetry.contextChars) || 0,
      lastContextProfile:
        telemetry.contextProfile || null,
    }));
  }

  function buildDeterministicRuleCheckResults(scheduleOverride = null) {
    const scheduleToCheck =
      scheduleOverride ||
      workspace?.workingSchedule ||
      agentContext?.baseSchedule ||
      {};

    const evaluations = evaluateFormalRules({
      rules: rules || [],
      schedule: scheduleToCheck,
      schoolData: agentContext?.schoolData || {},
      baselineSchedule: agentContext?.baseSchedule || null,
    });

    return {
      evaluations,
      ruleCheckResults:
        formalRuleEvaluationsToRuleCheckResults(
          evaluations,
        ),
    };
  }

  function mergeRuleCheckResults(
    agentResults = [],
    deterministicResults = [],
  ) {
    const merged = new Map();

    for (const result of agentResults || []) {
      if (result?.ruleId) {
        merged.set(result.ruleId, result);
      }
    }

    // Deterministic checks take precedence over an LLM judgment for the
    // same rule, because they were evaluated directly against the schedule.
    for (const result of deterministicResults || []) {
      if (result?.ruleId) {
        merged.set(result.ruleId, result);
      }
    }

    return [...merged.values()];
  }

  async function runPythonSandboxTest() {
    if (isSandboxTesting) return;

    const schoolData = agentContext?.schoolData;
    if (!schoolData) {
      setSandboxTestResult({
        success: false,
        error: "אין schoolData זמין לבדיקת ה-Sandbox.",
      });
      return;
    }

    setIsSandboxTesting(true);
    setSandboxTestResult(null);

    try {
      const response = await fetch(
        "/.netlify/functions/python-sandbox-test",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schoolData }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "בדיקת Python Sandbox נכשלה");
      }

      setSandboxTestResult(data);
      recordTelemetry(data.telemetry);
    } catch (error) {
      console.error("Python sandbox test failed:", error);
      setSandboxTestResult({
        success: false,
        error: error?.message || "שגיאה לא ידועה בבדיקת ה-Sandbox",
      });
    } finally {
      setIsSandboxTesting(false);
    }
  }

  async function runCandidateValidatorBridgeTest() {
    if (isBridgeTesting) return;

    const schoolData = agentContext?.schoolData;
    const baseSchedule = agentContext?.baseSchedule;

    if (!schoolData || !baseSchedule) {
      setBridgeTestResult({
        success: false,
        error: "אין schoolData/baseSchedule זמין לבדיקת הגשר.",
      });
      return;
    }

    setIsBridgeTesting(true);
    setBridgeTestResult(null);

    try {
      const response = await fetch(
        "/.netlify/functions/candidate-validator-bridge",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolData,
            baseSchedule,
            approvedExceptions: approvedExceptions || [],
            rules: rules || [],
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data?.error || "בדיקת Candidate → Validator נכשלה",
        );
      }

      setBridgeTestResult(data);
      recordTelemetry(data.telemetry);
    } catch (error) {
      console.error("Candidate -> Validator bridge test failed:", error);
      setBridgeTestResult({
        success: false,
        error:
          error?.message ||
          "שגיאה לא ידועה בבדיקת Candidate → Validator",
      });
    } finally {
      setIsBridgeTesting(false);
    }
  }

  async function runCandidateValidatorFailureTest() {
    if (isFailureTesting) return;

    const schoolData = agentContext?.schoolData;
    const baseSchedule = agentContext?.baseSchedule;

    if (!schoolData || !baseSchedule) {
      setFailureTestResult({
        success: false,
        error: "אין schoolData/baseSchedule זמין לבדיקת הכשל המכוון.",
      });
      return;
    }

    setIsFailureTesting(true);
    setFailureTestResult(null);

    try {
      const response = await fetch(
        "/.netlify/functions/candidate-validator-failure-test",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolData,
            baseSchedule,
            approvedExceptions: approvedExceptions || [],
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data?.error || "בדיקת הכשל המכוון נכשלה",
        );
      }

      setFailureTestResult(data);
      recordTelemetry(data.telemetry);
    } catch (error) {
      console.error("Candidate failure-injection test failed:", error);
      setFailureTestResult({
        success: false,
        error:
          error?.message ||
          "שגיאה לא ידועה בבדיקת הכשל המכוון",
      });
    } finally {
      setIsFailureTesting(false);
    }
  }

  async function parseJsonResponse(response, label) {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        `${label}: השרת החזיר תגובה שאינה JSON (${response.status}). ${text.slice(0, 240)}`,
      );
    }
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function pollBackgroundResponse({ responseId, phaseLabel }) {
    const startedAt = Date.now();
    const maxWaitMs = 8 * 60 * 1000;
    let consecutiveErrors = 0;

    while (Date.now() - startedAt < maxWaitMs) {
      try {
        const response = await fetch(
          "/.netlify/functions/auto-repair-async-poll",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ responseId }),
          },
        );
        const data = await parseJsonResponse(response, `${phaseLabel} polling`);
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || `${phaseLabel}: polling נכשל`);
        }

        consecutiveErrors = 0;
        setAutoRepairTestResult((previous) => ({
          ...(previous || {}),
          running: true,
          backgroundStatus: data.status || "unknown",
        }));

        if (data.terminal) {
          if (data.status !== "completed") {
            throw new Error(
              `${phaseLabel}: OpenAI background response הסתיים במצב ${data.status}. ${JSON.stringify(data.error || {})}`,
            );
          }
          return data;
        }
      } catch (error) {
        consecutiveErrors += 1;
        if (consecutiveErrors >= 3) throw error;
      }

      await wait(2000);
    }

    throw new Error(`${phaseLabel}: ההרצה האסינכרונית לא הסתיימה בתוך 8 דקות.`);
  }

  async function cleanupTemporaryAgentFiles(fileIds) {
    if (!Array.isArray(fileIds) || fileIds.length === 0) return;
    try {
      await fetch("/.netlify/functions/auto-repair-async-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds }),
      });
    } catch (error) {
      console.warn("Temporary agent file cleanup failed:", error);
    }
  }

  async function runAutoRepairLoopTest() {
    if (isAutoRepairTesting) return;

    const schoolData = agentContext?.schoolData;
    const baseSchedule = agentContext?.baseSchedule;
    if (!schoolData || !baseSchedule) {
      setAutoRepairTestResult({
        success: false,
        error: "אין schoolData/baseSchedule זמין לבדיקת Auto-Repair.",
      });
      return;
    }

    setIsAutoRepairTesting(true);
    setAutoRepairTestResult({
      success: false,
      running: true,
      currentPhase: "attempt-0-start",
      backgroundStatus: "starting",
      attempts: [],
    });

    let attempt0InputFileIds = [];
    let attempt1InputFileIds = [];

    try {
      // ATTEMPT 0 — START (fast request)
      const start0Response = await fetch(
        "/.netlify/functions/auto-repair-async-start-0",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schoolData, baseSchedule }),
        },
      );
      const start0 = await parseJsonResponse(start0Response, "Attempt 0 start");
      if (!start0Response.ok || !start0?.success) {
        throw new Error(start0?.error || "Attempt 0 לא הצליח להתחיל");
      }
      attempt0InputFileIds = start0.inputFileIds || [];

      setAutoRepairTestResult((previous) => ({
        ...(previous || {}),
        currentPhase: "attempt-0-running",
        backgroundStatus: start0.status || "queued",
        attempt0ResponseId: start0.responseId,
      }));

      await pollBackgroundResponse({
        responseId: start0.responseId,
        phaseLabel: "Attempt 0",
      });

      // ATTEMPT 0 — COLLECT + VALIDATE (fast request)
      setAutoRepairTestResult((previous) => ({
        ...(previous || {}),
        currentPhase: "attempt-0-collect",
        backgroundStatus: "completed",
      }));
      const collect0Response = await fetch(
        "/.netlify/functions/auto-repair-async-collect-0",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            responseId: start0.responseId,
            inputFileIds: attempt0InputFileIds,
            schoolData,
            baseSchedule,
            approvedExceptions: approvedExceptions || [],
          }),
        },
      );
      const data0 = await parseJsonResponse(collect0Response, "Attempt 0 collect");
      attempt0InputFileIds = [];
      recordTelemetry(data0.telemetry);

      const attempt0View = {
        number: 0,
        purpose: "inject-multistep-displacement-defect",
        validation: data0.validation,
        codeRuns: data0.codeRuns || [],
        injectedFailure: data0.injectedFailure || null,
        diagnostics: data0.diagnostics || null,
      };

      if (!collect0Response.ok || !data0?.success) {
        setAutoRepairTestResult({
          success: false,
          running: false,
          currentPhase: "attempt-0-collect",
          backgroundStatus: "completed",
          error: data0?.error || "Attempt 0 לא הצליח ליצור פגם מבוקר",
          attempts: [attempt0View],
          checks: { attempt0: data0.checks || null },
        });
        return;
      }

      setAutoRepairTestResult({
        success: false,
        running: true,
        currentPhase: "attempt-1-start",
        backgroundStatus: "starting",
        attempts: [attempt0View],
        checks: { attempt0: data0.checks },
      });

      // ATTEMPT 1 — START (fast request). It does not receive the pristine schedule.
      const start1Response = await fetch(
        "/.netlify/functions/auto-repair-async-start-1",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolData,
            brokenSchedule: data0.brokenSchedule,
            approvedExceptions: approvedExceptions || [],
          }),
        },
      );
      const start1 = await parseJsonResponse(start1Response, "Attempt 1 start");
      if (!start1Response.ok || !start1?.success) {
        throw new Error(start1?.error || "Attempt 1 לא הצליח להתחיל");
      }
      attempt1InputFileIds = start1.inputFileIds || [];

      setAutoRepairTestResult((previous) => ({
        ...(previous || {}),
        currentPhase: "attempt-1-running",
        backgroundStatus: start1.status || "queued",
        attempt1ResponseId: start1.responseId,
      }));

      await pollBackgroundResponse({
        responseId: start1.responseId,
        phaseLabel: "Attempt 1",
      });

      // ATTEMPT 1 — COLLECT + FINAL VALIDATION
      setAutoRepairTestResult((previous) => ({
        ...(previous || {}),
        currentPhase: "attempt-1-collect",
        backgroundStatus: "completed",
      }));
      const collect1Response = await fetch(
        "/.netlify/functions/auto-repair-async-collect-1",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            responseId: start1.responseId,
            inputFileIds: attempt1InputFileIds,
            schoolData,
            brokenSchedule: data0.brokenSchedule,
            approvedExceptions: approvedExceptions || [],
          }),
        },
      );
      const data1 = await parseJsonResponse(collect1Response, "Attempt 1 collect");
      attempt1InputFileIds = [];
      if (!collect1Response.ok) {
        throw new Error(data1?.error || "Attempt 1 collect נכשל");
      }
      recordTelemetry(data1.telemetry);

      const attempt1View = {
        number: 1,
        purpose: "autonomous-repair-from-validator-feedback",
        validation: data1.validation,
        codeRuns: data1.codeRuns || [],
        reply: data1.reply || "",
        diagnostics: data1.diagnostics || null,
      };

      setAutoRepairTestResult({
        success: Boolean(data1.success),
        error: data1.success ? null : (data1.error || "Attempt 1 לא עבר את בדיקת התיקון"),
        running: false,
        currentPhase: "done",
        backgroundStatus: "completed",
        attempts: [attempt0View, attempt1View],
        checks: {
          attempt0: data0.checks,
          attempt1: data1.checks,
        },
        telemetry: {
          calls: 2,
          inputTokens:
            (Number(data0.telemetry?.inputTokens) || 0) +
            (Number(data1.telemetry?.inputTokens) || 0),
          outputTokens:
            (Number(data0.telemetry?.outputTokens) || 0) +
            (Number(data1.telemetry?.outputTokens) || 0),
          totalTokens:
            (Number(data0.telemetry?.totalTokens) || 0) +
            (Number(data1.telemetry?.totalTokens) || 0),
          durationMs:
            (Number(data0.telemetry?.durationMs) || 0) +
            (Number(data1.telemetry?.durationMs) || 0),
        },
      });
    } catch (error) {
      console.error("Async auto-repair loop test failed:", error);
      setAutoRepairTestResult((previous) => ({
        ...(previous || {}),
        success: false,
        running: false,
        error:
          error?.message ||
          "שגיאה לא ידועה בבדיקת Auto-Repair האסינכרונית",
      }));
    } finally {
      // If an attempt failed before its collect endpoint, uploaded OpenAI files
      // are cleaned up here. They also have a one-hour server-side expiry.
      await cleanupTemporaryAgentFiles(attempt0InputFileIds);
      await cleanupTemporaryAgentFiles(attempt1InputFileIds);
      setIsAutoRepairTesting(false);
    }
  }

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

    const byUnitId = new Map(
      units.map((unit) => [unit.id, unit])
    );

    // Compact wire format. Teacher names are already present in entitySummary,
    // so the schedule snapshot sends only placements. This removes thousands
    // of repeated JSON field names from every LLM call.
    // placement tuple = [day, hour, className, unitId]
    const byTeacher = {};

    for (const [day, daySchedule] of Object.entries(schedule)) {
      for (const [className, classSchedule] of Object.entries(daySchedule || {})) {
        for (const [hourKey, cellValue] of Object.entries(classSchedule || {})) {
          const hour = Number(hourKey);
          const unitIds = Array.isArray(cellValue)
            ? cellValue
            : cellValue
              ? [cellValue]
              : [];

          for (const unitId of unitIds) {
            const unit = byUnitId.get(unitId);
            if (!unit?.teacherId) continue;

            const teacherId = String(unit.teacherId);
            if (!byTeacher[teacherId]) {
              byTeacher[teacherId] = [];
            }

            byTeacher[teacherId].push([
              day,
              hour,
              className,
              unitId,
            ]);
          }
        }
      }
    }

    for (const placements of Object.values(byTeacher)) {
      placements.sort((a, b) => {
        const dayOrder =
          (agentContext?.schoolData?.days || []).indexOf(a[0]) -
          (agentContext?.schoolData?.days || []).indexOf(b[0]);
        return dayOrder || a[1] - b[1] || String(a[2]).localeCompare(String(b[2]));
      });
    }

    return {
      format: "teacher-placements-v2",
      fields: ["day", "hour", "className", "unitId"],
      byTeacher,
    };
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

    const deterministicRules =
      buildDeterministicRuleCheckResults(
        workspaceSchedule,
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

          formalRuleEvaluations:
            deterministicRules.evaluations,
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

    recordTelemetry(data.telemetry);

    return {
      ...data,
      ruleCheckResults: mergeRuleCheckResults(
        data.ruleCheckResults || [],
        deterministicRules.ruleCheckResults,
      ),
    };
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

    const deterministicRules =
      buildDeterministicRuleCheckResults();

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

            formalRuleEvaluations:
              deterministicRules.evaluations,
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

      recordTelemetry(data.telemetry);

      let proposedAction =
        data.proposedAction;

      const ruleCheckResults =
        mergeRuleCheckResults(
          Array.isArray(data.ruleCheckResults)
            ? data.ruleCheckResults
            : [],
          deterministicRules.ruleCheckResults,
        );

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

  function applyDeterministicCategoryGuard(rule, compiledCategory) {
    // Manual severity is a user-owned decision and must always win over
    // compiler inference. Keep categorySource support for older projects.
    if (rule?.severityMode === "manual" || rule?.categorySource === "user") {
      return rule.category || "unspecified";
    }

    const text = String(rule?.originalText || "").trim();

    const recommendedPattern =
      /(מומלץ|רצוי|עדיף|כדאי|יש לנסות|עדיפות|ככל שניתן|ככל האפשר|להשתדל)/;

    const criticalPattern =
      /(אסור|אין לשבץ|חייב|חובה|צריכים|צריך|יש לשבץ|יש לקבוע|לא יכול|לא ניתן)/;

    if (recommendedPattern.test(text)) {
      return "recommended";
    }

    if (criticalPattern.test(text)) {
      return "critical";
    }

    return compiledCategory || rule?.category || "unspecified";
  }

  async function runRuleCompiler() {
    if (isRuleCompiling || !rules?.length) return;

    const schoolData = agentContext?.schoolData;
    if (!schoolData) {
      setRuleCompilerResult({
        success: false,
        error: "אין schoolData זמין ל-Rule Compiler.",
      });
      return;
    }

    setIsRuleCompiling(true);
    setRuleCompilerResult(null);

    try {
      setRuleCompilerPhase("מתחיל קומפילציה...");

      const startResponse = await fetch(
        "/.netlify/functions/rule-compiler-async-start",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rules: rules || [],
            schoolData,
          }),
        },
      );

      const startData = await parseJsonResponse(
        startResponse,
        "Rule Compiler v6.6.3 start",
      );

      if (!startResponse.ok || !startData?.success) {
        throw new Error(
          startData?.error ||
            "Rule Compiler v6.6.3 לא הצליח להתחיל",
        );
      }

      const responseId = startData.responseId;
      const startedAt = Date.now();

      if (!responseId) {
        throw new Error(
          "Rule Compiler v6.6.3 לא החזיר responseId",
        );
      }

      let data = null;
      const maxPolls = 60;
      const pollDelayMs = 3000;

      for (
        let pollIndex = 0;
        pollIndex < maxPolls;
        pollIndex += 1
      ) {
        setRuleCompilerPhase(
          `ממתין לתוצאת Rule Compiler... ${pollIndex + 1}`,
        );

        await new Promise((resolve) =>
          setTimeout(resolve, pollDelayMs)
        );

        const collectResponse = await fetch(
          "/.netlify/functions/rule-compiler-async-collect",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              responseId,
              startedAt,
            }),
          },
        );

        const collectData =
          await parseJsonResponse(
            collectResponse,
            "Rule Compiler v6.6.3 collect",
          );

        if (
          !collectResponse.ok ||
          collectData?.success === false
        ) {
          throw new Error(
            collectData?.error ||
              "Rule Compiler v6.6.3 נכשל בזמן איסוף התוצאה",
          );
        }

        if (collectData?.completed) {
          data = collectData;
          break;
        }
      }

      if (!data?.completed) {
        throw new Error(
          "Rule Compiler v6.6.3 לא הסתיים בתוך 3 דקות",
        );
      }

      const numberedRules = (rules || []).map(
        (rule, index) => ({
          ...rule,
          ruleNumber: rule.ruleNumber || index + 1,
        }),
      );

      const compiledById = new Map(
        (data.compiledRules || []).map((item) => [
          item.ruleId,
          item,
        ]),
      );

      const nextRules = numberedRules.map((rule) => {
        const compiled = compiledById.get(rule.id);
        if (!compiled) return rule;

        let formalRule = null;
        let effectiveFormalizationStatus =
          compiled.formalizationStatus;
        let compilerFallbackUsed = false;
        let semanticContractRepairs = [];
        let semanticContractErrors = [];

        const guardedSeverity =
          applyDeterministicCategoryGuard(
            rule,
            compiled.category,
          );

        if (
          (
            compiled.formalizationStatus === "formalized" ||
            compiled.formalizationStatus === "partially_formalized"
          ) &&
          compiled.formalRuleJson
        ) {
          try {
            const parsedFormalRule = JSON.parse(
              compiled.formalRuleJson,
            );
            parsedFormalRule.severity = guardedSeverity;

            const repaired =
              repairFormalRuleSemanticContract({
                originalText: rule.originalText || "",
                compiled,
                formalRule: parsedFormalRule,
              });

            formalRule = repaired.formalRule;
            semanticContractRepairs = [
              ...semanticContractRepairs,
              ...(repaired.repairs || []),
            ];

            const contract =
              validateSemanticContract({
                originalText: rule.originalText || "",
                compiled,
                formalRule,
              });

            if (!contract.ok) {
              semanticContractErrors = contract.errors || [];
              formalRule = null;
              effectiveFormalizationStatus = "semantic_only";
            }
          } catch (error) {
            console.error(
              "Rule Compiler returned invalid formalRuleJson:",
              error,
            );
          }
        }

        // Deterministic capability-contradiction repair:
        // if the compiler itself explains that `exists` is the correct
        // representation for a missing day, build it from resolved entities
        // rather than accepting semantic_only.
        if (!formalRule) {
          const existsRepair =
            buildExistsRepairFromSemanticOnly({
              originalText: rule.originalText || "",
              compiled,
              severity: guardedSeverity,
            });
          if (existsRepair) {
            formalRule = existsRepair;
            effectiveFormalizationStatus = "formalized";
            semanticContractRepairs.push(
              "semantic_only_to_exists",
            );
          }
        }

        // Preserve a previously validated deterministic subset when the new
        // compiler run asks for clarification only about the remaining
        // semantic portion. This prevents a measurable partial rule from
        // disappearing merely because another clause is ambiguous.
        if (!formalRule) {
          const partialRepair = preserveSafePartialFormalRule({
            originalText: rule.originalText || "",
            compiled,
            previousRule: rule,
            severity: guardedSeverity,
          });
          if (partialRepair) {
            formalRule = partialRepair.formalRule;
            effectiveFormalizationStatus = "partially_formalized";
            semanticContractRepairs = [
              ...semanticContractRepairs,
              ...(partialRepair.repairs || []),
            ];
          }
        }

        // Last-known-good safety net:
        // malformed JSON may reuse the previous Formal Rule only after it is
        // repaired/validated against the CURRENT grounding and semantics.
        // This prevents stale LKG expressions from contradicting newly
        // resolved constraint groups or exclusivity.
        const invalidJsonGuardTriggered =
          compiled.formalizationStatus === "semantic_only" &&
          String(compiled.explanation || "").includes(
            "formalRuleJson remained invalid after conservative repair",
          );

        if (
          !formalRule &&
          invalidJsonGuardTriggered &&
          rule.formalRule &&
          (
            rule.status === "formalized" ||
            rule.status === "partially_formalized"
          )
        ) {
          const lkg = JSON.parse(
            JSON.stringify(rule.formalRule),
          );
          lkg.severity = guardedSeverity;

          const repairedLkg =
            repairFormalRuleSemanticContract({
              originalText: rule.originalText || "",
              compiled,
              formalRule: lkg,
            });

          const lkgContract =
            validateSemanticContract({
              originalText: rule.originalText || "",
              compiled,
              formalRule: repairedLkg.formalRule,
            });

          if (lkgContract.ok) {
            formalRule = repairedLkg.formalRule;
            semanticContractRepairs = [
              ...semanticContractRepairs,
              ...(repairedLkg.repairs || []),
            ];
            effectiveFormalizationStatus = rule.status;
            compilerFallbackUsed = true;
          } else {
            semanticContractErrors = [
              ...semanticContractErrors,
              ...(lkgContract.errors || []),
            ];
          }
        }

        return {
          ...rule,
          category:
            applyDeterministicCategoryGuard(
              rule,
              compiled.category,
            ),
          severityMode:
            rule.severityMode === "manual" || rule.categorySource === "user"
              ? "manual"
              : "auto",
          categorySource:
            rule.severityMode === "manual" || rule.categorySource === "user"
              ? "user"
              : "compiler",
          status: effectiveFormalizationStatus,
          ruleKind:
            compilerFallbackUsed
              ? (rule.ruleKind || "hard_constraint")
              : compiled.ruleKind ||
            (
              effectiveFormalizationStatus === "formalized" ||
              effectiveFormalizationStatus === "partially_formalized"
                ? (applyDeterministicCategoryGuard(rule, compiled.category) === "recommended"
                    ? "soft_preference"
                    : "hard_constraint")
                : "semantic_guidance"
            ),
          interpretation: compiled.interpretation,
          semanticGuidance:
            compiled.semanticGuidance ||
            compiled.interpretation ||
            rule.originalText ||
            "",
          formalCoverage:
            compilerFallbackUsed
              ? (
                  rule.formalCoverage || {
                    covered: "Last-known-good Formal Rule נשמר לאחר כשל פורמט זמני של הקומפיילר.",
                    semanticOnly: "",
                  }
                )
              : compiled.formalCoverage || {
              covered:
                compiled.formalizationStatus === "formalized"
                  ? "מלוא החוק"
                  : "",
              semanticOnly:
                compiled.formalizationStatus === "formalized"
                  ? ""
                  : (
                      compiled.semanticGuidance ||
                      compiled.interpretation ||
                      rule.originalText ||
                      ""
                    ),
            },
          formalRule,
          evaluatorKey:
            formalRule
              ? "generic"
              : (compiled.evaluatorKey || "unsupported"),
          resolvedEntities:
            compiled.resolvedEntities || [],
          clarificationQuestion:
            compiled.clarificationQuestion || null,
          capabilityPlan:
            compiled.capabilityPlan || {
              requirements: [],
              selectedCapabilities: [],
              composition: "",
              unsupportedRequirements: [],
            },
          compilerExplanation: [
            compiled.explanation || "",
            compilerFallbackUsed
              ? "[UI fallback: preserved semantically validated last-known-good Formal Rule.]"
              : "",
            semanticContractRepairs.length
              ? `[Semantic Contract repair: ${semanticContractRepairs.join(", ")}.]`
              : "",
            semanticContractErrors.length
              ? `[Semantic Contract rejected: ${semanticContractErrors
                  .map((item) => item.code)
                  .join(", ")}.]`
              : "",
          ].filter(Boolean).join(" "),
          compilerFallbackUsed,
          semanticContractRepairs,
          semanticContractErrors,
          compiledAt: new Date().toISOString(),
          compilerVersion: "rule-compiler-v6.6.3-grounding-partial-population-guards",
        };
      });

      const evaluations = evaluateFormalRules({
        rules: nextRules,
        schedule:
          workspace?.workingSchedule ||
          agentContext?.baseSchedule ||
          {},
        schoolData: agentContext?.schoolData || {},
        baselineSchedule: agentContext?.baseSchedule || null,
      });

      const deterministicResults =
        formalRuleEvaluationsToRuleCheckResults(
          evaluations,
        );

      const evaluatedRules = nextRules.map((rule) => {
        const result = deterministicResults.find(
          (item) => item.ruleId === rule.id,
        );

        if (!result) {
          // A fresh compilation is authoritative. Never keep stale
          // evaluator/check fields from an older formalization.
          const clearedRule = {
            ...rule,
            evaluatorSupported: false,
            checkStatus: null,
            checkSummary: "",
            checkViolations: [],
            checkedAt: new Date().toISOString(),
          };

          if (isFlexibleSemanticRule(rule)) {
            return {
              ...clearedRule,
              checkStatus: "guidance",
              checkSummary:
                rule.ruleKind === "comparison_objective"
                  ? "נשמר כיעד אופטימיזציה להשוואת פתרונות מול מערכת הבסיס."
                  : rule.ruleKind === "search_strategy"
                    ? "נשמר כהנחיית אסטרטגיית חיפוש לסוכן."
                    : "נשמר כהנחיה סמנטית לסוכן; אין בדיקה דטרמיניסטית מלאה.",
            };
          }

          if (rule.status === "needs_clarification") {
            return {
              ...clearedRule,
              checkStatus: "clarification",
              checkSummary:
                "לא בוצעה בדיקה דטרמיניסטית משום שהחוק דורש הבהרה.",
            };
          }

          if (rule.status === "semantic_only") {
            return {
              ...clearedRule,
              checkStatus: "guidance",
              checkSummary:
                "החוק מובן אך אינו נבדק כרגע דטרמיניסטית; ההנחיה הסמנטית נשמרה.",
            };
          }

          return clearedRule;
        }

        const isPartial =
          rule.status === "partially_formalized";

        return {
          ...rule,
          evaluatorSupported:
            result.status !== "unknown",
          checkStatus:
            isPartial && result.status === "satisfied"
              ? "partial_satisfied"
              : isPartial && result.status === "violated"
                ? "partial_violated"
                : result.status,
          checkSummary:
            isPartial
              ? (
                  result.status === "satisfied"
                    ? "החלק הפורמלי של החוק מתקיים. נותר חלק סמנטי שאינו נבדק דטרמיניסטית."
                    : "נמצאה הפרה בחלק הפורמלי של החוק; בנוסף קיים חלק סמנטי שאינו נבדק דטרמיניסטית."
                )
              : result.summary,
          checkViolations: result.violations || [],
          checkedAt: new Date().toISOString(),
        };
      });

      onRulesChange(() => evaluatedRules);

      const compilerResultForUi = {
        ...data,
        evaluations,
        deterministicResults,
      };

      setRuleCompilerResult(compilerResultForUi);

      // Create a compact, portable diagnostic artifact after every
      // successful compilation. It contains the complete rule state and
      // compiler/evaluator output, but intentionally excludes schoolData
      // and the timetable itself so it is easy to share for debugging.
      const exportPayload = {
        exportVersion: 18,
        exportedAt: new Date().toISOString(),
        compilerVersion: "rule-compiler-v6.6.3-grounding-partial-population-guards",
        summary: {
          totalRules: evaluatedRules.length,
          formalized: evaluatedRules.filter(
            (rule) => rule.status === "formalized",
          ).length,
          partiallyFormalized: evaluatedRules.filter(
            (rule) => rule.status === "partially_formalized",
          ).length,
          evaluatorSupported: evaluatedRules.filter(
            (rule) => rule.evaluatorSupported === true,
          ).length,
          satisfied: evaluatedRules.filter(
            (rule) => rule.checkStatus === "satisfied",
          ).length,
          violated: evaluatedRules.filter(
            (rule) => rule.checkStatus === "violated",
          ).length,
          unknown: evaluatedRules.filter(
            (rule) =>
              !rule.checkStatus ||
              rule.checkStatus === "unknown",
          ).length,
          flexibleGuidance: evaluatedRules.filter(
            (rule) => isFlexibleSemanticRule(rule),
          ).length,
          comparisonObjectives: evaluatedRules.filter(
            (rule) => rule.ruleKind === "comparison_objective",
          ).length,
          searchStrategies: evaluatedRules.filter(
            (rule) => rule.ruleKind === "search_strategy",
          ).length,
          softPreferences: evaluatedRules.filter(
            (rule) => rule.ruleKind === "soft_preference",
          ).length,
        },
        rules: evaluatedRules,
        compiler: {
          success: data.success,
          completed: data.completed,
          compiledRules: data.compiledRules || [],
          telemetry: data.telemetry || null,
          // Preserve the complete server response as well, so the exported
          // file can replace copy/pasting the on-screen compiler output.
          rawResponse: data,
        },
        deterministicEvaluation: {
          evaluations,
          results: deterministicResults,
        },
      };

      try {
        downloadJsonFile(
          exportPayload,
          buildRuleCompilerExportFilename(),
        );
      } catch (downloadError) {
        // Compilation must still count as successful even if the browser
        // blocks an automatic download. Keep the result available in UI.
        console.error(
          "Failed to download Rule Compiler JSON export:",
          downloadError,
        );
      }

      recordTelemetry(data.telemetry);
    } catch (error) {
      console.error("Rule Compiler v6.6.3 failed:", error);
      setRuleCompilerResult({
        success: false,
        error:
          error?.message ||
          "שגיאה לא ידועה ב-Rule Compiler v6.6.3",
      });
    } finally {
      setIsRuleCompiling(false);
      setRuleCompilerPhase("");
    }
  }

  function handleAddRule() {
    const text = newRuleText.trim();

    if (!text) {
      return;
    }

    const nextRuleNumber =
      (rules || []).reduce(
        (max, rule, index) =>
          Math.max(
            max,
            Number(rule.ruleNumber) || index + 1,
          ),
        0,
      ) + 1;

    const isAutomaticSeverity = newRuleSeverity === "auto";

    const newRule = {
      id: `rule-${Date.now()}`,
      ruleNumber: nextRuleNumber,
      originalText: text,
      status: "unparsed",
      category: isAutomaticSeverity ? "unspecified" : newRuleSeverity,
      severityMode: isAutomaticSeverity ? "auto" : "manual",
      categorySource: isAutomaticSeverity ? "compiler" : "user",
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

  function handleRuleCategoryChange(ruleId, category) {
    const isAutomaticSeverity = category === "auto";

    onRulesChange((prev) =>
      prev.map((rule) => {
        if (rule.id !== ruleId) return rule;

        const nextCategory = isAutomaticSeverity
          ? rule.category || "unspecified"
          : category;

        return {
          ...rule,
          category: nextCategory,
          severityMode: isAutomaticSeverity ? "auto" : "manual",
          categorySource: isAutomaticSeverity ? "compiler" : "user",
          // Changing severity does not change the semantic IR. A manual
          // value immediately overrides formalRule.severity. Returning to
          // automatic keeps the last visible category until the next compiler run.
          formalRule: rule.formalRule
            ? {
                ...rule.formalRule,
                severity: nextCategory,
              }
            : rule.formalRule,
        };
      })
    );
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


  const generationValidation = useMemo(() => {
    if (workspace?.mode !== "generation" || !workspace?.workingSchedule) return null;
    return validateSchedule({
      schedule: workspace.workingSchedule,
      schoolData: agentContext?.schoolData || {},
      approvedExceptions: approvedExceptions || [],
    });
  }, [workspace, agentContext?.schoolData, approvedExceptions]);

  const generationStats = generationValidation?.statistics || null;

  async function runGenerationAttempt() {
    if (isGenerationRunning || workspace?.mode !== "generation") return;
    setIsGenerationRunning(true);
    setGenerationRunResult({ running: true, phase: "starting" });
    try {
      const startResponse = await fetch("/.netlify/functions/generation-async-start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolData: agentContext?.schoolData || {},
          schedule: workspace.workingSchedule,
          baselineSchedule: workspace.baselineSchedule || agentContext?.baseSchedule || null,
          rules: rules || [], approvedExceptions: approvedExceptions || [],
        }),
      });
      const start = await startResponse.json();
      if (!startResponse.ok || !start?.success) throw new Error(start?.error || "Generation start failed");
      setGenerationRunResult({ running: true, phase: start.status || "queued", responseId: start.responseId });

      let terminal = false;
      let poll = null;
      for (let i = 0; i < 180; i += 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const pollResponse = await fetch("/.netlify/functions/generation-async-poll", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ responseId: start.responseId }),
        });
        poll = await pollResponse.json();
        if (!pollResponse.ok || !poll?.success) throw new Error(poll?.error || "Generation polling failed");
        setGenerationRunResult(prev => ({ ...(prev || {}), running: true, phase: poll.status }));
        if (poll.terminal) { terminal = true; break; }
      }
      if (!terminal) throw new Error("Generation attempt did not finish within the UI polling window");
      if (poll.status !== "completed") throw new Error(poll?.error?.message || `Generation ended with status ${poll.status}`);

      const collectResponse = await fetch("/.netlify/functions/generation-async-collect", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseId: start.responseId, uploadedFileIds: start.uploadedFileIds || [], schoolData: agentContext?.schoolData || {}, baselineSchedule: workspace.baselineSchedule || agentContext?.baseSchedule || null, rules: rules || [], approvedExceptions: approvedExceptions || [] }),
      });
      const result = await collectResponse.json();
      if (!collectResponse.ok || !result?.success) {
        recordTelemetry(result?.telemetry);
        onRecordGenerationAttemptFailure?.(result);
        setGenerationRunResult({ ...result, running: false, phase: "failed" });
        return;
      }
      recordTelemetry(result.telemetry);
      onApplyGenerationCandidate?.(result);
      setGenerationRunResult({ ...result, running: false, phase: "completed" });
    } catch (error) {
      const failure = { running: false, phase: "failed", error: error?.message || String(error) };
      onRecordGenerationAttemptFailure?.(failure);
      setGenerationRunResult(failure);
    } finally { setIsGenerationRunning(false); }
  }

  function exportGenerationTrace() {
    if (!workspace || workspace.mode !== "generation") return;
    downloadJsonFile({
      exportVersion: 2,
      type: "generation-workspace-trace",
      exportedAt: new Date().toISOString(),
      statistics: generationStats,
      validation: generationValidation,
      workspace,
      rules: rules || [],
    }, `generation-run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  }

  return (
    <div className="scheduling-agent-view">
      <h2>סוכן שיבוץ AI</h2>

      <div className="scheduling-agent-telemetry">
        <strong>שימוש API בסשן:</strong>{" "}
        {agentTelemetry.calls} קריאות · {" "}
        {agentTelemetry.inputTokens.toLocaleString()} קלט · {" "}
        {agentTelemetry.outputTokens.toLocaleString()} פלט · {" "}
        {agentTelemetry.totalTokens.toLocaleString()} סה״כ tokens
        {agentTelemetry.lastModel
          ? ` · ${agentTelemetry.lastModel}`
          : ""}
        {agentTelemetry.lastContextChars
          ? ` · context ${agentTelemetry.lastContextChars.toLocaleString()} chars`
          : ""}
      </div>

      <div className="scheduling-agent-panel scheduling-agent-sandbox-panel">
        <div className="scheduling-agent-sandbox-header">
          <div>
            <strong>Python Sandbox v1</strong>
            <div className="scheduling-agent-sandbox-subtitle">
              בדיקת תשתית: ה-Agent קורא metadata כקובץ ומריץ Python מבודד.
            </div>
          </div>

          <button
            type="button"
            onClick={runPythonSandboxTest}
            disabled={isSandboxTesting || !agentContext?.schoolData}
          >
            {isSandboxTesting ? "מריץ Python..." : "בדוק Python Sandbox"}
          </button>
        </div>

        {sandboxTestResult && (
          <div
            className={
              sandboxTestResult.success
                ? "scheduling-agent-sandbox-result success"
                : "scheduling-agent-sandbox-result error"
            }
          >
            {sandboxTestResult.success ? (
              <>
                <div>✓ ה-Sandbox הריץ Python וקרא את metadata.json.</div>
                <div>
                  מורים: {sandboxTestResult.result?.teacherCount ?? "?"} · כיתות: {sandboxTestResult.result?.classCount ?? "?"} · יחידות הוראה: {sandboxTestResult.result?.teachingUnitCount ?? "?"}
                </div>
                <div>
                  Python runs: {sandboxTestResult.telemetry?.codeInterpreterCalls ?? 0} · קובץ קלט: {(sandboxTestResult.inputFile?.bytes ?? 0).toLocaleString()} bytes
                </div>
                {Array.isArray(sandboxTestResult.codeRuns) &&
                  sandboxTestResult.codeRuns.length > 0 && (
                    <details>
                      <summary>הצג את קוד ה-Python וה-logs</summary>
                      {sandboxTestResult.codeRuns.map((run, index) => (
                        <div key={run.id || index} className="scheduling-agent-sandbox-code-run">
                          <strong>הרצה {index + 1}</strong>
                          <pre>{run.code || "(לא הוחזר קוד)"}</pre>
                          {run.logs && (
                            <>
                              <strong>logs</strong>
                              <pre>{run.logs}</pre>
                            </>
                          )}
                        </div>
                      ))}
                    </details>
                  )}
              </>
            ) : (
              <>
                <div>✕ {sandboxTestResult.error || sandboxTestResult.diagnostic?.message || "ה-Sandbox לא עבר את בדיקת התשתית."}</div>
                {sandboxTestResult.checks && (
                  <pre style={{ whiteSpace: "pre-wrap", direction: "ltr", textAlign: "left" }}>
                    {JSON.stringify(sandboxTestResult.checks, null, 2)}
                  </pre>
                )}
                {sandboxTestResult.diagnostic && (
                  <pre style={{ whiteSpace: "pre-wrap", direction: "ltr", textAlign: "left" }}>
                    {JSON.stringify(sandboxTestResult.diagnostic, null, 2)}
                  </pre>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="scheduling-agent-panel scheduling-agent-sandbox-panel">
        <div className="scheduling-agent-sandbox-header">
          <div>
            <strong>Candidate → Validator bridge v1</strong>
            <div className="scheduling-agent-sandbox-subtitle">
              Python יוצר candidate-schedule.json, השרת מוריד אותו מה-container ומריץ עליו את ה-Validator האמיתי.
            </div>
          </div>

          <button
            type="button"
            onClick={runCandidateValidatorBridgeTest}
            disabled={
              isBridgeTesting ||
              !agentContext?.schoolData ||
              !agentContext?.baseSchedule
            }
          >
            {isBridgeTesting
              ? "יוצר Candidate ובודק..."
              : "בדוק Candidate → Validator"}
          </button>
        </div>

        {bridgeTestResult && (
          <div
            className={
              bridgeTestResult.success
                ? "scheduling-agent-sandbox-result success"
                : "scheduling-agent-sandbox-result error"
            }
          >
            {bridgeTestResult.success ? (
              <>
                <div>✓ Candidate שנוצר ב-Python הועבר ל-Validator ועבר בדיקה.</div>
                <div>
                  שעות: {bridgeTestResult.validation?.statistics?.totalScheduledHours ?? "?"}/
                  {bridgeTestResult.validation?.statistics?.totalRequiredHours ?? "?"} ·
                  שגיאות: {bridgeTestResult.validation?.statistics?.errorCount ?? "?"} ·
                  אזהרות: {bridgeTestResult.validation?.statistics?.warningCount ?? "?"}
                </div>
                <div>
                  Candidate file: {(bridgeTestResult.generatedFile?.bytes ?? 0).toLocaleString()} bytes ·
                  Python runs: {bridgeTestResult.telemetry?.codeInterpreterCalls ?? 0}
                </div>
                {Array.isArray(bridgeTestResult.codeRuns) &&
                  bridgeTestResult.codeRuns.length > 0 && (
                    <details>
                      <summary>הצג Python ו-logs של יצירת ה-Candidate</summary>
                      {bridgeTestResult.codeRuns.map((run, index) => (
                        <div key={run.id || index} className="scheduling-agent-sandbox-code-run">
                          <strong>הרצה {index + 1}</strong>
                          <pre>{run.code || "(לא הוחזר קוד)"}</pre>
                          {run.logs && <pre>{run.logs}</pre>}
                        </div>
                      ))}
                    </details>
                  )}
              </>
            ) : (
              <>
                <div>✕ {bridgeTestResult.error || "הגשר Candidate → Validator לא עבר את הבדיקה."}</div>
                {bridgeTestResult.checks && (
                  <pre style={{ whiteSpace: "pre-wrap", direction: "ltr", textAlign: "left" }}>
                    {JSON.stringify(bridgeTestResult.checks, null, 2)}
                  </pre>
                )}
                {bridgeTestResult.diagnostic && (
                  <pre style={{ whiteSpace: "pre-wrap", direction: "ltr", textAlign: "left" }}>
                    {JSON.stringify(bridgeTestResult.diagnostic, null, 2)}
                  </pre>
                )}
                {Array.isArray(bridgeTestResult.codeRuns) &&
                  bridgeTestResult.codeRuns.length > 0 && (
                    <details>
                      <summary>הצג Python ו-logs לצורך אבחון</summary>
                      {bridgeTestResult.codeRuns.map((run, index) => (
                        <div key={run.id || index} className="scheduling-agent-sandbox-code-run">
                          <pre>{run.code || "(לא הוחזר קוד)"}</pre>
                          {run.logs && <pre>{run.logs}</pre>}
                        </div>
                      ))}
                    </details>
                  )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="scheduling-agent-panel scheduling-agent-sandbox-panel">
        <div className="scheduling-agent-sandbox-header">
          <div>
            <strong>Validator failure-injection test v1</strong>
            <div className="scheduling-agent-sandbox-subtitle">
              Python מסיר בכוונה שיבוץ רגיל אחד. הצלחה = ה-Validator מזהה את הפגם ומדווח עליו.
            </div>
          </div>

          <button
            type="button"
            onClick={runCandidateValidatorFailureTest}
            disabled={
              isFailureTesting ||
              !agentContext?.schoolData ||
              !agentContext?.baseSchedule
            }
          >
            {isFailureTesting
              ? "יוצר Candidate פגום ובודק..."
              : "בדוק זיהוי כשל מכוון"}
          </button>
        </div>

        {failureTestResult && (
          <div
            className={
              failureTestResult.success
                ? "scheduling-agent-sandbox-result success"
                : "scheduling-agent-sandbox-result error"
            }
          >
            {failureTestResult.success ? (
              <>
                <div>✓ Python יצר פגם מכוון וה-Validator זיהה אותו כמצופה.</div>
                <div>
                  שעות לפני: {failureTestResult.beforeValidation?.statistics?.totalScheduledHours ?? "?"}/
                  {failureTestResult.beforeValidation?.statistics?.totalRequiredHours ?? "?"} ·
                  אחרי: {failureTestResult.validation?.statistics?.totalScheduledHours ?? "?"}/
                  {failureTestResult.validation?.statistics?.totalRequiredHours ?? "?"}
                </div>
                <div>
                  חסרות: {failureTestResult.validation?.statistics?.totalMissingHours ?? "?"} ·
                  שגיאות: {failureTestResult.validation?.statistics?.errorCount ?? "?"} ·
                  אזהרות: {failureTestResult.validation?.statistics?.warningCount ?? "?"}
                </div>
                {failureTestResult.injectedFailure && (
                  <div>
                    הוסר: {failureTestResult.injectedFailure.unitId} ·
                    כיתה {failureTestResult.injectedFailure.className} ·
                    יום {failureTestResult.injectedFailure.day} ·
                    שעה {failureTestResult.injectedFailure.hour}
                  </div>
                )}
                {Array.isArray(failureTestResult.validation?.warnings) &&
                  failureTestResult.validation.warnings.length > 0 && (
                    <details>
                      <summary>הצג אזהרות Validator</summary>
                      <pre style={{ whiteSpace: "pre-wrap", direction: "ltr", textAlign: "left" }}>
                        {JSON.stringify(failureTestResult.validation.warnings, null, 2)}
                      </pre>
                    </details>
                  )}
                {Array.isArray(failureTestResult.validation?.errors) &&
                  failureTestResult.validation.errors.length > 0 && (
                    <details>
                      <summary>הצג שגיאות Validator</summary>
                      <pre style={{ whiteSpace: "pre-wrap", direction: "ltr", textAlign: "left" }}>
                        {JSON.stringify(failureTestResult.validation.errors, null, 2)}
                      </pre>
                    </details>
                  )}
                {Array.isArray(failureTestResult.codeRuns) &&
                  failureTestResult.codeRuns.length > 0 && (
                    <details>
                      <summary>הצג Python ו-logs של יצירת הפגם</summary>
                      {failureTestResult.codeRuns.map((run, index) => (
                        <div key={run.id || index} className="scheduling-agent-sandbox-code-run">
                          <strong>הרצה {index + 1}</strong>
                          <pre>{run.code || "(לא הוחזר קוד)"}</pre>
                          {run.logs && <pre>{run.logs}</pre>}
                        </div>
                      ))}
                    </details>
                  )}
              </>
            ) : (
              <>
                <div>✕ {failureTestResult.error || "בדיקת הכשל המכוון לא עברה."}</div>
                {failureTestResult.checks && (
                  <pre style={{ whiteSpace: "pre-wrap", direction: "ltr", textAlign: "left" }}>
                    {JSON.stringify(failureTestResult.checks, null, 2)}
                  </pre>
                )}
                {failureTestResult.deltas && (
                  <pre style={{ whiteSpace: "pre-wrap", direction: "ltr", textAlign: "left" }}>
                    {JSON.stringify(failureTestResult.deltas, null, 2)}
                  </pre>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="scheduling-agent-panel scheduling-agent-sandbox-panel">
        <div className="scheduling-agent-sandbox-header">
          <div>
            <strong>Auto-Repair Loop v1.2 — Async</strong>
            <div className="scheduling-agent-sandbox-subtitle">
              כל Attempt רץ כ-OpenAI background response. ה-UI מבצע polling קצר ולכן Netlify Function לא נשארת פתוחה בזמן הרצת Python.
            </div>
          </div>
          <button type="button" onClick={runAutoRepairLoopTest} disabled={isAutoRepairTesting || !agentContext?.schoolData || !agentContext?.baseSchedule}>
            {isAutoRepairTesting
              ? autoRepairTestResult?.currentPhase?.startsWith("attempt-1")
                ? `Attempt 1 — ${autoRepairTestResult?.backgroundStatus || "מתקן"}...`
                : `Attempt 0 — ${autoRepairTestResult?.backgroundStatus || "יוצר פגם"}...`
              : "בדוק Auto-Repair Loop"}
          </button>
        </div>
        {autoRepairTestResult && (
          <div className={autoRepairTestResult.success ? "scheduling-agent-sandbox-result success" : "scheduling-agent-sandbox-result error"}>
            {autoRepairTestResult.success ? (
              <>
                <div>✓ הסוכן קיבל דו״ח Validator ותיקן את ה-Candidate באמצעות Python.</div>
                <div>
                  ניסיון 0: {autoRepairTestResult.attempts?.[0]?.validation?.statistics?.totalScheduledHours ?? "?"}/{autoRepairTestResult.attempts?.[0]?.validation?.statistics?.totalRequiredHours ?? "?"} ·
                  ניסיון 1: {autoRepairTestResult.attempts?.[1]?.validation?.statistics?.totalScheduledHours ?? "?"}/{autoRepairTestResult.attempts?.[1]?.validation?.statistics?.totalRequiredHours ?? "?"}
                </div>
                <div>
                  סופי — שגיאות: {autoRepairTestResult.attempts?.[1]?.validation?.statistics?.errorCount ?? "?"} ·
                  אזהרות: {autoRepairTestResult.attempts?.[1]?.validation?.statistics?.warningCount ?? "?"} ·
                  חסרות: {autoRepairTestResult.attempts?.[1]?.validation?.statistics?.totalMissingHours ?? "?"}
                </div>
                <div>
                  Python runs — ניסיון 0: {autoRepairTestResult.attempts?.[0]?.codeRuns?.length || 0} ·
                  ניסיון 1: {autoRepairTestResult.attempts?.[1]?.codeRuns?.length || 0}
                </div>
                <div>
                  Bounded Multi-Step — Attempt 1 Python runs: current {autoRepairTestResult.attempts?.[1]?.codeRuns?.length || 0}
                </div>
              </>
            ) : autoRepairTestResult.running ? (
              <div>
                ⏳ {autoRepairTestResult.currentPhase?.startsWith("attempt-1")
                  ? `Attempt 1 רץ ברקע — ${autoRepairTestResult.backgroundStatus || "queued"}. ה-UI בודק סטטוס בלי להחזיק Function פתוחה.`
                  : `Attempt 0 רץ ברקע — ${autoRepairTestResult.backgroundStatus || "queued"}. ה-UI בודק סטטוס בלי להחזיק Function פתוחה.`}
              </div>
            ) : (
              <div>✕ {autoRepairTestResult.error || "Auto-Repair Loop לא עבר את הבדיקה."}</div>
            )}
            {autoRepairTestResult.checks && <pre style={{ whiteSpace:"pre-wrap", direction:"ltr", textAlign:"left" }}>{JSON.stringify(autoRepairTestResult.checks,null,2)}</pre>}
            {Array.isArray(autoRepairTestResult.attempts) && autoRepairTestResult.attempts.map((attempt) => (
              <details key={attempt.number}>
                <summary>ניסיון {attempt.number} — {attempt.purpose}</summary>
                {attempt.reply && <div>{attempt.reply}</div>}
                <pre style={{ whiteSpace:"pre-wrap", direction:"ltr", textAlign:"left" }}>{JSON.stringify(attempt.validation?.statistics || {},null,2)}</pre>
                {attempt.diagnostics && (
                  <details>
                    <summary>Diagnostics</summary>
                    <pre style={{ whiteSpace:"pre-wrap", direction:"ltr", textAlign:"left" }}>{JSON.stringify(attempt.diagnostics,null,2)}</pre>
                  </details>
                )}
                {(attempt.codeRuns || []).map((run,index) => <div key={run.id || index} className="scheduling-agent-sandbox-code-run"><strong>Python run {index+1}</strong><pre>{run.code || "(לא הוחזר קוד)"}</pre>{run.logs && <pre>{run.logs}</pre>}</div>)}
              </details>
            ))}
          </div>
        )}
      </div>

      <div className="scheduling-agent-workspace-controls">
        {!workspace ? (
          <>
            <button type="button" onClick={onStartWorkspace}>
              התחל סביבת עבודה לתיקון
            </button>
            <button type="button" onClick={onStartGenerationWorkspace}>
              התחל Generation Workspace מאפס
            </button>
          </>
        ) : (
          <>
            <div>
              סביבת עבודה פעילה
            </div>

            <div>
              ניסיונות:{" "}
              {workspace.attempts?.length || 0}
            </div>

            {workspace.mode === "generation" && generationStats && (
              <div className="generation-workspace-dashboard">
                <strong>Generation Run #1 — Empty → Full</strong>
                <div>שובצו: {generationStats.totalScheduledHours} / {generationStats.totalRequiredHours}</div>
                <div>התקדמות: {generationStats.schedulingPercentage}%</div>
                <div>חסרות: {generationStats.totalMissingHours}</div>
                <div>שגיאות Core: {generationStats.errorCount}</div>
                <div>אזהרות: {generationStats.warningCount}</div>
                <div>יחידות עם שעות חסרות: {generationStats.missingUnitCount}</div>
                <button type="button" onClick={runGenerationAttempt} disabled={isGenerationRunning}>
                  {isGenerationRunning ? `Generation רץ — ${generationRunResult?.phase || "מתחיל"}...` : "הרץ Generation Attempt"}
                </button>
                <button type="button" onClick={exportGenerationTrace}>יצא Trace של הריצה</button>
                {generationRunResult && !generationRunResult.running && (
                  <div className={generationRunResult.error ? "scheduling-agent-sandbox-result error" : "scheduling-agent-sandbox-result success"}>
                    {generationRunResult.error ? `✕ ${generationRunResult.error}` : (
                      <>
                        <div>✓ Candidate נוצר ונבדק ב-Validator.</div>
                        <div>Python runs: {generationRunResult.codeRuns?.length || 0}</div>
                        <div>Strategy: {generationRunResult.modelResult?.strategySummary || "—"}</div>
                        <details><summary>Generation trace / Python</summary>
                          {(generationRunResult.codeRuns || []).map((run, index) => <div key={run.id || index}><strong>Python run {index + 1}</strong><pre>{run.code || ""}</pre><pre>{run.logs || ""}</pre></div>)}
                        </details>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

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

            <div style={{ marginTop: "6px", marginBottom: "8px" }}>
              <label>
                <small style={{ marginInlineEnd: "6px" }}>סוג החוק:</small>
                <select
                  value={newRuleSeverity}
                  onChange={(event) => setNewRuleSeverity(event.target.value)}
                >
                  <option value="auto">אוטומטי — הקומפיילר יחליט</option>
                  <option value="critical">קריטי</option>
                  <option value="known_constraint">אילוץ ידוע</option>
                  <option value="recommended">מומלץ</option>
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={handleAddRule}
              disabled={!newRuleText.trim()}
            >
              הוסף חוק
            </button>

            <button
              type="button"
              onClick={runRuleCompiler}
              disabled={isRuleCompiling || rules.length === 0}
              style={{ marginInlineStart: "8px" }}
            >
              {isRuleCompiling
                ? "מקמפל חוקי־על..."
                : "Rule Compiler v6.6.3 — קמפל חוקים"}
            </button>

            {isRuleCompiling && ruleCompilerPhase && (
              <div style={{ marginTop: "8px" }}>
                ⏳ {ruleCompilerPhase}
              </div>
            )}

            {ruleCompilerResult && (
              <div
                className={
                  ruleCompilerResult.success
                    ? "scheduling-agent-sandbox-result success"
                    : "scheduling-agent-sandbox-result error"
                }
                style={{ marginTop: "8px" }}
              >
                {ruleCompilerResult.success ? (
                  <>
                    <div>
                      ✓ Rule Compiler עיבד{" "}
                      {ruleCompilerResult.compiledRules?.length || 0} חוקים.
                    </div>
                    <div>
                      Evaluator נתמך:{" "}
                      {(ruleCompilerResult.deterministicResults || []).filter(
                        (item) => item.status !== "unknown"
                      ).length}
                      {" "}· פורמלי אך לא נתמך:{" "}
                      {(ruleCompilerResult.deterministicResults || []).filter(
                        (item) => item.status === "unknown"
                      ).length}
                      {" "}· פורמלי חלקית:{" "}
                      {(ruleCompilerResult.compiledRules || []).filter(
                        (item) =>
                          item.formalizationStatus === "partially_formalized"
                      ).length}
                      {" "}· הנחיות גמישות:{" "}
                      {(ruleCompilerResult.compiledRules || []).filter(
                        (item) =>
                          item.formalizationStatus === "semantic_only"
                      ).length}
                      {" "}· דורש הבהרה:{" "}
                      {(ruleCompilerResult.compiledRules || []).filter(
                        (item) =>
                          item.formalizationStatus === "needs_clarification"
                      ).length}
                    </div>
                  </>
                ) : (
                  <div>
                    ✕ {ruleCompilerResult.error || "Rule Compiler נכשל"}
                  </div>
                )}
              </div>
            )}

            {rules.length === 0 ? (
              <p>עדיין לא הוגדרו חוקי־על.</p>
            ) : (
              <ul className="scheduling-agent-list">
                {rules.map((rule, index) => (
                  <li
                    key={rule.id}
                    className="scheduling-agent-list-item"
                  >
                    <div className="scheduling-agent-list-content">
                      <div>
                        <strong>
                          חוק {rule.ruleNumber || index + 1}
                        </strong>
                        {" — "}
                        {rule.originalText}
                      </div>

                      <small>
                        סטטוס: {rule.status}
                      </small>

                      <div>
                        <label>
                          <small>קטגוריה: </small>
                          <select
                            value={rule.category || "unspecified"}
                            onChange={(event) =>
                              handleRuleCategoryChange(
                                rule.id,
                                event.target.value,
                              )
                            }
                          >
                            <option value="auto">אוטומטי</option>
                            <option value="critical">קריטי</option>
                            <option value="known_constraint">אילוץ ידוע</option>
                            <option value="recommended">מומלץ</option>
                            <option value="unspecified">לא מסווג</option>
                          </select>
                          {rule.severityMode === "manual" || rule.categorySource === "user" ? (
                            <small> · נקבע ידנית</small>
                          ) : (
                            <small> · זוהה אוטומטית</small>
                          )}
                        </label>
                      </div>

                      {rule.interpretation && (
                        <div className="scheduling-agent-rule-check">
                          <div>
                            <strong>פרשנות:</strong>{" "}
                            {rule.interpretation}
                          </div>

                          <div>
                            <strong>סוג יישום:</strong>{" "}
                            {getRuleKindLabel(rule.ruleKind)}
                          </div>

                          <div>
                            <strong>Evaluator:</strong>{" "}
                            {rule.evaluatorKey || "unsupported"}
                          </div>

                          {rule.status === "partially_formalized" &&
                            rule.formalCoverage && (
                              <div className="scheduling-agent-rule-check">
                                <div>
                                  <strong>כיסוי פורמלי:</strong>{" "}
                                  {rule.formalCoverage.covered || "לא צוין"}
                                </div>
                                <div>
                                  <strong>נשאר סמנטי:</strong>{" "}
                                  {rule.formalCoverage.semanticOnly || "לא צוין"}
                                </div>
                              </div>
                            )}

                          {!rule.formalRule && rule.semanticGuidance && (
                            <div>
                              <strong>הנחיה לסוכן:</strong>{" "}
                              {rule.semanticGuidance}
                            </div>
                          )}

                          {rule.formalRule && (
                            <details>
                              <summary>Formal Rule JSON</summary>
                              <pre
                                style={{
                                  whiteSpace: "pre-wrap",
                                  direction: "ltr",
                                  textAlign: "left",
                                }}
                              >
                                {JSON.stringify(
                                  rule.formalRule,
                                  null,
                                  2,
                                )}
                              </pre>
                            </details>
                          )}

                          {rule.clarificationQuestion && (
                            <div>
                              <strong>נדרשת הבהרה:</strong>{" "}
                              {rule.clarificationQuestion}
                            </div>
                          )}
                        </div>
                      )}

                      {rule.checkStatus && (
                        <div className="scheduling-agent-rule-check">
                          <div>
                            מצב במערכת:{" "}
                            <strong>
                              {rule.checkStatus === "satisfied"
                                ? "✓ מתקיים"
                                : rule.checkStatus === "violated"
                                  ? "✕ מופר"
                                  : rule.checkStatus === "partial_satisfied"
                                    ? "◐ החלק הפורמלי מתקיים"
                                    : rule.checkStatus === "partial_violated"
                                      ? "◐ החלק הפורמלי מופר"
                                      : rule.checkStatus === "guidance"
                                        ? "◈ הנחיה גמישה"
                                        : rule.checkStatus === "clarification"
                                          ? "נדרשת הבהרה"
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
