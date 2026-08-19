export const AGENT_ACTION_TYPES = {
  APPROVE_MEETING_PARTICIPANT_EXCEPTION:
    "approveMeetingParticipantException",

  UPDATE_RULE_INTERPRETATION:
    "updateRuleInterpretation",
};

export function createMeetingParticipantException({
  meetingId,
  teacherId,
}) {
  return {
    type: "meetingParticipant",
    meetingId,
    teacherId: String(teacherId),
  };
}