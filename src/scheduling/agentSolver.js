export const MAX_AGENT_ATTEMPTS = 10;

export async function solveWithAgent({
  initialAction,
  workspace,
  tryWorkspaceMove,
  evaluateAttempt,
}) {
  if (!initialAction) {
    return {
      status: "no_action",
      workspace,
      attempts: [],
      solution: null,
    };
  }

  let currentWorkspace = workspace;
  let currentAction = initialAction;

  const attempts = [];

  for (
    let attemptNumber = 1;
    attemptNumber <= MAX_AGENT_ATTEMPTS;
    attemptNumber += 1
  ) {
    const attemptResult =
      tryWorkspaceMove({
        workspace: currentWorkspace,
        action: currentAction,
      });

    currentWorkspace =
      attemptResult.workspace ||
      currentWorkspace;

    const attemptRecord = {
      attemptNumber,
      action: currentAction,
      success: attemptResult.success,
      error:
        attemptResult.error || null,
      validationComparison:
        attemptResult.validationComparison ||
        null,
    };

    attempts.push(attemptRecord);

    // אם אפילו הסימולציה המבנית נכשלה,
    // נחזיר את הכישלון לסוכן כדי שיציע חלופה.
    if (!attemptResult.success) {
      const evaluation =
        await evaluateAttempt({
          attemptedAction:
            currentAction,

          attemptResult,
        });

      const nextAction =
        evaluation?.proposedAction;

      if (
        nextAction?.type !==
        "proposeScheduleMove"
      ) {
        return {
          status: "stuck",
          workspace:
            currentWorkspace,
          attempts,
          solution: null,
          lastEvaluation:
            evaluation,
        };
      }

      currentAction =
        nextAction;

      continue;
    }

    // אם הסימולציה הצליחה,
    // הסוכן בודק את המערכת המדומה.
    const evaluation =
      await evaluateAttempt({
        attemptedAction:
          currentAction,

        attemptResult,
      });

    const relevantRuleResult =
      evaluation?.ruleCheckResults?.find(
        (result) =>
          result.status ===
          "satisfied"
      );

    const createdCoreErrors =
      (
        attemptResult
          ?.validationComparison
          ?.errorDelta || 0
      ) > 0;

    if (
      relevantRuleResult &&
      !createdCoreErrors
    ) {
      return {
        status: "solved",
        workspace:
          currentWorkspace,
        attempts,
        solution: {
          action: currentAction,
          evaluation,
          attemptResult,
        },
      };
    }

    // לא נפתר — הסוכן רשאי להציע ניסיון נוסף.
    const nextAction =
      evaluation?.proposedAction;

    if (
      nextAction?.type !==
      "proposeScheduleMove"
    ) {
      return {
        status: "stuck",
        workspace:
          currentWorkspace,
        attempts,
        solution: null,
        lastEvaluation:
          evaluation,
      };
    }

    currentAction =
      nextAction;
  }

  return {
    status: "max_attempts",
    workspace:
      currentWorkspace,
    attempts,
    solution: null,
  };
}