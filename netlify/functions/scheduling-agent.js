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
      formalRuleEvaluations = [],
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

    const previousConversationMessages =
      Array.isArray(conversationHistory)
        ? conversationHistory
          .filter(
            (item) =>
              item?.text &&
              (item.role === "user" || item.role === "agent")
          )
          .map((item) => ({
            role: item.role === "agent" ? "assistant" : "user",
            content: item.text,
          }))
          // Keep recent conversational context. Current rules, validator state and
          // schedule snapshot are sent separately on every request.
          .slice(-10)
        : [];

    // Some callers already include the current user message in conversationHistory
    // while automatic-attempt evaluation does not. Normalize both paths so the
    // current message is sent exactly once.
    const withoutDuplicateCurrent =
      previousConversationMessages.length > 0 &&
      previousConversationMessages.at(-1)?.role === "user" &&
      previousConversationMessages.at(-1)?.content === message
        ? previousConversationMessages.slice(0, -1)
        : previousConversationMessages;

    const conversationMessages = [
      ...withoutDuplicateCurrent,
      { role: "user", content: message },
    ];

    const model = "gpt-5.2";
    const startedAt = Date.now();

    const instructions = `
אתה סוכן שיבוץ למערכת שעות בית ספרית. בשלב הנוכחי אתה יועץ: אינך משנה את המערכת בעצמך.

כללי יסוד:
- ענה בעברית ואל תמציא נתונים או מזהים.
- דו"ח ה-validator העדכני הוא מקור האמת לגבי שגיאות Core במערכת.
- ה-snapshot העדכני גובר על מידע ישן בהיסטוריית השיחה.
- approvedExceptions כבר הוחלו בחישוב ה-validator; אין צורך להחיל אותם מחדש.
- הבחן בין חוק קריטי להמלצה. אם אין מספיק מידע, אמור זאת או בקש הבהרה ממוקדת.

חוקי-על:
- לחוק status="unparsed" נסה להציע updateRuleInterpretation.
- formalized: החזר formalRuleJson כמחרוזת JSON תקינה.
- semantic_only: החוק מובן אך אינו ניתן לפורמליזציה בטוחה כרגע.
- needs_clarification: יש עמימות מהותית; שאל שאלה אחת ממוקדת.
- אל תשנה originalText ואל תמציא teacherId/className/meetingId.
- תוצאה דטרמיניסטית עם supported=true גוברת על הערכה סמנטית שלך לאותו חוק.

בדיקת חוק:
- החזר ruleCheckResults עבור חוקים שבדקת.
- satisfied = מתקיים; violated = נמצאה הפרה; unknown = אין מספיק מידע.
- אם מופר, פרט יום/שעות/ישות והסבר.

הצעת תיקון:
- רק אם המשתמש מבקש פתרון, מותר proposeScheduleMove.
- unitId/teacherId/source חייבים להופיע ב-snapshot הנוכחי ולהיות מדויקים.
- אל תטען שהיעד חוקי לפני simulation + validator + בדיקת חוקי-העל.

פורמט snapshot קומפקטי:
teacherScheduleSummary הוא אובייקט עם format="teacher-placements-v2".
byTeacher[teacherId] הוא מערך tuples לפי fields=[day,hour,className,unitId].
שמות המורים נמצאים ב-entitySummary.teachers.
`;

    const compactJson = (value) => JSON.stringify(value ?? null);

    const contextParts = {
      validation: compactJson(validationSummary),
      formalRules: compactJson(formalRuleEvaluations),
      rules: compactJson(rules),
      exceptions: compactJson(approvedExceptions),
      entities: compactJson(entitySummary),
      teacherSchedule: compactJson(teacherScheduleSummary),
    };

    const developerContext = `
מצב מערכת עדכני שנוצר עכשיו מתוך האפליקציה. הוא גובר על היסטוריית שיחה ישנה.
VALIDATOR=${contextParts.validation}
FORMAL_RULE_EVALUATIONS=${contextParts.formalRules}
RULES=${contextParts.rules}
APPROVED_EXCEPTIONS=${contextParts.exceptions}
ENTITIES=${contextParts.entities}
TEACHER_SCHEDULE=${contextParts.teacherSchedule}
`;

    const contextProfile = {
      instructionsChars: instructions.length,
      conversationChars: conversationMessages.reduce(
        (sum, item) => sum + String(item.content || "").length,
        0,
      ),
      developerChars: developerContext.length,
      validationChars: contextParts.validation.length,
      formalRuleChars: contextParts.formalRules.length,
      rulesChars: contextParts.rules.length,
      exceptionsChars: contextParts.exceptions.length,
      entitiesChars: contextParts.entities.length,
      teacherScheduleChars: contextParts.teacherSchedule.length,
    };

    const contextChars =
      contextProfile.instructionsChars +
      contextProfile.conversationChars +
      contextProfile.developerChars;

    const response = await client.responses.create({
      model,
      instructions,
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
          content: developerContext,
        },
      ],
    });

    const agentResult = JSON.parse(
      response.output_text
    );

    const usage = response.usage || {};

    const telemetry = {
      model: response.model || model,
      inputTokens:
        usage.input_tokens ??
        usage.inputTokens ??
        0,
      outputTokens:
        usage.output_tokens ??
        usage.outputTokens ??
        0,
      totalTokens:
        usage.total_tokens ??
        usage.totalTokens ??
        (usage.input_tokens || 0) +
          (usage.output_tokens || 0),
      durationMs: Date.now() - startedAt,
      contextChars,
      contextProfile,
    };

    return new Response(
      JSON.stringify({
        reply: agentResult.reply,

        proposedAction:
          agentResult.proposedAction,

        ruleCheckResults:
          agentResult.ruleCheckResults || [],

        telemetry,
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
