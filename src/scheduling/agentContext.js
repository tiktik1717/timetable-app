// src/scheduling/agentContext.js

/**
 * יוצר snapshot של מצב המערכת לצורך עבודה של סוכן השיבוץ.
 *
 * חשוב:
 * האובייקט הזה אינו משנה את ה-schedule הפעיל.
 * בהמשך הסוכן יעבוד על candidateSchedule נפרד.
 */
export function createSchedulingAgentContext({
  schoolData,
  schedule,
  approvedExceptions = [],
  rules = [],
}) {
  return {
    createdAt: new Date().toISOString(),

    /**
     * נתוני בית הספר:
     * מורים, כיתות, יחידות הוראה,
     * קבוצות אילוץ, ישיבות וכו'.
     */
    schoolData,

    /**
     * המערכת הקיימת שעליה הסוכן מסתכל.
     *
     * בשלב הזה אנחנו רק קוראים אותה.
     */
    baseSchedule: schedule,

    /**
     * כאן תהיה בעתיד הצעת השיבוץ של הסוכן.
     *
     * בכוונה לא משתמשים ב-schedule הפעיל.
     */
    candidateSchedule: null,

    /**
     * חריגים שהמשתמש אישר במהלך השיחה.
     *
     * לדוגמה:
     * מורה שלא חייב להשתתף בישיבה מסוימת.
     */
    approvedExceptions: [
      ...approvedExceptions,
    ],

    /**
     * חוקי-העל שהמשתמש ייתן בשפה טבעית.
     *
     * בהמשך הסוכן ישמור כאן גם את
     * הפרשנות המובנית שלהם.
     */
    rules: [
      ...rules,
    ],

    /**
     * מצב תהליך הסוכן.
     *
     * בהמשך יהיו מצבים נוספים:
     * validating
     * waitingForUser
     * searching
     * candidateReady
     * failed
     */
    status: "ready",
  };
}