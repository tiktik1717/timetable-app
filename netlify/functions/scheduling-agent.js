import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.SCHEDULING_OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1",
});

const agentResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: {
      type: "string",
    },

    proposedAction: {
      anyOf: [
        {
          type: "null",
        },
        {
          type: "object",
          additionalProperties: false,
          properties: {
            type: {
              type: "string",
              enum: [
                "approveMeetingParticipantException",
              ],
            },

            meetingId: {
              type: "string",
            },

            teacherId: {
              type: "string",
            },

            explanation: {
              type: "string",
            },
          },

          required: [
            "type",
            "meetingId",
            "teacherId",
            "explanation",
          ],
        },
        {
          type: "object",
          additionalProperties: false,

          properties: {
            type: {
              type: "string",
              enum: ["updateRuleInterpretation"],
            },

            ruleId: {
              type: "string",
            },

            interpretation: {
              type: "string",
            },

            formalizationStatus: {
              type: "string",
              enum: [
                "formalized",
                "semantic_only",
                "needs_clarification",
              ],
            },

            formalRuleJson: {
              anyOf: [
                {
                  type: "null",
                },
                {
                  type: "string",
                },
              ],
            },

            clarificationQuestion: {
              anyOf: [
                {
                  type: "null",
                },
                {
                  type: "string",
                },
              ],
            },

            explanation: {
              type: "string",
            },
          },

          required: [
            "type",
            "ruleId",
            "interpretation",
            "formalizationStatus",
            "formalRuleJson",
            "clarificationQuestion",
            "explanation",
          ],
        },
        {
          type: "object",
          additionalProperties: false,

          properties: {
            type: {
              type: "string",
              enum: ["proposeScheduleMove"],
            },

            ruleId: {
              anyOf: [
                { type: "null" },
                { type: "string" },
              ],
            },

            unitId: {
              type: "string",
            },

            teacherId: {
              type: "string",
            },

            fromDay: {
              type: "string",
            },

            fromHour: {
              type: "integer",
            },

            fromClassName: {
              type: "string",
            },

            toDay: {
              type: "string",
            },

            toHour: {
              type: "integer",
            },

            toClassName: {
              type: "string",
            },

            explanation: {
              type: "string",
            },
          },

          required: [
            "type",
            "ruleId",
            "unitId",
            "teacherId",
            "fromDay",
            "fromHour",
            "fromClassName",
            "toDay",
            "toHour",
            "toClassName",
            "explanation",
          ],
        },
      ],
    },

    ruleCheckResults: {
      type: "array",

      items: {
        type: "object",
        additionalProperties: false,

        properties: {
          ruleId: {
            type: "string",
          },

          status: {
            type: "string",
            enum: [
              "satisfied",
              "violated",
              "unknown",
            ],
          },

          summary: {
            type: "string",
          },

          violations: {
            type: "array",

            items: {
              type: "object",
              additionalProperties: false,

              properties: {
                day: {
                  anyOf: [
                    { type: "null" },
                    { type: "string" },
                  ],
                },

                hours: {
                  type: "array",
                  items: {
                    type: "integer",
                  },
                },

                entityId: {
                  anyOf: [
                    { type: "null" },
                    { type: "string" },
                  ],
                },

                explanation: {
                  type: "string",
                },

                detailsJson: {
                  anyOf: [
                    { type: "null" },
                    { type: "string" },
                  ],
                },
              },

              required: [
                "day",
                "hours",
                "entityId",
                "explanation",
                "detailsJson",
              ],
            },
          },
        },

        required: [
          "ruleId",
          "status",
          "summary",
          "violations",
        ],
      },
    },
  },

  required: [
    "reply",
    "proposedAction",
    "ruleCheckResults",
  ],
};


export default async (request) => {
  try {

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: "Method not allowed",
        }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const body = await request.json();

    const {
      message,
      conversationHistory = [],
      validationSummary,
      rules = [],
      approvedExceptions = [],
      entitySummary = {},
      teacherScheduleSummary = {},
    } = body;


    if (!message?.trim()) {
      return new Response(
        JSON.stringify({
          error: "Message is required",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const conversationMessages =
      Array.isArray(conversationHistory)
        ? conversationHistory
          .filter(
            (item) =>
              item?.text &&
              (
                item.role === "user" ||
                item.role === "agent"
              )
          )
          .map((item) => ({
            role:
              item.role === "agent"
                ? "assistant"
                : "user",

            content: item.text,
          }))
        : [];

    console.log(
      "PROMPT Kolodkin schedule:",
      JSON.stringify(
        teacherScheduleSummary?.["40"],
        null,
        2
      )
    );

    const response = await client.responses.create({
      model: "gpt-5.2",

      instructions: `
      אתה סוכן שיבוץ למערכת שעות בית ספרית.

      בשלב הנוכחי אתה פועל כיועץ בלבד.

      אסור לך:
      - לשנות את מערכת השעות.
      - להמציא נתונים שאינם מופיעים בהקשר.
      - לטעון שחוק מתקיים אם אין לך מספיק מידע לבדוק זאת.

      עליך:
      - לענות בעברית.
      - להבין חוקי-על שנכתבים בשפה טבעית.
      - להבחין בין כלל קריטי לבין המלצה.
      - להסביר סתירות בצורה ברורה.
      - לבקש הבהרה אם חוק אינו חד-משמעי.
      - להתייחס לדו"ח ה-validator כמקור האמת לגבי מצב המערכת הנוכחי.

      אם המשתמש מציע חריג או שינוי, דון בו בלבד.
      אל תבצע אותו.

      חשוב לגבי חריגים מאושרים:

      כל חריג שמופיע תחת "חריגים מאושרים" כבר אושר על ידי המשתמש
      וכבר הוחל בחישוב דו"ח ה-validator שנשלח אליך בבקשה הנוכחית.

      דו"ח ה-validator שאתה מקבל בכל הודעה הוא תמיד הדו"ח העדכני
      לאחר החלת כל החריגים המאושרים.

      לכן:
      - אל תגיד שצריך להחיל מחדש חריג שכבר מופיע ברשימה.
      - אל תבקש מהמשתמש להפעיל validator מחדש.
      - אם המשתמש מבקש דו"ח עדכני, השתמש בדו"ח שנשלח אליך עכשיו.
      - approvedExceptions אינם משנים את schoolData המקורי; זה מכוון.
      - חריג מאושר משנה את דרישות השיבוץ ואת תוצאת ה-validator,
        בלי לשנות את נתוני המקור.

      חשוב מאוד לגבי מצב המערכת וה-validator:

      בכל בקשה אתה מקבל דו"ח validator חדש ועדכני שנוצר בזמן אמת.

      הדו"ח כבר מחושב לאחר החלת כל החריגים שמופיעים תחת
      "חריגים מאושרים".

      לכן:
      - החריגים המאושרים כבר פעילים מבחינת סביבת העבודה של סוכן השיבוץ.
      - אין צורך להחיל אותם שוב.
      - אין צורך לבקש מהמשתמש להריץ validator מחדש.
      - אין צורך לבקש מהמשתמש להדביק דו"ח validator.
      - אם המשתמש מבקש דו"ח שגיאות עדכני, השתמש בדו"ח שנשלח אליך בבקשה הנוכחית.
      - אל תתייחס לדו"ח קודם מתוך היסטוריית השיחה אם הדו"ח הנוכחי שונה ממנו.
      - דו"ח ה-validator הנוכחי הוא מקור האמת לגבי מצב השיבוץ ברגע זה.

      approvedExceptions אינם משנים את schoolData המקורי.
      זה מכוון.

      חריג מאושר משנה את דרישות השיבוץ של סביבת העבודה ואת תוצאת
      ה-validator, בלי לשנות את נתוני המקור של בית הספר.

      כאשר קיימים חוקי-על עם status="unparsed":

      עליך לנסות להבין אותם בשפה טבעית.

      לכל חוק כזה יש שלוש אפשרויות:

      1. formalized
      אם ניתן לתרגם את החוק בצורה ברורה לייצוג פורמלי שימושי.

      2. semantic_only
      אם החוק מובן, אבל אין דרך בטוחה לייצג אותו כרגע באמצעות כלל פורמלי.
      במקרה כזה אין להתעלם ממנו. הוא נשאר חוק שהסוכן יצטרך להתחשב בו סמנטית.

      3. needs_clarification
      אם קיימת עמימות מהותית שלא מאפשרת לדעת מה המשתמש התכוון.
      במקרה כזה יש לשאול שאלה אחת ממוקדת.

      כאשר אתה מפרש חוק, החזר proposedAction מסוג updateRuleInterpretation.

      אסור לשנות את originalText של החוק.
      אסור להמציא teacherId, className, meetingId או entity אחר.
      אם אינך יכול לזהות ישות בוודאות מתוך המידע שסופק לך, השתמש ב-needs_clarification.

      כאשר formalizationStatus הוא "formalized":

      החזר את formalRuleJson כמחרוזת שמכילה JSON תקין המתאר את החוק הפורמלי.

      לדוגמה:

      {
        "scope": "teacher_day",
        "teacherId": "40",
        "constraint": "no_internal_gaps",
        "allowLateStart": true
      }

      אבל את כל האובייקט הזה יש להחזיר כמחרוזת JSON בתוך formalRuleJson.

      כאשר החוק הוא semantic_only או needs_clarification,
      formalRuleJson חייב להיות null.

      בדיקת חוקי-על מול מערכת השעות:

      בכל בקשה נשלח אליך snapshot חדש ועדכני של מערכת השעות
      תחת "מערכות שעות בפועל של המורים".

      ה-snapshot הזה נוצר בזמן שליחת ההודעה הנוכחית מתוך מערכת השעות
      הפעילה באפליקציה.

      חשוב:
      - הנתונים האלה הם מצב מערכת השעות הנוכחי.
      - הם חדשים יותר מכל נתוני שיבוץ שמופיעים בהיסטוריית השיחה.
      - אם יש סתירה בין היסטוריית השיחה לבין snapshot זה,
        ה-snapshot הנוכחי הוא מקור האמת.
      - לעולם אל תבקש מהמשתמש להדביק snapshot חדש אם הנתונים האלה
        קיימים בבקשה הנוכחית.
      - אם המשתמש אומר שביצע שינוי במערכת, הנח שה-snapshot שנשלח
        בבקשה הנוכחית כבר משקף את השינוי.
      - אין צורך שהמשתמש ירענן את העמוד או יריץ validator כדי שתשתמש
        בנתוני השיבוץ העדכניים.

      כאשר המשתמש מבקש לבדוק האם חוק-על מתקיים:
      1. אתר את החוק הרלוונטי ברשימת חוקי-העל.
      2. השתמש בפרשנות המאושרת שלו אם קיימת.
      3. אתר את הישות הרלוונטית ב-snapshot הנוכחי.
      4. בדוק את החוק מול הנתונים הנוכחיים.
      5. דווח האם החוק מתקיים או מופר.
      6. אם הוא מופר, פרט בדיוק את היום, השעות והסיבה.

      רק אם המידע הדרוש באמת אינו קיים ב-snapshot הנוכחי,
      אמור שאין מספיק מידע.

      תוצאות בדיקת חוקי-על:

כאשר אתה בודק חוק-על אחד או יותר מול ה-snapshot הנוכחי,
החזר את תוצאת הבדיקה גם בתוך ruleCheckResults.

לכל חוק שנבדק:

- ruleId חייב להיות ה-id המדויק של החוק.
- status="satisfied" אם החוק מתקיים.
- status="violated" אם נמצאה לפחות הפרה אחת.
- status="unknown" רק אם באמת אין מספיק מידע כדי להכריע.
- summary הוא סיכום קצר בעברית של התוצאה.
- violations חייב להכיל את ההפרות שנמצאו.
- אם החוק מתקיים, violations יהיה מערך ריק.

בכל violation:
- day הוא היום הרלוונטי, או null אם אין יום מסוים.
- hours הן השעות הקשורות להפרה, אם יש.
- entityId הוא מזהה המורה/כיתה/ישות הרלוונטית, או null.
- explanation הוא הסבר ברור בעברית.
- detailsJson יכול להכיל כמחרוזת JSON פרטים נוספים אם צריך,
  אחרת null.

חשוב:
ruleCheckResults הוא תוצאת בדיקה בלבד.
הוא אינו משנה את מערכת השעות ואינו דורש אישור משתמש.

הצעות לתיקון מערכת השעות:

כאשר המשתמש מבקש ממך להציע דרך לתקן הפרה של חוק-על,
אתה רשאי להחזיר proposedAction מסוג proposeScheduleMove.

פעולה זו היא הצעה בלבד.
היא עדיין לא נבדקה ולא בוצעה במערכת.

כאשר אתה מציע move:
- unitId חייב להיות unitId אמיתי שמופיע ב-snapshot הנוכחי.
- teacherId חייב להתאים ליחידה.
- fromDay, fromHour ו-fromClassName חייבים לתאר בדיוק את
  המקום שבו היחידה משובצת כעת.
- toDay, toHour ו-toClassName הם היעד המוצע.
- אל תמציא unitId.
- אל תטען שהיעד חוקי או פנוי אם הנתונים שנשלחו אליך
  אינם מספיקים כדי לקבוע זאת.
- הסבר במפורש שההצעה עדיין צריכה לעבור סימולציה,
  validator ובדיקת חוקי-העל לפני שניתן יהיה לאשר אותה.

אם המשתמש רק מבקש לבדוק חוק ולא מבקש פתרון,
אין צורך להציע שינוי.
              `,

      text: {
        format: {
          type: "json_schema",
          name: "scheduling_agent_response",
          strict: true,
          schema: agentResponseSchema,
        },
      },

      input: [
        ...conversationMessages,

        {
          role: "developer",
          content: `
זהו מצב המערכת העדכני בזמן הבקשה הנוכחית.

חשוב מאוד:
המידע בהודעת developer זו נוצר עכשיו מתוך האפליקציה,
לא מתוך היסטוריית השיחה.

אם יש סתירה בין מידע כלשהו בהיסטוריית השיחה
לבין הנתונים שמופיעים בהמשך הודעה זו,
הנתונים בהודעה זו הם מקור האמת.

דו"ח validator עדכני:
${JSON.stringify(
            validationSummary,
            null,
            2
          )}

חוקי-העל העדכניים:
${JSON.stringify(
            rules,
            null,
            2
          )}

חריגים מאושרים שכבר הוחלו בחישוב ה-validator:
${JSON.stringify(
            approvedExceptions,
            null,
            2
          )}

ישויות מוכרות במערכת:
${JSON.stringify(
            entitySummary,
            null,
            2
          )}

SNAPSHOT נוכחי של מערכות השעות בפועל של המורים:

${JSON.stringify(
            teacherScheduleSummary,
            null,
            2
          )}

כללי שימוש ב-snapshot:

1. ה-snapshot שלעיל נוצר עכשיו מתוך ה-schedule הפעיל באפליקציה.
2. הוא כבר כולל כל שינוי ידני שבוצע לפני שליחת ההודעה הנוכחית.
3. אל תשתמש במערכת שעות ישנה שמוזכרת בהיסטוריית השיחה.
4. אל תגיד שאין לך snapshot אם teacherScheduleSummary שלעיל מכיל נתונים.
5. אל תבקש מהמשתמש להדביק מערכת שעות או snapshot אם הנתונים הרלוונטיים קיימים כאן.
6. כאשר המשתמש מבקש בדיקה מחדש לאחר שינוי, בצע אותה מול הנתונים שלעיל.
7. אם חוק נוגע למורה מסוים, השתמש ברשומה של אותו teacherId בתוך teacherScheduleSummary.
`,
        },
      ],
    });

    const agentResult = JSON.parse(
      response.output_text
    );

    return new Response(
      JSON.stringify({
        reply: agentResult.reply,

        proposedAction:
          agentResult.proposedAction,

        ruleCheckResults:
          agentResult.ruleCheckResults || [],
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Scheduling agent error:", error);

    return new Response(
      JSON.stringify({
        error: error?.message || "Unknown scheduling agent error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};
