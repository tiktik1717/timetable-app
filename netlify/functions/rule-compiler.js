import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.SCHEDULING_OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1",
});

const compiledRuleSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ruleId: { type: "string" },
    category: {
      type: "string",
      enum: ["critical", "known_constraint", "recommended", "unspecified"],
    },
    formalizationStatus: {
      type: "string",
      enum: ["formalized", "semantic_only", "needs_clarification"],
    },
    interpretation: { type: "string" },
    formalRuleJson: {
      anyOf: [{ type: "null" }, { type: "string" }],
    },
    evaluatorKey: {
      type: "string",
      enum: [
        "teacher_no_internal_gaps",
        "class_no_internal_gaps",
        "grade_same_end_hour",
        "teacher_allowed_days",
        "teacher_blocked_hours",
        "exact_slot",
        "unique_simultaneous_group_type",
        "grade_exact_end_hour",
        "homeroom_first_hours",
        "non_homeroom_max_hours_same_class_day",
        "compound",
        "unsupported",
      ],
    },
    resolvedEntities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          entityType: {
            type: "string",
            enum: ["teacher", "class", "grade", "constraintGroup"],
          },
          id: { type: "string" },
          name: { type: "string" },
        },
        required: ["entityType", "id", "name"],
      },
    },
    clarificationQuestion: {
      anyOf: [{ type: "null" }, { type: "string" }],
    },
    explanation: { type: "string" },
  },
  required: [
    "ruleId",
    "category",
    "formalizationStatus",
    "interpretation",
    "formalRuleJson",
    "evaluatorKey",
    "resolvedEntities",
    "clarificationQuestion",
    "explanation",
  ],
};

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    compiledRules: {
      type: "array",
      items: compiledRuleSchema,
    },
  },
  required: ["compiledRules"],
};

function compactEntities(schoolData = {}) {
  const teachers = (schoolData.teachers || []).map((t) => ({
    id: String(t.id),
    name: String(t.name || t.teacherName || ""),
    educationClass: t.educationClass
      ? String(t.educationClass)
      : null,
  }));

  return {
    teachers,
    classes: (schoolData.classes || []).map((c) =>
      typeof c === "string"
        ? { id: c, name: c }
        : {
            id: String(c.id || c.name || c.className || ""),
            name: String(c.name || c.className || c.id || ""),
          },
    ),
    constraintGroups: (schoolData.constraintGroups || []).map((g) => ({
      id: String(g.id),
      name: String(g.name || g.label || g.subject || ""),
    })),
    homerooms: teachers
      .filter((t) => t.educationClass)
      .map((t) => ({
        className: t.educationClass,
        teacherId: t.id,
        teacherName: t.name,
      })),
    canonicalDays: ["א", "ב", "ג", "ד", "ה", "ו"],
    dayAliases: {
      "ראשון": "א",
      "יום ראשון": "א",
      "שני": "ב",
      "יום שני": "ב",
      "שלישי": "ג",
      "יום שלישי": "ג",
      "רביעי": "ד",
      "יום רביעי": "ד",
      "חמישי": "ה",
      "יום חמישי": "ה",
      "שישי": "ו",
      "יום שישי": "ו"
    }
  };
}

export default async (request) => {
  try {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const rules = Array.isArray(body?.rules) ? body.rules : [];
    const schoolData = body?.schoolData || {};

    if (rules.length === 0) {
      return new Response(JSON.stringify({ error: "At least one rule is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const entities = compactEntities(schoolData);
    const model = "gpt-5.2";
    const startedAt = Date.now();

    const instructions = `
אתה Rule Compiler v2 עבור מערכת שעות בית ספרית.
תפקידך לתרגם כל חוק בשפה טבעית ל-IR פורמלי, בלי לפתור את המערכת.

עקרונות:
- החזר כלל אחד לכל ruleId ובאותו סדר.
- originalText הוא מקור האמת.
- אל תמציא IDs. השתמש רק ב-ENTITIES.
- אם category שסופק אינו "unspecified", שמור אותו בדיוק.
- אם category="unspecified", הסק:
  * איסור/חובה מפורשים ("אסור", "אין לשבץ", "חייב", "חובה", "צריכים", "צריך", "יש לשבץ", "יש לקבוע", "רק", "לא יכול", "לא ניתן") => critical.
  * חשוב: "יש לשבץ" הוא ניסוח מחייב ולכן critical, לא recommended.
  * ניסוח "אילוץ ידוע" / שיבוץ מחויב שניתן כעובדה => known_constraint רק כאשר הטקסט עצמו מציג אותו במפורש כאילוץ/עובדה קיימת ולא כדרישה.
  * "מומלץ", "רצוי", "עדיף", "כדאי", "יש לנסות", "עדיפות", "ככל שניתן", "ככל האפשר", "להשתדל" => recommended.
  * רק אם באמת אי אפשר לדעת => unspecified.
- בקש clarification רק כאשר חסר מידע מהותי שהמערכת והטקסט לא מספקים.
- אם מידע כבר קיים ב-ENTITIES (למשל מי מחנך איזו כיתה), השתמש בו ואל תשאל את המשתמש.
- נרמל שמות ימים תמיד לקודים הקנוניים: א,ב,ג,ד,ה,ו לפי dayAliases.
- ביטויים כמו "בתחילת היום", "רק בימים", "לפחות", "לכל היותר", "בדיוק", "אסור", "חייב" הם מידע מפורש שיש לקודד.

COMPOUND RULES:
- חוק טבעי אחד יכול להכיל כמה תנאים.
- אל תפצל אותו ל-ruleId נוסף ואל תבקש רשות לפצל.
- אם יש יותר מתנאי אחד, formalRuleJson חייב להיות version=2 עם operator="AND" ו-clauses[].
- כל clause מקבל evaluatorKey משלו.
- evaluatorKey ברמת החוק יהיה "compound".
- אם clause אחד formalizable אך evaluator שלו עדיין unsupported, החוק יכול עדיין להיות formalized; רק אותו clause יהיה unsupported.

Formal Rule v2:
{
  "version": 2,
  "operator": "AND",
  "clauses": [
    {
      "id": "c1",
      "scope": "teacher|teacher_day|class|class_day|grade|global|constraint_group|teacher_class_day",
      "constraint": "<snake_case>",
      "evaluatorKey": "<key>",
      "targets": {
        "teacherIds": [],
        "classNames": [],
        "grades": [],
        "constraintGroupIds": []
      },
      "params": {
        "days": [],
        "hours": [],
        "min": null,
        "max": null,
        "exact": null,
        "count": null,
        "value": null
      },
      "logic": "all"
    }
  ],
  "severity": "critical|known_constraint|recommended|unspecified"
}

לכל חוק פשוט מותר גם version=1 במבנה הישן, אבל עדיף version=2 גם לחוק בודד אם זה מונע אובדן משמעות.

Evaluator keys זמינים:
- teacher_no_internal_gaps
- class_no_internal_gaps
- grade_same_end_hour
- grade_exact_end_hour
- teacher_allowed_days
- teacher_blocked_hours
- homeroom_first_hours
- non_homeroom_max_hours_same_class_day
- exact_slot
- unique_simultaneous_group_type
- unsupported
- compound (רק ברמת החוק, לא clause)

סמנטיקה:
- grade_same_end_hour:
  כל כיתות השכבה מסיימות באותה שעה בכל יום שנבדק.
- grade_exact_end_hour:
  שכבה מסוימת מסיימת בשעה מדויקת בימים מסוימים.
  params.days = ימים קנוניים, params.exact = מספר השעה.
- teacher_allowed_days:
  מורה יכול להיות משובץ רק בימים שב-params.days.
- teacher_blocked_hours:
  איסור לשבץ מורה בשעות שב-params.hours.
  אם params.days ריק, האיסור חל בכל הימים; אם יש ימים, רק בהם.
- homeroom_first_hours:
  מחנך כל כיתה חייב להיות בכיתתו בתחילת היום.
  targets.classNames=[] פירושו כל כיתות-האם האמיתיות.
  params.days מגדיר ימים, params.count מספר השעות הראשונות.
  השתמש ב-ENTITIES.homerooms כדי לפתור את קשר מחנך-כיתה.
- non_homeroom_max_hours_same_class_day:
  לכל מורה שאינו מחנך הכיתה הספציפית יש מקסימום שעות באותה כיתה באותו יום.
  params.max = המקסימום המותר.
- class_no_internal_gaps:
  constraint="no_gaps_from_first_hour" כאשר נאסר במפורש גם חור בתחילת היום;
  constraint="no_internal_gaps" כאשר נאסרים רק חורים פנימיים.

דוגמאות:
1. "כל כיתות ה' צריכות לסיים בכל יום באותה שעה. ביום ראשון כל כיתות ה' יסיימו בשעה השישית."
=> compound עם:
 c1 grade_same_end_hour grades=["ה"]
 c2 grade_exact_end_hour grades=["ה"], days=["א"], exact=6

2. "המורה כהן אוריה (מורה 21) מלמדת רק בימי שלישי וחמישי ואסור לה ללמד בשעה הראשונה."
=> compound עם:
 c1 teacher_allowed_days teacherIds=["21"], days=["ג","ה"]
 c2 teacher_blocked_hours teacherIds=["21"], days=["ג","ה"], hours=[1]

3. "בימי שישי יש לשבץ את מחנך הכיתה בכיתה שלו בשעתיים הראשונות לפחות."
=> homeroom_first_hours, days=["ו"], count=2, classNames=[].
אין לבקש מיפוי; הוא נמצא ב-ENTITIES.homerooms.

4. "אסור שמורה שאינו מחנך כיתה יהיה משובץ בכיתה כלשהי ארבע שעות ביום אחד."
=> non_homeroom_max_hours_same_class_day, scope=teacher_class_day, params.max=3.
המשמעות היא 4 שעות באותה כיתה ספציפית, לא 4 שעות בכל הכיתות יחד.

formalizationStatus:
- formalized: כל המשמעות המהותית נשמרה ב-IR.
- semantic_only: המשמעות מובנת אך ה-IR לא מסוגל עדיין לייצג אותה בלי אובדן.
- needs_clarification: עמימות אמיתית שלא נפתרת מהטקסט או ENTITIES.

formalRuleJson חייב להיות JSON תקין כמחרוזת.
`; 

    const inputPayload = {
      rules: rules.map((r) => ({
        id: String(r.id),
        originalText: String(r.originalText || ""),
        category: r.category || null,
      })),
      entities,
    };

    const response = await client.responses.create({
      model,
      instructions,
      text: {
        format: {
          type: "json_schema",
          name: "timetable_rule_compiler_v2",
          strict: true,
          schema: responseSchema,
        },
      },
      input: `RULE_COMPILER_INPUT=${JSON.stringify(inputPayload)}`,
    });

    const parsed = JSON.parse(response.output_text || "{}");

    // Defensive parse of formalRuleJson. Keep the original string for audit,
    // but mark malformed JSON as semantic_only instead of silently accepting it.
    const compiledRules = (parsed.compiledRules || []).map((item) => {
      if (item.formalizationStatus !== "formalized" || !item.formalRuleJson) {
        return item;
      }
      try {
        JSON.parse(item.formalRuleJson);
        return item;
      } catch {
        return {
          ...item,
          formalizationStatus: "semantic_only",
          evaluatorKey: "unsupported",
          clarificationQuestion: null,
          explanation:
            `${item.explanation} [Compiler guard: formalRuleJson was not valid JSON.]`,
          formalRuleJson: null,
        };
      }
    });

    const usage = response.usage || {};
    return new Response(
      JSON.stringify({
        success: true,
        compiledRules,
        telemetry: {
          model: response.model || model,
          calls: 1,
          inputTokens: usage.input_tokens || 0,
          outputTokens: usage.output_tokens || 0,
          totalTokens:
            usage.total_tokens ||
            (usage.input_tokens || 0) + (usage.output_tokens || 0),
          durationMs: Date.now() - startedAt,
          ruleCount: rules.length,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Rule Compiler v1 failed:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Unknown Rule Compiler error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
