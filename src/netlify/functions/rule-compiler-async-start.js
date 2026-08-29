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
      enum: ["formalized", "partially_formalized", "semantic_only", "needs_clarification"],
    },
    ruleKind: {
      type: "string",
      enum: [
        "hard_constraint",
        "soft_preference",
        "comparison_objective",
        "search_strategy",
        "semantic_guidance"
      ],
    },
    interpretation: { type: "string" },
    semanticGuidance: { type: "string" },
    formalCoverage: {
      type: "object",
      additionalProperties: false,
      properties: {
        covered: { type: "string" },
        semanticOnly: { type: "string" },
      },
      required: ["covered", "semanticOnly"],
    },
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
        "grade_end_hour_cardinality",
        "teacher_free_day_cardinality",
        "teacher_exact_day_load",
        "teacher_day_load_cardinality",
        "teacher_max_consecutive_class_hours",
        "compound",
        "generic",
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
    "ruleKind",
    "interpretation",
    "semanticGuidance",
    "formalCoverage",
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



function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async (request) => {
  try {
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const body = await request.json();
    const rules = Array.isArray(body?.rules) ? body.rules : [];
    const schoolData = body?.schoolData || {};

    if (rules.length === 0) {
      return jsonResponse({ error: "At least one rule is required" }, 400);
    }

    const entities = compactEntities(schoolData);
    const model = "gpt-5.2";

    const instructions = `
אתה Rule Compiler v6.3-objectives-universe-contract עבור מערכת שעות בית ספרית.
נתח כל חוק בשפה טבעית וקבע את סוג היישום המתאים לו. כאשר החוק ניתן לבדיקה דטרמיניסטית בטוחה, תרגם אותו ל-Generic Rule Expression; כאשר הוא יעד השוואתי, אסטרטגיית חיפוש או הנחיה שאינה ניתנת לפורמליזציה מלאה, שמור אותו כהנחיה סמנטית שימושית ואל תכריח JSON פורמלי.
אל תפתור את מערכת השעות ואל תמציא IDs.

החזר כלל אחד לכל ruleId ובאותו סדר. originalText הוא מקור האמת.
השתמש רק ב-ENTITIES. נרמל ימים ל-א,ב,ג,ד,ה,ו.

קטגוריה:
- אם המשתמש כבר בחר category שאינו unspecified — שמור אותו.
- איסור/חובה מפורשים: אסור, אין לשבץ, חייב, חובה, צריך, יש לשבץ, רק => critical.
- מומלץ/רצוי/עדיף/כדאי/ככל האפשר => recommended.
- אחרת unspecified.

סוג היישום (ruleKind) — זה נפרד מהקטגוריה:
- hard_constraint: תנאי על מערכת סופית שחייב/אמור להתקיים וניתן לבדוק על schedule יחיד.
- soft_preference: העדפה על צורת המערכת הסופית. אם ניתן למדוד אותה עם ה-DSL, formalize אותה גם אם severity=recommended. required_slots יכול לשמש גם כהעדפה כאשר severity=recommended; במקרה כזה כל requirement חסר הוא penalty ולא פסילת מערכת.
- comparison_objective: יעד שמדרג Candidate ביחס ל-baseline/מערכת קודמת, למשל מינימום שינויים או לא להוסיף שעות שישיות.
- search_strategy: הנחיה על סדר/עלות פעולות החיפוש, למשל להזיז קודם שיעורים רגילים ורק אחר כך קבוצות.
- semantic_guidance: הנחיה שימושית לסוכן שאינה נכנסת היטב לאחד הסוגים האחרים.

חשוב:
- אין חובה שכל כלל יהפוך ל-Formal Rule JSON.
- semantic_only הוא תוצאה תקינה ומכוונת, לא כישלון.
- partially_formalized: השתמש כאשר חלק מהמשמעות ניתן לבדיקה דטרמיניסטית וחלק אחר ברור סמנטית אך אינו ניתן לייצוג מלא ב-DSL. במקרה כזה formalRuleJson חייב להכיל רק את החלק שנבדק בפועל, evaluatorKey="generic", ו-formalCoverage חייב להסביר במדויק מה מכוסה ומה נשאר סמנטי.
- formalized מותר רק אם Formal Rule מייצג את מלוא המשמעות המהותית של החוק. אל תסמן formalized אם נשאר רכיב חשוב שאינו נבדק.
- אם המשמעות ברורה אבל אין primitive מתאים כלל, החזר semantic_only, evaluatorKey=unsupported, ruleKind מתאים, ו-semanticGuidance מפורט ושימושי לסוכן.
- אם מדובר ב-comparison_objective או search_strategy, בדרך כלל semantic_only הוא נכון עד שיהיה מנוע objectives ייעודי.
- needs_clarification שמור רק למצב שבו המשמעות עצמה אינה ברורה מספיק; אל תשתמש בו רק בגלל מגבלת DSL.
- semanticGuidance תמיד יכיל ניסוח אופרטיבי קצר שהסוכן יוכל להשתמש בו גם בלי Formal Rule.
- formalCoverage תמיד נדרש:
  * formalized => covered="מלוא החוק", semanticOnly=""
  * partially_formalized => תאר במפורש את שני החלקים
  * semantic_only/needs_clarification => covered="", semanticOnly=החלק שאינו פורמלי/העמום.

ה-IR החדש הוא JSON עם:
{
  "version": 4,
  "severity": "critical|known_constraint|recommended|unspecified",
  "expression": <EXPRESSION>
}

סוגי EXPRESSION כלליים:
1. every_placement
{
 "type":"every_placement",
 "source":"placements",
 "filters":[FILTER...],
 "exclude":[FILTER...],
 "assertions":[{"field":"day|hour|className|grade|teacherId|constraintGroupId|subject|unitType|groupKind|activityKind|isInstructionalPlacement|isHomeroomTeacher|homeroomClassName|isHomeroomForClass|teacherActivityStartHour|teacherActivityEndHour|teacherActivitySlotIndex|teacherActivitySlotFromEnd|isTeacherActivityFirstSlot|isTeacherActivityLastSlot|classActivityStartHour|classActivityEndHour|classActivitySlotIndex|classActivitySlotFromEnd|isClassActivityFirstSlot|isClassActivityLastSlot|teacherStartHour|teacherEndHour|teacherTeachingSlotIndex|teacherTeachingSlotFromEnd|isTeacherFirstTeachingSlot|isTeacherLastTeachingSlot|classStartHour|classEndHour|classTeachingSlotIndex|classTeachingSlotFromEnd|isClassFirstTeachingSlot|isClassLastTeachingSlot","op":"eq|neq|lt|lte|gt|gte|in|not_in","value":...}],
 "predicate": PREDICATE | null
}
PREDICATE (אופציונלי; נבדק על כל placement בנפרד):
{"type":"condition","field":"day|hour|className|grade|teacherId|constraintGroupId|constraintGroupName|subject|unitType|isHomeroomForClass|count|startHour|gapCount","op":"eq|neq|lt|lte|gt|gte|in|not_in","value":...}
או {"type":"and|or","children":[PREDICATE,...]} או {"type":"not","child":PREDICATE}

2. aggregate
{
 "type":"aggregate",
 "source":"placements",
 "filters":[FILTER...],
 "exclude":[FILTER...],
 "groupBy":["day","teacherId","className","grade","constraintGroupId"...],
 "metric":{"type":"count|field_value|count_distinct|all_equal|common_value|count_where|value|min|max|start_hour|end_hour|distinct_hours|max_consecutive_hours|max_consecutive_gap_hours|gap_count","field":"hour|count|startHour|endHour|gapCount|maxConsecutiveHours|maxConsecutiveGapHours|...","where":FILTER},
 "assert":{"op":"eq|neq|lt|lte|gt|gte|in|not_in","value":...}
}

3. class_end_hour
{
 "type":"class_end_hour",
 "source":"student_classes",
 "filters":[FILTER...],
 "exclude":[FILTER...],
 "days":["א"...],
 "assert":{"op":"eq|lte|gte|all_equal|...","value":5}
}

4. required_slots
{
 "type":"required_slots",
 "requirements":[
   {"day":"ב","hour":5,"className":"ו1","teacherId":"19","constraintGroupId":null}
 ]
}

5. and
{"type":"and","children":[EXPRESSION,...]}

6. conditional — WHEN/IF expression THEN expression
{
 "type":"conditional",
 "when": EXPRESSION,
 "bind":["teacherId","className","day"...],
 "then": EXPRESSION
}
ה-when חייב להיות EXPRESSION מלא עם type. עבור תנאי כמותי/אגרגטיבי השתמש ב-aggregate, למשל count_distinct(hour)>2 לפי teacherId+className+day. אין להשתמש במבנה ישן של when={source,filters,assertions} בלי type; הוא אינו חוקי.

7. coverage
{"type":"coverage","source":"placements","filters":[FILTER...],"exclude":[FILTER...],"groupBy":["teacherId","day"...],"match":PREDICATE,"metric":"ratio|count","assert":{"op":"eq|gte|lte|...","value":1}}

8. objective — יעד אופטימיזציה מדיד על מערכת יחידה
{
 "type":"objective",
 "direction":"minimize|maximize",
 "source":"placements|teacher_teaching_days|teacher_activity_days|class_teaching_days|class_activity_days|...",
 "filters":[FILTER...],
 "exclude":[FILTER...],
 "groupBy":["teacherId","day"...],
 "metric":{"type":"count|count_distinct|field_value|min|max|...","field":"hour|day|count|startHour|..."},
 "reduce":"sum|avg|min|max|count_groups"
}

objective אינו assert בינארי. הוא מודד objectiveValue כדי להשוות פתרונות. השתמש בו כאשר הניסוח הוא "למזער/למקסם/כמה שיותר/כמה שפחות" ויש מדד מוחלט שניתן לחשב על מערכת אחת. יעד שתלוי ב-baseline קודם נשאר comparison_objective סמנטי עד שיש מקור baseline מפורש.

9. aggregate_pipeline — אגרגציה רב-שלבית על תוצאות אגרגציה קודמת
{
 "type":"aggregate_pipeline",
 "source":"grade_days|teacher_days|teacher_activity_days|teacher_teaching_days|class_days|class_activity_days|class_teaching_days|placements",
 "filters":[FILTER...],
 "exclude":[FILTER...],
 "stages":[
   {"groupBy":["day"],"metrics":[{"as":"commonEndHour","type":"common_value","field":"endHour"}]},
   {"groupBy":[],"metrics":[
      {"as":"daysAt6","type":"count_where","field":"commonEndHour","where":{"field":"commonEndHour","op":"eq","value":6}},
      {"as":"daysAt5","type":"count_where","field":"commonEndHour","where":{"field":"commonEndHour","op":"eq","value":5}}
   ]}
 ],
 "assertions":[{"field":"daysAt6","op":"eq","value":2},{"field":"daysAt5","op":"eq","value":1}]
}

FILTER:
{"field":"day|hour|className|grade|teacherId|constraintGroupId|constraintGroupName|subject|unitType|groupKind|activityKind|isInstructionalPlacement|isHomeroomTeacher|homeroomClassName|isHomeroomForClass|teacherActivityStartHour|teacherActivityEndHour|teacherActivitySlotIndex|teacherActivitySlotFromEnd|isTeacherActivityFirstSlot|isTeacherActivityLastSlot|classActivityStartHour|classActivityEndHour|classActivitySlotIndex|classActivitySlotFromEnd|isClassActivityFirstSlot|isClassActivityLastSlot|teacherStartHour|teacherEndHour|teacherTeachingSlotIndex|teacherTeachingSlotFromEnd|isTeacherFirstTeachingSlot|isTeacherLastTeachingSlot|classStartHour|classEndHour|classTeachingSlotIndex|classTeachingSlotFromEnd|isClassFirstTeachingSlot|isClassLastTeachingSlot|count|startHour|endHour|gapCount|maxConsecutiveHours|maxConsecutiveGapHours","op":"eq|neq|lt|lte|gt|gte|in|not_in","value":...}

כללים:
- בחר expression כללי ולא evaluator ייעודי.
- חוק פשוט שמגביל כל שיבוץ לפי יום/שעה => every_placement.
- תנאי משולב על אותו שיבוץ חייב לשמור על הלוגיקה של הצירוף. למשל "אסור למורה 25 ביום ג בשעות 1 או 2" פירושו רק NOT(day=ג AND hour IN [1,2]). הדרך הפשוטה המועדפת: every_placement עם filters teacherId=25 וגם day=ג, ואז assertion hour not_in [1,2]. אסור לתרגם זאת ל-day neq ג וגם hour not_in [1,2], כי זה אוסר בטעות שעות 1-2 גם בימים אחרים. כאשר אי אפשר לבטא antecedent פשוט באמצעות filters, השתמש predicate עם and/or/not.
- חישוב על אוסף שיבוצים => aggregate.
- שעת סיום קבועה של כיתות => class_end_hour.
- "כל הכיתות בשכבה מסיימות באותה שעה" => class_end_hour עם assert.op="all_equal" (לא eq 1!).
- דפוסים על ימים, כולל יום חופשי, מספר שעות, התחלה, רצף או חלונות => teacher_days/class_days + aggregate.
- ב-source teacher_days, השדה count הוא כבר מספר שעות-מערכת ייחודיות שבהן המורה עובד באותו יום (distinct timetable hour slots), ולא מספר רשומות placement. כמה יחידות/קבוצות של אותו מורה באותה שעה נספרות כשעה אחת.
- חשוב: כאשר החוק מנוסח על teacher_days ("ביום ב 6 שעות", "יום אחד עם 6 ושני ימים עם 5", "אין חלונות"), השתמש ישירות בשדות count/startHour/gapCount/maxConsecutiveHours. אל תנסה להחליף teacher_days.count ב-count_distinct(hour), כי teacher_days אינו source של placements והשדה count כבר מחושב מראש.
- rawPlacementCount קיים רק לצורכי אבחון ואינו מייצג את מספר שעות העבודה של המורה.
- כדי לספור כמה ימים מקיימים תנאי, השתמש aggregate על teacher_days/class_days עם metric count_where.
- כאשר החוק מדבר על עצם קיומה של שעה מסוימת (למשל "למורה לא יהיו יותר מפעמיים בשבוע שעה שישית"), אסור להשתמש ב-endHour. endHour=6 פירושו שהיום מסתיים ב-6, ולכן מפספס יום שבו המורה עובד גם בשעה 6 וגם בשעה 7. הדרך המועדפת: source=placements, filter hour=6, groupBy teacherId, metric count_distinct field=day. metric.where נתמך גם הוא ב-count_distinct, אך filter חיצוני עדיף כאשר כל המדד עוסק רק בשעה המסוימת. כמה placements של אותו מורה באותה שעה/יום עדיין נספרים כיום אחד.
- הבחנה חשובה בחלונות: gapCount הוא המספר הכולל של שעות פנויות פנימיות ביום, בלי קשר אם הן רצופות. maxConsecutiveGapHours הוא אורך הרצף הארוך ביותר של שעות חלון רצופות בין שני שיעורים. לכן חוק "להימנע משתי שעות חלון רצופות או יותר" חייב להשתמש ב-maxConsecutiveGapHours<=1, ולא ב-gapCount<=1. לדוגמה חלונות נפרדים בשעות 2 ו-5 נותנים gapCount=2 אבל maxConsecutiveGapHours=1 ולכן אינם מפרים את החוק.
- כאשר סופרים "שעות הוראה" מתוך placements, ברירת המחדל היא count_distinct field=hour ולא count, כדי שקבוצה/פיצול שיוצרים כמה records באותה שעה לא ייספרו כשעות נפרדות.
- מורה שאינו מחנך הכיתה המסוימת: placements filter isHomeroomForClass eq false; groupBy teacherId,className,day; metric count_distinct field=hour.
- ניסוחים כגון "לצמצם", "למזער", "כמה שפחות", "מינימום", "עד כמה שניתן" אינם מתירים להמציא יעד מספרי 0.
- עם זאת, recommended/soft_preference אינו אומר "לא פורמלי". אם בטקסט קיים תנאי מדיד וברור, מותר ואף רצוי ל-formalize אותו כדי שהמערכת תוכל למדוד חריגות, גם אם הוא רק המלצה. severity יישאר recommended והפרה אינה הופכת את המערכת לבלתי חוקית.
- דוגמאות להעדפות מדידות שניתן formalize:
  * "השתדל להימנע מאנגלית בשעה 1 או 6" => every_placement/aggregate מדיד על placements של אנגלית בשעות 1/6. אפשר לייצג את מצב היעד (אין placements כאלה) ולפרש violations כ-penalty של recommended, לא כ-hard failure.
  * "הימנע ככל שניתן מלשבץ מורה 18 ביום ה" => every_placement עבור teacherId=18 עם day neq ה, severity=recommended.
  * "נסה להימנע מיותר מפעמיים בשבוע שעה שישית" => יש סף מפורש ≤2, ולכן formalize על placements hour=6, groupBy teacherId, metric count_distinct day, assert lte 2, severity=recommended.
- לעומת זאת, אם יש רק יעד יחסי ללא סף/מצב יעד מוגדר, למשל "לצמצם ככל הניתן את מספר השעות השישיות למורות 5 ו-41", אל תמציא <=0; השאר semantic_only/comparison objective.
- אם החוק אומר "בכיתה" ומחריג ישיבות צוות, בצע semantic entity resolution מול ENTITIES.constraintGroups: זהה לפי שמות הקבוצות אילו קבוצות מייצגות בבירור ישיבת/צוות/הדרכת צוות, והחרג את ה-constraintGroupId שלהן. אין צורך בהתאמה מילולית מדויקת למונח שבחוק. אם יש קבוצות שמן הסתם אינן ישיבות צוות, אל תחריג אותן. בקש clarification רק אם קיימת קבוצה ששמה/תפקידה באמת דו-משמעי ומשנה את תוצאת החוק.
- חוק "אסור למורה ללמד בכיתה 7 שעות רצופות; ישיבות צוות אינן נחשבות" ניתן לבטא כ-aggregate על placements לאחר exclude של IDs שזוהו סמנטית כישיבות צוות, groupBy teacherId,day, metric max_consecutive_hours field=hour, assert lte 6. לכן אל תחזיר needs_clarification רק משום שהטקסט לא מנה את שמות קבוצות הצוות, אם ENTITIES.constraintGroups מאפשר לזהות אותן בביטחון סביר.
- דרישה שמורה/קבוצה יהיו בתא מסוים => required_slots.
- אם החוק עצמו מונה במפורש רשימת כיתות/מורים/קבוצות שאליהן הדרישה חלה, אל תרחיב את ה-scope לישויות נוספות רק בגלל שם השכבה/הקטגוריה. למשל אם המשתמש כתב "בשכבת ו" ואז מנה במפורש ו1/ו2/ו4/ו5 והמחנכים שלהן, יש להתייחס לרשימה המפורשת כמקור האמת ולא להמציא דרישה לגבי ו3. במקרה כזה, אם כל הרשימה המפורשת כוסתה, formalCoverage.semanticOnly חייב להיות ריק והסטטוס formalized.
- כמה תנאים יחד => and.
- מנגנון מיקום-בזמן גנרי על source=placements: hour היא שעה מוחלטת; teacherTeachingSlotIndex הוא מספר השיעור שהמורה מלמד באותו יום (1=הראשון); teacherTeachingSlotFromEnd הוא המיקום מסוף יום ההוראה (1=האחרון); isTeacherFirstTeachingSlot/isTeacherLastTeachingSlot הם קיצורי boolean; teacherStartHour/teacherEndHour הם שעות ההתחלה/סיום המוחלטות. קיימים שדות מקבילים לכיתה: classTeachingSlotIndex, classTeachingSlotFromEnd, isClassFirstTeachingSlot, isClassLastTeachingSlot, classStartHour, classEndHour.
- השתמש במנגנון הזה באופן כללי ולא ב-primitive ייעודי לכל ניסוח. הבחנה קריטית: "בשעה השנייה" => hour=2; "בשיעור השני שלו" => teacherTeachingSlotIndex=2; "בשעה האחרונה שלו" => isTeacherLastTeachingSlot=true; "בשעה האחרונה של הכיתה" => isClassLastTeachingSlot=true.
- עיקרון גנרי: filters בוחרים את אוכלוסיית המקרים שעליהם החוק חל; assertions/predicate בודקים מה צריך להיות נכון באותם מקרים. אל תכניס ל-filter את התוצאה שאותה אתה רוצה לבדוק, כי אז החוק הופך לטאוטולוגיה.
- every_placement חייב לכלול assertion אחד לפחות או predicate אמיתי. assertions=[] עם predicate=null הוא ביטוי ריק ואסור להחזירו כ-formalized.
- איסור על ערך מסוים לכל שיבוצי ישות נכתב בדרך כלל באמצעות assertion הפוכה. למשל "למורה X אסור ללמד בשעה 1" => filter teacherId=X, assertion hour neq 1. "מותר רק בימים ג/ה" => assertion day in [ג,ה]. אין צורך ב-count=0 כאשר אפשר לאסור את הערך ישירות.
- שדות תפקיד כלליים זמינים על placements: isHomeroomTeacher אומר שלמורה יש כיתת אם; homeroomClassName היא כיתת האם שלו; isHomeroomForClass אומר שה-placement הנוכחי הוא בכיתת האם שלו.
- סיווג פעילות גנרי: activityKind הוא instructional|meeting|duty|support|other, ו-isInstructionalPlacement מציין אם זו הוראה. metadata מפורש unit.activityKind/group.activityKind גובר על fallback מבני. אין להסיק סוג פעילות משם המקצוע בלבד.
- הבחנה בין פעילות להוראה: teacherActivitySlotIndex/FromEnd ו-isTeacherActivityFirstSlot/LastSlot כוללים כל פעילות; teacherTeachingSlotIndex/FromEnd ו-isTeacherFirstTeachingSlot/LastTeachingSlot כוללים רק הוראה. קיימים שדות מקבילים לכיתה.
- כאשר הניסוח אומר "השיעור הראשון/האחרון שהמורה מלמד", השתמש ב-TeachingSlot. כאשר הוא אומר "הפעילות/השיבוץ הראשון/האחרון", השתמש ב-ActivitySlot. ישיבה אינה שיעור ראשון.
- אותה הבחנה חלה על סיכומי יום: teacher_teaching_days/class_teaching_days כוללים רק הוראה; teacher_activity_days/class_activity_days כוללים את כל הפעילויות. "חלונות בין שיעורים", "כמה שעות לימד", "שעות הוראה רצופות" => teaching_days. "יום עבודה", "נוכחות", "פעילויות" => activity_days.
- teacher_days ו-class_days נשמרו רק לתאימות לאחור. בחוק חדש אל תשתמש בהם כאשר ניתן לבחור universe מפורש. בחר תמיד teaching_days או activity_days לפי משמעות הטקסט.
- "יום חופשי/לא עובד כלל/נוכחות בבית הספר" => teacher_activity_days. "שעות הוראה/מלמד/חלונות בין שיעורים/שיעור ראשון" => teacher_teaching_days.
- כאשר חוק אומר במפורש "מלמד/שיעורים/שעות הוראה", העדף isInstructionalPlacement=true או *_teaching_days. אל תפתור "ישיבות אינן נחשבות" באמצעות רשימת constraintGroupId של כל הישיבות אם isInstructionalPlacement כבר מבטא זאת.
- דוגמה: "אסור שמורה ילמד בכיתה 7 שעות רצופות; ישיבות אינן נחשבות" => aggregate placements עם filter isInstructionalPlacement=true, groupBy teacherId,className,day, metric max_consecutive_hours(hour), assert lte 6. אין צורך ב-exclude של IDs.
- "למורה יותר מפעמיים בשבוע שעה שישית" כאשר הכוונה לשעת הוראה => filter isInstructionalPlacement=true וגם hour=6 לפני count_distinct(day).
- "חלונות בין שיעורים" => teacher_teaching_days. "שעות מתות בין כל הפעילויות בבית הספר" => teacher_activity_days. אל תשתמש ב-teacher_days הישן כאשר הניסוח מבחין בין שני ה-universes.
- conditional הוא primitive גנרי ל"אם/כאשר ... אז ..."; אל תמחק את תנאי ה-IF ותבדוק רק את התוצאה. ה-when הוא EXPRESSION מלא. כאשר ה-IF אומר "יותר מ-N שעות/ימים/מופעים", ה-when חייב להיות aggregate/coverage שמחשב את הכמות בקיבוץ הנכון, לא placements בודדים עם assertion על שדה count שאינו קיים בהם.
- bind מעביר את מפתחות הקבוצה שנמצאה ב-WHEN אל ה-THEN כ-filters. לכן אם ה-WHEN groupBy=[teacherId,className,day], השתמש bind באותם שדות כדי שה-THEN ייבדק בדיוק על אותה קבוצה.
- coverage הוא primitive גנרי ל"כל היום", "רוב", "כמה שיותר" ויעדי יחס/כיסוי כאשר האוכלוסייה וה-match מדידים.
- objective הוא primitive גנרי ליעדי minimize/maximize שאין להם סף. אל תהפוך "כמה שיותר" ל-assert מלאכותי ואל תשאיר יעד מדיד כ-semantic_only אם אפשר לחשב metric מוחלט על מערכת יחידה.
- דוגמה: "מורה 11 יתחיל בשעה 2 בכמה שיותר ימים" => objective direction=maximize, source=teacher_teaching_days, filters teacherId=11 + count>0 + startHour=2, groupBy=[], metric=count, reduce=sum.
- דוגמה: "למזער ימים עם שעה 6 למורים 5 ו-41" => objective direction=minimize, source=placements, filters isInstructionalPlacement=true + teacherId in [5,41] + hour=6, groupBy=[teacherId], metric=count_distinct field=day, reduce=sum.
- לעומת זאת "מינימום החלפות לעומת מערכת הבסיס" או "לא להוסיף שעה 6 ביחס לבייסליין" דורשים השוואת baseline ולכן נשארים comparison_objective סמנטיים עד שה-DSL יקבל baseline source.
- אם חלק מהחוק מדיד וחלק אחר עמום/לא נתמך, ברירת המחדל היא partially_formalized: פרמל את החלק הבטוח והעבר רק את היתרה ל-semanticOnly. needs_clarification שמור למצב שבו גם החלק הנדרש לביצוע אינו חד-משמעי.
- יעד "N פעמים בשבוע" הוא חלק מדיד: פרמל אותו באמצעות aggregate/count גם אם הוראת "בשאר הימים" נשארת סמנטית.
- שמור על כיוון לוגי: filters מגדירים את אוכלוסיית היעד; assertions/predicate/match מגדירים את התוצאה. לדוגמה "בקבוצות אנגלית הימנע משעות 1 ו-6" => קבוצות האנגלית ב-filters ו-hour not_in [1,6] ב-assertion. אין להפוך את קבוצות היעד ל-not_in predicate.
- resolve שמות מורים/קבוצות ל-IDs מתוך ENTITIES.
- "כל קבוצות פרשת שבוע" => filters constraintGroupId in [כל IDs של קבוצות פרשת שבוע].
- "כל הכיתות" מתייחס אך ורק לכיתות-אם שב-ENTITIES.homerooms (className), לא לכל ENTITIES.classes; ישיבות/הדרכות/צוותים אינן כיתות תלמידים.
- חריגים כגון "מלבד א3 וב3" => exclude.
- מחנך בכיתתו: השתמש ב-ENTITIES.homerooms ובנה requirements מפורשים.
- אל תבקש הבהרה על מיפוי מחנכים אם ENTITIES.homerooms מספק אותו.
- הביטוי "בשעתיים הראשונות לפחות" בהקשר של נוכחות מחנך פירושו חובה בשעה 1 וגם בשעה 2; בנה required_slots לשני התאים לכל כיתה רלוונטית, לא "לפחות אחת".
- אם אפשר לבטא את החוק בעזרת השפה הזאת, formalizationStatus חייב להיות formalized ו-evaluatorKey="generic".
- semantic_only רק אם נדרש primitive שאינו קיים ב-DSL.
- needs_clarification רק אם חסר מידע מהותי שאינו בטקסט או ENTITIES.

- "אם מורה שאינו מחנך מלמד יותר משעתיים בכיתה ביום מסוים, השתדל שהשעות לא יהיו רצופות" => conditional שבו when הוא aggregate source=placements, filters isInstructionalPlacement=true + isHomeroomForClass=false, groupBy=[teacherId,className,day], metric=count_distinct field=hour, assert gt 2; bind=[teacherId,className,day]; then הוא aggregate source=placements, filters isInstructionalPlacement=true + isHomeroomForClass=false, groupBy=[teacherId,className,day], metric=max_consecutive_hours field=hour, assert lte 2.
- "מחנך יהיה ביום שישי כל היום בכיתת האם" כהעדפה => coverage על placements לימודיים של מחנכים ביום ו', groupBy teacherId, match isHomeroomForClass=true, ratio יעד 1. אם נשארת עמימות משנית, partial ולא clarification מלא.
- חוק עם "מורה X בכיתה Y בשעה 7 פעמיים בשבוע" + הוראה עמומה ל"שאר הימים" => aggregate count לחלק הראשון ו-semanticOnly רק לחלק השני.

דוגמאות:
"כל קבוצות פרשת השבוע חייבות להתקיים ביום שלישי"
=> every_placement, filter constraintGroupId in [IDs], assertion day in ["ג"].

"בימי שני כל הכיתות מסיימות בשעה החמישית מלבד א3 וב3"
=> class_end_hour, exclude className in ["א3","ב3"], days=["ב"], assert eq 5.

"ביום שני בשעה 5 בכיתות ו1/ו2/... המחנך חייב להיות בכיתתו"
=> required_slots עם requirement לכל className + teacherId המתאים.

"אין לשבץ ספריה לאחר השעה השישית"
=> every_placement, filter constraintGroupId in [IDs של ספריה], assertion hour lte 6.


דוגמאות נוספות חשובות:
- "אין לכיתה חור באמצע או בתחילת היום" => AND של aggregate על class_days: metric gap_count assert eq 0; ובנפרד aggregate על class_days עם filter count gt 0, metric field_value field=startHour, assert eq 1. אין להשתמש startHour in [0,1] עבור ימי לימודים: 0 מותר רק לרשומת יום ריקה ולכן יש לסנן count>0.
- "לא-מחנך מקסימום 3 שעות באותה כיתה ביום" => aggregate placements, filter isHomeroomForClass eq false, groupBy teacherId,className,day, metric count_distinct field=hour, assert lte 3. isHomeroomForClass הוא שדה נתמך ומחושב מהמיפוי ENTITIES.homerooms; אין לבקש עליו הבהרה.
- "לא יהיו שתי קבוצות פרשת שבוע באותה שעה" => aggregate placements, filter קבוצות פרשת שבוע, groupBy day,hour, metric count_distinct field constraintGroupId, assert lte 1. לעולם אל תשתמש count כאן כי קבוצה אחת יכולה ליצור כמה placements.
- יום חופשי אחד בדיוק מתוך ג/ד/ה => aggregate source teacher_activity_days, filter teacherId והימים, metric count_where where field=count op=eq value=0, assert eq 1.
- חוק כגון "בג/ד/ה בדיוק שני ימים שכבות ד+ה מסיימות ב-6 ויום אחד ב-5, אותם ימים לשתי השכבות" => aggregate_pipeline על grade_days: סנן grades=[ד,ה], days=[ג,ד,ה]; stage ראשון groupBy day עם common_value(endHour) בשם commonEndHour (אם שתי השכבות אינן שוות מתקבל null); stage שני groupBy [] עם count_where commonEndHour=6 בשם daysAt6 ו-count_where commonEndHour=5 בשם daysAt5; assertions daysAt6=2 וגם daysAt5=1. זה מבטיח גם שאותם ימים משותפים לשתי השכבות.
- התפלגות שעות הוראה (למשל יום אחד 6 שעות ושני ימים 5) => AND של aggregate source teacher_teaching_days עם count_where על count=6 / count=5, ובנפרד aggregate לבדיקת startHour=1 ו-gapCount=0.
- הבחנה קריטית בין count לבין field_value: metric type=count סופר כמה רשומות יש בקבוצה. כאשר source הוא teacher_teaching_days/teacher_activity_days/class_teaching_days/class_activity_days והשדה count כבר מכיל את מספר שעות העבודה/הלימוד של היום, כדי לבדוק את ערך השדה עצמו השתמש metric type=field_value field=count. לדוגמה "ביום ב המורה עובד 6 שעות" => teacher_days, filter day=ב, groupBy day, metric field_value field=count, assert eq 6. לעולם אל תשתמש metric count field=count למטרה זו. count_where על field=count נשאר תקין לצורך ספירת ימים שבהם count=5/6.
- "למורה X אסור שיהיו חלונות" הוא תמיד formalizable: aggregate source teacher_days, filter teacherId של X, groupBy day, metric gap_count field=gapCount, assert eq 0. אין להחזיר semantic_only עבור ניסוח זה.
- "יש להימנע משתי שעות חלון רצופות או יותר, למעט מורה X" הוא formalizable כהעדפה: aggregate source=teacher_days, filter count>0, exclude teacherId=X, groupBy teacherId,day, metric field_value field=maxConsecutiveGapHours, assert lte 1, severity=recommended. אין להשתמש ב-gapCount עבור "רצופות".
- "ככל שניתן, אם למורה יש חלונות עדיף שהם יהיו בימים שבהם הוא מלמד עד שעה שישית" הוא soft_preference formalizable: aggregate source=teacher_days, filters gapCount>0 וגם count>0, groupBy teacherId,day, metric field_value field=endHour, assert lte 6, severity=recommended. כל יום עם חלון שמסתיים אחרי שעה 6 הוא violation/penalty.
- "יש עדיפות שמחנך יתחיל את היום בכיתתו; תן עדיפות מיוחדת למורה 33" הוא partially_formalized: החלק הכללי יהיה every_placement על source=placements עם filters isHomeroomTeacher=true וגם isTeacherFirstTeachingSlot=true, ואז assertion isHomeroomForClass=true. severity=recommended. יום שבו המחנך אינו עובד אינו יוצר placement ולכן אינו יוצר penalty. אסור לסנן מראש isHomeroomForClass=true כי זו בדיוק התוצאה הנבדקת. החלק "עדיפות מיוחדת למורה 33" נשאר semanticOnly כי אין עדיין משקל שונה.
- "עדיף שמורה X ילמד בכל יום עבודה בשעה השנייה" עוסק ב-hour=2 (שעה מוחלטת), לא teacherTeachingSlotIndex=2.
- "עדיף שהשיעור האחרון של מורה X יהיה בכיתה Y" => teacherId=X + isTeacherLastTeachingSlot=true, assert className=Y.
- "עדיף שהשיעור השני שמורה X מלמד בכל יום יהיה מקצוע Y" => teacherId=X + teacherTeachingSlotIndex=2, assert subject=Y.
- "מורה X מלמד רק בימים ג/ה ואסור לו ללמד בשעה הראשונה" => AND של שני every_placement: (1) filter teacherId=X, assertion day in [ג,ה]; (2) filter teacherId=X, assertion hour neq 1. זה formalized מלא.
- פישוט לוגי מחייב: אם חוק דורש startHour=1 וגם gapCount=0 וגם count=N, שלושת התנאים כבר מוכיחים N שעות רצופות החל משעה 1. אין לבקש primitive מותנה נוסף ואין צורך לבדוק max_consecutive_hours=N. בפרט חוק כמו "יום אחד 6 שעות רצופות ושני ימים 5 שעות רצופות, בכל הימים מתחיל בשעה 1 וללא חלונות" ניתן לפמלל במלואו באמצעות count distribution + startHour=1 + gapCount=0, ולכן formalizationStatus=formalized ולא needs_clarification.
דוגמת יום חופשי — חוק כמו "למורה X בדיוק יום חופשי אחד מתוך ג/ד/ה" ניתן לפורמליזציה מלאה:
aggregate source=teacher_days, filter teacherId=X + day in [ג,ד,ה], groupBy=[teacherId],
metric=count_where field=count where count eq 0, assert eq 1.
אין צורך להוסיף תנאי נפרד לשני הימים האחרים אלא אם הניסוח דורש במפורש עבודה בהם.

דוגמת חוק מורכב על teacher_days — "למורה X אין חלונות; ביום ב 6 שעות מהשעה 1; מתוך ג/ד/ה יום אחד 6 שעות ושני ימים 5, וכולם מתחילים בשעה 1":
השתמש AND של:
1) aggregate teacher_days teacherId=X, count>0, groupBy teacherId,day, metric gap_count/gapCount assert eq 0
2) ביום ב: field_value count eq 6 וגם field_value startHour eq 1
3) על ג/ד/ה: count_where על field=count כדי לספור יום אחד count=6 ושני ימים count=5, ובנפרד startHour eq 1 לכל יום עובד.
זהו חוק formalized מלא; teacher_days.count כבר שעות ייחודיות ואין להשתמש כאן ב-count_distinct(hour).

לכל formalized או partially_formalized החזר formalRuleJson כמחרוזת JSON תקינה של מבנה version=4.
חוזה יציבות: בנה קודם אובייקט JSON פנימי תקין ורק לבסוף בצע לו JSON.stringify פעם אחת. אל תכתוב את המחרוזת ידנית, אל תוסיף markdown, comments, trailing commas או undefined. שמור שמות שדות וערכי enum בדיוק לפי ה-DSL.
כאשר הביטוי מורכב, העדף קומפוזיציה של primitives קיימים (and/aggregate/conditional) על פני טקסט חופשי בתוך formalRuleJson.
evaluatorKey יהיה "generic" כאשר קיים formalRuleJson, אחרת "unsupported".
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
      background: true,
      instructions,
      text: {
        format: {
          type: "json_schema",
          name: "timetable_rule_compiler_v4_5_generic_async",
          strict: true,
          schema: responseSchema,
        },
      },
      input: `RULE_COMPILER_INPUT=${JSON.stringify(inputPayload)}`,
    });

    return jsonResponse({
      success: true,
      phase: "rule-compiler-started",
      responseId: response.id,
      status: response.status || "queued",
      ruleCount: rules.length,
    });
  } catch (error) {
    console.error("Async Rule Compiler start failed:", error);
    return jsonResponse(
      {
        success: false,
        error: error?.message || "Unknown Rule Compiler start error",
      },
      500,
    );
  }
};
