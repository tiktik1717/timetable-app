import { useState } from "react";

const DAYS = ["א", "ב", "ג", "ד", "ה", "ו"];

export default function MeetingsManager({ teachers, meetings, setSchoolData }) {
    const [editingParticipantsMeeting, setEditingParticipantsMeeting] =
        useState(null);

    const [editingDaysMeeting, setEditingDaysMeeting] = useState(null);

    const sortedTeachers = [...teachers].sort((a, b) =>
        a.name.localeCompare(b.name, "he")
    );

    function getTeacherNames(teacherIds = []) {
        return teacherIds
            .map((id) => teachers.find((teacher) => teacher.id === id)?.name)
            .filter(Boolean)
            .join(", ");
    }

    function getLegalMeetingDays(meeting) {
        const allowedDays =
            meeting.allowedDays?.length > 0 ? meeting.allowedDays : DAYS;

        return allowedDays.filter((day) =>
            (meeting.teacherIds || []).every((teacherId) => {
                const teacher = teachers.find((t) => t.id === teacherId);
                return !teacher?.freeDays?.includes(day);
            })
        );
    }

    function addMeeting() {
        const name = prompt("שם הישיבה");

        if (!name || !name.trim()) {
            alert("שם ישיבה לא יכול להיות ריק");
            return;
        }

        const meetingId = `meeting-${Date.now()}`;

        setSchoolData((prev) => ({
            ...prev,
            meetings: [
                ...(prev.meetings || []),
                {
                    id: meetingId,
                    name: name.trim(),
                    teacherIds: [],
                    allowedDays: [],
                    allowedHours: [],
                },
            ],
            constraintGroups: [
                ...(prev.constraintGroups || []),
                {
                    id: meetingId,
                    name: name.trim(),
                    color: "#ce93d8",
                    rules: ["sameTime"],
                    groupKind: "meeting",
                },
            ],
            classes: [...prev.classes, name.trim()],
            teachingLoads: {
                ...(prev.teachingLoads || {}),
                [name.trim()]: {},
            },
        }));
    }

    function updateMeeting(meetingId, updates) {
        setSchoolData((prev) => {
            const nextMeetings = (prev.meetings || []).map((meeting) =>
                meeting.id === meetingId ? { ...meeting, ...updates } : meeting
            );

            const meeting = nextMeetings.find((m) => m.id === meetingId);
            const oldMeeting = (prev.meetings || []).find((m) => m.id === meetingId);

            const oldName = oldMeeting?.name;
            const newName = meeting?.name;

            const nextClasses =
                oldName && newName && oldName !== newName
                    ? prev.classes.map((className) =>
                        className === oldName ? newName : className
                    )
                    : prev.classes;

            return {
                ...prev,
                meetings: nextMeetings,
                classes: nextClasses,
                constraintGroups: prev.constraintGroups.map((group) =>
                    group.id === meetingId
                        ? { ...group, name: meeting?.name || group.name }
                        : group
                ),
                teachingUnits: prev.teachingUnits.map((unit) =>
                    unit.constraintGroupId === meetingId && oldName && newName
                        ? { ...unit, className: newName }
                        : unit
                ),
            };
        });
    }

    function updateMeetingParticipants(meeting, nextTeacherIds) {
        setSchoolData((prev) => {
            const existingOtherUnits = prev.teachingUnits.filter(
                (unit) => unit.constraintGroupId !== meeting.id
            );

            const meetingUnits = nextTeacherIds.map((id) => ({
                id: `${meeting.id}-${id}`,
                className: meeting.name,
                teacherId: id,
                subject: "ישיבה",
                hours: 1,
                constraintGroupId: meeting.id,
            }));

            return {
                ...prev,
                meetings: (prev.meetings || []).map((m) =>
                    m.id === meeting.id ? { ...m, teacherIds: nextTeacherIds } : m
                ),
                teachingUnits: [...existingOtherUnits, ...meetingUnits],
            };
        });

        setEditingParticipantsMeeting(null);
    }

    function updateMeetingAllowedDays(meeting, allowedDays) {
        setSchoolData((prev) => ({
            ...prev,
            meetings: (prev.meetings || []).map((m) =>
                m.id === meeting.id ? { ...m, allowedDays } : m
            ),
        }));

        setEditingDaysMeeting(null);
    }

    function deleteMeeting(meeting) {
        if (!confirm(`למחוק את ${meeting.name}?`)) return;

        setSchoolData((prev) => {
            const newTeachingLoads = { ...(prev.teachingLoads || {}) };
            delete newTeachingLoads[meeting.name];

            return {
                ...prev,
                meetings: (prev.meetings || []).filter((m) => m.id !== meeting.id),
                constraintGroups: prev.constraintGroups.filter(
                    (group) => group.id !== meeting.id
                ),
                classes: prev.classes.filter((className) => className !== meeting.name),
                teachingLoads: newTeachingLoads,
                teachingUnits: prev.teachingUnits.filter(
                    (unit) => unit.constraintGroupId !== meeting.id
                ),
            };
        });
    }

    return (
        <div className="meetings-manager">
            <div className="manager-header">
                <h3>ניהול ישיבות צוות</h3>

                <button className="action-button" onClick={addMeeting}>
                    הוסף ישיבה
                </button>
            </div>

            {(meetings || []).map((meeting) => {
                const legalDays = getLegalMeetingDays(meeting);
                const hasParticipants = meeting.teacherIds?.length > 0;

                return (
                    <div key={meeting.id} className="meeting-card">
                        <div className="meeting-card-header">
                            <input
                                value={meeting.name}
                                onChange={(e) =>
                                    updateMeeting(meeting.id, { name: e.target.value })
                                }
                            />

                            <button
                                className="mini-button"
                                onClick={() => setEditingParticipantsMeeting(meeting)}
                            >
                                עריכת משתתפים
                            </button>

                            <button
                                className="mini-button"
                                onClick={() => setEditingDaysMeeting(meeting)}
                            >
                                בחירת ימים
                            </button>

                            <button
                                className="mini-button danger-mini-button"
                                onClick={() => deleteMeeting(meeting)}
                            >
                                מחק
                            </button>
                        </div>

                        <div className="meeting-participants-summary">
                            <strong>משתתפים:</strong>{" "}
                            {hasParticipants
                                ? getTeacherNames(meeting.teacherIds)
                                : "לא נבחרו משתתפים"}
                        </div>

                        <div className="meeting-participants-summary">
                            <strong>ימים מותרים:</strong>{" "}
                            {meeting.allowedDays?.length ? meeting.allowedDays.join(", ") : "כל הימים"}
                        </div>

                        <div className="meeting-participants-summary">
                            <strong>ימים חוקיים בפועל:</strong>{" "}
                            {legalDays.length ? legalDays.join(", ") : "אין ימים חוקיים"}
                        </div>

                        {hasParticipants && legalDays.length === 0 && (
                            <div className="meeting-warning">
                                ⚠ אין אף יום חוקי לשיבוץ הישיבה לפי המשתתפים והימים שנבחרו
                            </div>
                        )}
                    </div>
                );
            })}

            {editingParticipantsMeeting && (
                <ParticipantsDialog
                    meeting={editingParticipantsMeeting}
                    teachers={sortedTeachers}
                    onSave={(teacherIds) =>
                        updateMeetingParticipants(editingParticipantsMeeting, teacherIds)
                    }
                    onCancel={() => setEditingParticipantsMeeting(null)}
                />
            )}

            {editingDaysMeeting && (
                <MeetingDaysDialog
                    meeting={editingDaysMeeting}
                    onSave={(allowedDays) =>
                        updateMeetingAllowedDays(editingDaysMeeting, allowedDays)
                    }
                    onCancel={() => setEditingDaysMeeting(null)}
                />
            )}
        </div>
    );
}

function ParticipantsDialog({ meeting, teachers, onSave, onCancel }) {
    const [selectedTeacherIds, setSelectedTeacherIds] = useState(
        meeting.teacherIds || []
    );

    function toggleTeacher(teacherId) {
        setSelectedTeacherIds((prev) =>
            prev.includes(teacherId)
                ? prev.filter((id) => id !== teacherId)
                : [...prev, teacherId]
        );
    }

    return (
        <div className="modal-backdrop" onClick={onCancel}>
            <div className="participants-dialog" onClick={(e) => e.stopPropagation()}>
                <h3>עריכת משתתפים — {meeting.name}</h3>

                <div className="participants-list">
                    {teachers.map((teacher) => (
                        <label key={teacher.id} className="participant-row">
                            <input
                                type="checkbox"
                                checked={selectedTeacherIds.includes(teacher.id)}
                                onChange={() => toggleTeacher(teacher.id)}
                            />
                            {teacher.name}
                        </label>
                    ))}
                </div>

                <div className="dialog-actions">
                    <button className="action-button" onClick={() => onSave(selectedTeacherIds)}>
                        שמור
                    </button>

                    <button className="dialog-cancel" onClick={onCancel}>
                        ביטול
                    </button>
                </div>
            </div>
        </div>
    );
}

function MeetingDaysDialog({ meeting, onSave, onCancel }) {
    const [selectedDays, setSelectedDays] = useState(meeting.allowedDays || []);

    function toggleDay(day) {
        setSelectedDays((prev) =>
            prev.includes(day)
                ? prev.filter((d) => d !== day)
                : [...prev, day]
        );
    }

    return (
        <div className="modal-backdrop" onClick={onCancel}>
            <div className="participants-dialog" onClick={(e) => e.stopPropagation()}>
                <h3>בחירת ימים — {meeting.name}</h3>

                <p className="dialog-note">
                    אם לא מסמנים אף יום, הישיבה תיחשב כמותרת בכל הימים.
                </p>

                <div className="participants-list">
                    {DAYS.map((day) => (
                        <label key={day} className="participant-row">
                            <input
                                type="checkbox"
                                checked={selectedDays.includes(day)}
                                onChange={() => toggleDay(day)}
                            />
                            יום {day}
                        </label>
                    ))}
                </div>

                <div className="dialog-actions">
                    <button className="action-button" onClick={() => onSave(selectedDays)}>
                        שמור
                    </button>

                    <button className="dialog-cancel" onClick={onCancel}>
                        ביטול
                    </button>
                </div>
            </div>
        </div>
    );
}