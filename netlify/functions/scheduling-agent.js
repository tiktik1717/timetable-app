import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
      validationSummary,
      rules = [],
      approvedExceptions = [],
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
        `,

      input: `
הודעת המשתמש:
${message}

דו"ח מצב המערכת:
${JSON.stringify(validationSummary, null, 2)}

חוקי-העל שהוגדרו:
${JSON.stringify(rules, null, 2)}

חריגים שאושרו:
${JSON.stringify(approvedExceptions, null, 2)}
        `,
    });

    return new Response(
      JSON.stringify({
        reply: response.output_text,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
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
