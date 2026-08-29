
const HEBREW_HOUR_WORDS = new Map([
  ["ראשונה", 1], ["הראשונה", 1],
  ["שניה", 2], ["שנייה", 2], ["השניה", 2], ["השנייה", 2],
  ["שלישית", 3], ["השלישית", 3],
  ["רביעית", 4], ["הרביעית", 4],
  ["חמישית", 5], ["החמישית", 5],
  ["שישית", 6], ["השישית", 6],
  ["שביעית", 7], ["השביעית", 7],
  ["שמינית", 8], ["השמינית", 8],
  ["תשיעית", 9], ["התשיעית", 9],
]);

function walkExpression(expression, visit) {
  if (!expression || typeof expression !== "object") return;
  visit(expression);

  for (const child of expression.children || []) {
    const nested = child?.expression || child;
    walkExpression(nested, visit);
  }
  if (expression.when) walkExpression(expression.when, visit);
  if (expression.then) walkExpression(expression.then, visit);
}

function expressionHasFilter(expression, field) {
  let found = false;
  walkExpression(expression, (node) => {
    if ((node.filters || []).some((filter) => filter?.field === field)) {
      found = true;
    }
  });
  return found;
}

function resolvedConstraintGroupIds(compiled) {
  return (compiled?.resolvedEntities || [])
    .filter((entity) => entity?.entityType === "constraintGroup" && entity?.id)
    .map((entity) => String(entity.id));
}

function containsExclusiveLanguage(text) {
  const value = String(text || "");
  return /(?:^|\s)(?:רק|בלבד|אך\s+ורק)(?:\s|$|[,.])/u.test(value);
}

function extractHour(text) {
  const value = String(text || "");

  const numeric = value.match(
    /(?:שעה|בשעה|hour)\s*(?:ה[-־]?)?(\d{1,2})/iu,
  );
  if (numeric) {
    const hour = Number(numeric[1]);
    if (Number.isInteger(hour) && hour >= 1 && hour <= 24) return hour;
  }

  const word = value.match(
    /(?:שעה|בשעה)\s+(ה?(?:ראשונה|שניה|שנייה|שלישית|רביעית|חמישית|שישית|שביעית|שמינית|תשיעית))/u,
  );
  if (word) return HEBREW_HOUR_WORDS.get(word[1]) || null;

  return null;
}

function hasExplicitDay(text) {
  const value = String(text || "");
  return /(?:יום|בימי|ביום)\s+(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|א['׳]?|ב['׳]?|ג['׳]?|ד['׳]?|ה['׳]?|ו['׳]?)/u.test(value);
}

function textDefinesDayDimension(text) {
  const value = String(text || "");
  return (
    hasExplicitDay(value) ||
    /(?:בכל\s+יום|כל\s+יום|בכל\s+ימות|כל\s+ימות|כל\s+השבוע)/u.test(value)
  );
}

const POPULATION_SCOPE_FIELDS = new Set([
  "isTeacherFirstTeachingSlot",
  "isTeacherLastTeachingSlot",
  "isTeacherActivityFirstSlot",
  "isTeacherActivityLastSlot",
  "isClassFirstTeachingSlot",
  "isClassLastTeachingSlot",
  "isClassActivityFirstSlot",
  "isClassActivityLastSlot",
]);

function predicateToConditions(predicate) {
  if (!predicate || typeof predicate !== "object") return null;
  if (predicate.type === "condition") return [predicate];
  if (predicate.type === "and") {
    const conditions = [];
    for (const child of predicate.children || []) {
      if (child?.type !== "condition") return null;
      conditions.push(child);
    }
    return conditions;
  }
  return null;
}

function conditionsToPredicate(conditions) {
  if (!conditions?.length) return null;
  if (conditions.length === 1) return conditions[0];
  return { type: "and", children: conditions };
}

function repairCoveragePopulationScope(expression, originalText) {
  const next = JSON.parse(JSON.stringify(expression));
  let repaired = false;
  const text = String(originalText || "");
  const temporalPositionIntent =
    /(?:הראשון|הראשונה|ראשון|ראשונה|האחרון|האחרונה|מתחיל|מתחילה|יתחיל|תתחיל|מסיים|מסיימת|יסיים|תסיים)/u.test(text);

  if (!temporalPositionIntent) return { expression: next, repaired };

  walkExpression(next, (node) => {
    if (node?.type !== "coverage" || !node.match) return;
    const conditions = predicateToConditions(node.match);
    if (!conditions) return;

    const scopeConditions = conditions.filter((condition) =>
      POPULATION_SCOPE_FIELDS.has(condition?.field),
    );
    if (!scopeConditions.length) return;

    const remainingMatch = conditions.filter(
      (condition) => !POPULATION_SCOPE_FIELDS.has(condition?.field),
    );
    node.filters = Array.isArray(node.filters) ? node.filters : [];

    for (const condition of scopeConditions) {
      const alreadyScoped = node.filters.some(
        (filter) =>
          filter?.field === condition.field &&
          filter?.op === condition.op &&
          JSON.stringify(filter?.value) === JSON.stringify(condition?.value),
      );
      if (!alreadyScoped) {
        node.filters.push({
          field: condition.field,
          op: condition.op,
          value: condition.value,
        });
      }
    }

    node.match = conditionsToPredicate(remainingMatch);
    repaired = true;
  });

  return { expression: next, repaired };
}

function requiredSlotsInventUnspecifiedDay(expression, originalText) {
  if (expression?.type !== "required_slots") return false;
  if (textDefinesDayDimension(originalText)) return false;
  return (expression.requirements || []).some((requirement) => requirement?.day != null);
}

function requiredSlotsToExistsWithoutInventedDay(expression) {
  if (expression?.type !== "required_slots") return null;
  const children = [];

  for (const requirement of expression.requirements || []) {
    const filters = [];
    if (requirement?.teacherId != null) {
      filters.push({ field: "teacherId", op: "eq", value: String(requirement.teacherId) });
    }
    if (requirement?.className != null) {
      filters.push({ field: "className", op: "eq", value: String(requirement.className) });
    }
    if (requirement?.constraintGroupId != null) {
      filters.push({
        field: "constraintGroupId",
        op: "eq",
        value: String(requirement.constraintGroupId),
      });
    }
    if (requirement?.hour != null) {
      filters.push({ field: "hour", op: "eq", value: Number(requirement.hour) });
    }
    if (!filters.length) return null;
    children.push({
      type: "exists",
      source: "placements",
      filters,
      exclude: [],
      minCount: 1,
      maxCount: null,
    });
  }

  if (!children.length) return null;
  return children.length === 1 ? children[0] : { type: "and", children };
}

function replaceWeakSubjectGrounding(expression, constraintGroupIds) {
  if (!expression || typeof expression !== "object") return expression;

  const next = JSON.parse(JSON.stringify(expression));

  walkExpression(next, (node) => {
    if (!Array.isArray(node.filters)) return;
    const hasGroupFilter = node.filters.some(
      (filter) => filter?.field === "constraintGroupId",
    );
    if (hasGroupFilter) return;

    const subjectIndexes = node.filters
      .map((filter, index) => filter?.field === "subject" ? index : -1)
      .filter((index) => index >= 0);

    if (!subjectIndexes.length) return;

    node.filters = node.filters.filter((filter) => filter?.field !== "subject");
    node.filters.push({
      field: "constraintGroupId",
      op: constraintGroupIds.length === 1 ? "eq" : "in",
      value:
        constraintGroupIds.length === 1
          ? constraintGroupIds[0]
          : constraintGroupIds,
    });
  });

  return next;
}

function buildExclusivityChildFromRequirement(requirement) {
  if (!requirement?.constraintGroupId) return null;

  const assertions = [];
  if (requirement.day != null) {
    assertions.push({ field: "day", op: "eq", value: requirement.day });
  }
  if (requirement.hour != null) {
    assertions.push({ field: "hour", op: "eq", value: requirement.hour });
  }
  if (!assertions.length) return null;

  return {
    type: "every_placement",
    source: "placements",
    filters: [
      {
        field: "constraintGroupId",
        op: "eq",
        value: requirement.constraintGroupId,
      },
    ],
    exclude: [],
    assertions,
    predicate: null,
  };
}

export function validateSemanticContract({
  originalText,
  compiled,
  formalRule,
}) {
  const errors = [];
  const expression = formalRule?.expression || null;
  const groupIds = resolvedConstraintGroupIds(compiled);

  if (
    expression &&
    groupIds.length > 0 &&
    expressionHasFilter(expression, "subject") &&
    !expressionHasFilter(expression, "constraintGroupId")
  ) {
    errors.push({
      code: "grounding_mismatch",
      message:
        "Formal Rule uses weak subject grounding even though resolved constraint groups are available.",
    });
  }

  if (
    expression?.type === "required_slots" &&
    containsExclusiveLanguage(originalText)
  ) {
    errors.push({
      code: "exclusivity_missing",
      message:
        "Exclusive language cannot be represented by required_slots alone.",
    });
  }

  if (requiredSlotsInventUnspecifiedDay(expression, originalText)) {
    errors.push({
      code: "temporal_grounding_hallucination",
      message:
        "Formal Rule invented a concrete day even though the user left the day unspecified.",
    });
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function repairFormalRuleSemanticContract({
  originalText,
  compiled,
  formalRule,
}) {
  if (!formalRule?.expression) {
    return { formalRule, repaired: false, repairs: [] };
  }

  let repairedRule = JSON.parse(JSON.stringify(formalRule));
  const repairs = [];
  const groupIds = resolvedConstraintGroupIds(compiled);

  if (
    groupIds.length > 0 &&
    expressionHasFilter(repairedRule.expression, "subject") &&
    !expressionHasFilter(repairedRule.expression, "constraintGroupId")
  ) {
    repairedRule.expression = replaceWeakSubjectGrounding(
      repairedRule.expression,
      groupIds,
    );
    repairs.push("grounding_subject_to_constraint_groups");
  }

  if (requiredSlotsInventUnspecifiedDay(repairedRule.expression, originalText)) {
    const existsExpression = requiredSlotsToExistsWithoutInventedDay(
      repairedRule.expression,
    );
    if (existsExpression) {
      repairedRule.expression = existsExpression;
      repairs.push("invented_day_to_exists");
    }
  }

  const populationRepair = repairCoveragePopulationScope(
    repairedRule.expression,
    originalText,
  );
  if (populationRepair.repaired) {
    repairedRule.expression = populationRepair.expression;
    repairs.push("coverage_match_scope_to_population_filter");
  }

  if (
    repairedRule.expression?.type === "required_slots" &&
    containsExclusiveLanguage(originalText)
  ) {
    const requirements = repairedRule.expression.requirements || [];
    const exclusivityChildren = requirements
      .map(buildExclusivityChildFromRequirement)
      .filter(Boolean);

    // Only repair automatically when structural group identity makes the
    // exclusivity scope unambiguous. Otherwise validation will reject it.
    if (
      exclusivityChildren.length > 0 &&
      exclusivityChildren.length === requirements.length
    ) {
      repairedRule.expression = {
        type: "and",
        children: [
          repairedRule.expression,
          ...exclusivityChildren,
        ],
      };
      repairs.push("required_slots_plus_exclusivity");
    }
  }

  return {
    formalRule: repairedRule,
    repaired: repairs.length > 0,
    repairs,
  };
}

export function buildExistsRepairFromSemanticOnly({
  originalText,
  compiled,
  severity,
}) {
  if (compiled?.formalizationStatus !== "semantic_only") return null;

  const explanation = [
    compiled?.explanation,
    compiled?.formalCoverage?.semanticOnly,
    compiled?.capabilityPlan?.composition,
    ...(compiled?.capabilityPlan?.unsupportedRequirements || []),
  ].join(" ");

  const mentionsExists = /\bexists\b/i.test(explanation);
  const missingDay =
    /(?:day|יום).*(?:unspecified|לא\s+צוין|חסר|לא-מוגדר)/iu.test(explanation) ||
    /(?:לא\s+צוין|חסר).*(?:day|יום)/iu.test(explanation);

  if (!mentionsExists || !missingDay || hasExplicitDay(originalText)) {
    return null;
  }

  const teachers = (compiled?.resolvedEntities || []).filter(
    (entity) => entity?.entityType === "teacher" && entity?.id,
  );
  const classes = (compiled?.resolvedEntities || []).filter(
    (entity) => entity?.entityType === "class" && entity?.id,
  );
  const groups = (compiled?.resolvedEntities || []).filter(
    (entity) => entity?.entityType === "constraintGroup" && entity?.id,
  );
  const hour = extractHour(originalText);

  if (!hour) return null;
  if (teachers.length > 1 || classes.length > 1 || groups.length > 1) {
    return null;
  }
  if (!teachers.length && !groups.length) return null;

  const filters = [];
  if (teachers.length === 1) {
    filters.push({
      field: "teacherId",
      op: "eq",
      value: String(teachers[0].id),
    });
  }
  if (classes.length === 1) {
    filters.push({
      field: "className",
      op: "eq",
      value: String(classes[0].id),
    });
  }
  if (groups.length === 1) {
    filters.push({
      field: "constraintGroupId",
      op: "eq",
      value: String(groups[0].id),
    });
  }
  filters.push({ field: "hour", op: "eq", value: hour });

  return {
    version: 4,
    severity,
    expression: {
      type: "exists",
      source: "placements",
      filters,
      exclude: [],
      minCount: 1,
      maxCount: null,
    },
  };
}

export function preserveSafePartialFormalRule({
  originalText,
  compiled,
  previousRule,
  severity,
}) {
  if (compiled?.formalizationStatus !== "needs_clarification") return null;
  if (previousRule?.status !== "partially_formalized") return null;
  if (!previousRule?.formalRule?.expression) return null;

  const plan = compiled?.capabilityPlan || {};
  const measurablePartAcknowledged =
    (plan.selectedCapabilities || []).length > 0 &&
    (
      /(?:ניתן|אפשר|מדיד|measur|formal)/iu.test(
        [
          plan.composition,
          compiled?.formalCoverage?.semanticOnly,
          compiled?.explanation,
        ].join(" "),
      ) ||
      (plan.requirements || []).length > (plan.unsupportedRequirements || []).length
    );

  if (!measurablePartAcknowledged) return null;

  const candidate = JSON.parse(JSON.stringify(previousRule.formalRule));
  candidate.severity = severity;
  const repaired = repairFormalRuleSemanticContract({
    originalText,
    compiled,
    formalRule: candidate,
  });
  const contract = validateSemanticContract({
    originalText,
    compiled,
    formalRule: repaired.formalRule,
  });
  if (!contract.ok) return null;

  return {
    formalRule: repaired.formalRule,
    repairs: [
      ...(repaired.repairs || []),
      "preserved_safe_partial_formalization",
    ],
  };
}

