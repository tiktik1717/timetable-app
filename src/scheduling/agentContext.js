// src/scheduling/agentContext.js

export function createSchedulingAgentContext({
  schoolData,
  schedule,
  approvedExceptions = [],
  rules = [],
}) {
  return {
    createdAt: new Date().toISOString(),

    schoolData,

    // עותק של המערכת שעליה הסוכן מסתכל כרגע
    baseSchedule: schedule,

    // בשלב הזה עדיין אין הצעה חדשה
    candidateSchedule: null,

    // חריגים שאושרו על ידי המשתמש
    approvedExceptions: [
      ...approvedExceptions,
    ],

    // חוקי-על שהמשתמש יגדיר בהמשך
    rules: [
      ...rules,
    ],

    status: "ready",
  };
}