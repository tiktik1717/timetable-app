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
אתה Rule Compiler v4.5 עבור מערכת שעות בית ספרית.
תרגם כל חוק בשפה טבעית לביטוי דטרמיניסטי כללי (Generic Rule Expression).
אל תפתור את מערכת השעות ואל תמציא IDs.

החזר כלל אחד לכל ruleId ובאותו סדר. originalText הוא מקור האמת.
השתמש רק ב-ENTITIES. נרמל ימים ל-א,ב,ג,ד,ה,ו.

קטגוריה:
- אם המשתמש כבר בחר category שאינו unspecified — שמור אותו.
- איסור/חובה מפורשים: אסור, אין לשבץ, חייב, חובה, צריך, יש לשבץ, רק => critical.
- מומלץ/רצוי/עדיף/כדאי/ככל האפשר => recommended.
- אחרת unspecified.

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
 "assertions":[{"field":"day|hour|className|grade|teacherId|constraintGroupId|subject|unitType|isHomeroomForClass","op":"eq|neq|lt|lte|gt|gte|in|not_in","value":...}],
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
 "metric":{"type":"count|field_value|count_distinct|all_equal|common_value|count_where|value|min|max|start_hour|end_hour|distinct_hours|max_consecutive_hours|gap_count","field":"hour|...","where":FILTER},
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

6. aggregate_pipeline — אגרגציה רב-שלבית על תוצאות אגרגציה קודמת
{
 "type":"aggregate_pipeline",
 "source":"grade_days|teacher_days|class_days|placements",
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
{"field":"day|hour|className|grade|teacherId|constraintGroupId|constraintGroupName|subject|unitType|isHomeroomForClass|count|startHour|endHour|gapCount|maxConsecutiveHours","op":"eq|neq|lt|lte|gt|gte|in|not_in","value":...}

כללים:
- בחר expression כללי ולא evaluator ייעודי.
- חוק פשוט שמגביל כל שיבוץ לפי יום/שעה => every_placement.
- תנאי משולב על אותו שיבוץ חייב לשמור על הלוגיקה של הצירוף. למשל "אסור למורה 25 ביום ג בשעות 1 או 2" פירושו רק NOT(day=ג AND hour IN [1,2]). הדרך הפשוטה המועדפת: every_placement עם filters teacherId=25 וגם day=ג, ואז assertion hour not_in [1,2]. אסור לתרגם זאת ל-day neq ג וגם hour not_in [1,2], כי זה אוסר בטעות שעות 1-2 גם בימים אחרים. כאשר אי אפשר לבטא antecedent פשוט באמצעות filters, השתמש predicate עם and/or/not.
- חישוב על אוסף שיבוצים => aggregate.
- שעת סיום קבועה של כיתות => class_end_hour.
- "כל הכיתות בשכבה מסיימות באותה שעה" => class_end_hour עם assert.op="all_equal" (לא eq 1!).
- דפוסים על ימים, כולל יום חופשי, מספר שעות, התחלה, רצף או חלונות => teacher_days/class_days + aggregate.
- ב-source teacher_days, השדה count הוא מספר שעות-מערכת ייחודיות שבהן המורה עובד באותו יום (distinct timetable hour slots), ולא מספר רשומות placement. כמה יחידות/קבוצות של אותו מורה באותה שעה נספרות כשעה אחת.
- rawPlacementCount קיים רק לצורכי אבחון ואינו מייצג את מספר שעות העבודה של המורה.
- כדי לספור כמה ימים מקיימים תנאי, השתמש aggregate על teacher_days/class_days עם metric count_where.
- מורה שאינו מחנך הכיתה המסוימת: placements filter isHomeroomForClass eq false; groupBy teacherId,className,day.
- אם החוק אומר "בכיתה" ומחריג ישיבות צוות, בצע semantic entity resolution מול ENTITIES.constraintGroups: זהה לפי שמות הקבוצות אילו קבוצות מייצגות בבירור ישיבת/צוות/הדרכת צוות, והחרג את ה-constraintGroupId שלהן. אין צורך בהתאמה מילולית מדויקת למונח שבחוק. אם יש קבוצות שמן הסתם אינן ישיבות צוות, אל תחריג אותן. בקש clarification רק אם קיימת קבוצה ששמה/תפקידה באמת דו-משמעי ומשנה את תוצאת החוק.
- חוק "אסור למורה ללמד בכיתה 7 שעות רצופות; ישיבות צוות אינן נחשבות" ניתן לבטא כ-aggregate על placements לאחר exclude של IDs שזוהו סמנטית כישיבות צוות, groupBy teacherId,day, metric max_consecutive_hours field=hour, assert lte 6. לכן אל תחזיר needs_clarification רק משום שהטקסט לא מנה את שמות קבוצות הצוות, אם ENTITIES.constraintGroups מאפשר לזהות אותן בביטחון סביר.
- דרישה שמורה/קבוצה יהיו בתא מסוים => required_slots.
- כמה תנאים יחד => and.
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
- "לא-מחנך מקסימום 3 שעות באותה כיתה ביום" => aggregate placements, filter isHomeroomForClass eq false, groupBy teacherId,className,day, metric count, assert lte 3. isHomeroomForClass הוא שדה נתמך ומחושב מהמיפוי ENTITIES.homerooms; אין לבקש עליו הבהרה.
- "לא יהיו שתי קבוצות פרשת שבוע באותה שעה" => aggregate placements, filter קבוצות פרשת שבוע, groupBy day,hour, metric count_distinct field constraintGroupId, assert lte 1. לעולם אל תשתמש count כאן כי קבוצה אחת יכולה ליצור כמה placements.
- יום חופשי אחד בדיוק מתוך ג/ד/ה => aggregate source teacher_days, filter teacherId והימים, metric count_where where field=count op=eq value=0, assert eq 1.
- חוק כגון "בג/ד/ה בדיוק שני ימים שכבות ד+ה מסיימות ב-6 ויום אחד ב-5, אותם ימים לשתי השכבות" => aggregate_pipeline על grade_days: סנן grades=[ד,ה], days=[ג,ד,ה]; stage ראשון groupBy day עם common_value(endHour) בשם commonEndHour (אם שתי השכבות אינן שוות מתקבל null); stage שני groupBy [] עם count_where commonEndHour=6 בשם daysAt6 ו-count_where commonEndHour=5 בשם daysAt5; assertions daysAt6=2 וגם daysAt5=1. זה מבטיח גם שאותם ימים משותפים לשתי השכבות.
- התפלגות ימי עבודה (למשל יום אחד 6 שעות ושני ימים 5) => AND של aggregate source teacher_days עם count_where על count=6 / count=5, ובנפרד aggregate לבדיקת startHour=1 ו-gapCount=0.
- הבחנה קריטית בין count לבין field_value: metric type=count סופר כמה רשומות יש בקבוצה. כאשר source הוא teacher_days/class_days והשדה count כבר מכיל את מספר שעות העבודה/הלימוד של היום, כדי לבדוק את ערך השדה עצמו השתמש metric type=field_value field=count. לדוגמה "ביום ב המורה עובד 6 שעות" => teacher_days, filter day=ב, groupBy day, metric field_value field=count, assert eq 6. לעולם אל תשתמש metric count field=count למטרה זו. count_where על field=count נשאר תקין לצורך ספירת ימים שבהם count=5/6.
- "למורה X אסור שיהיו חלונות" הוא תמיד formalizable: aggregate source teacher_days, filter teacherId של X, groupBy day, metric gap_count field=gapCount, assert eq 0. אין להחזיר semantic_only עבור ניסוח זה.
- פישוט לוגי מחייב: אם חוק דורש startHour=1 וגם gapCount=0 וגם count=N, שלושת התנאים כבר מוכיחים N שעות רצופות החל משעה 1. אין לבקש primitive מותנה נוסף ואין צורך לבדוק max_consecutive_hours=N. בפרט חוק כמו "יום אחד 6 שעות רצופות ושני ימים 5 שעות רצופות, בכל הימים מתחיל בשעה 1 וללא חלונות" ניתן לפמלל במלואו באמצעות count distribution + startHour=1 + gapCount=0, ולכן formalizationStatus=formalized ולא needs_clarification.
לכל formalized החזר formalRuleJson כמחרוזת JSON תקינה של מבנה version=4.
evaluatorKey יהיה "generic".
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
