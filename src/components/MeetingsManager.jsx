export default function MeetingsManager({ teachers, meetings, setSchoolData }) {
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

    function toggleTeacher(meeting, teacherId) {
        const teacherIds = meeting.teacherIds || [];

        const nextTeacherIds = teacherIds.includes(teacherId)
            ? teacherIds.filter((id) => id !== teacherId)
            : [...teacherIds, teacherId];

        setSchoolData((prev) => {
            const meetingName = meeting.name;

            const existingOtherUnits = prev.teachingUnits.filter(
                (unit) => unit.constraintGroupId !== meeting.id
            );

            const meetingUnits = nextTeacherIds.map((id) => ({
                id: `${meeting.id}-${id}`,
                className: meetingName,
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

            {(meetings || []).map((meeting) => (
                <div key={meeting.id} className="meeting-card">
                    <div className="meeting-card-header">
                        <input
                            value={meeting.name}
                            onChange={(e) =>
                                updateMeeting(meeting.id, { name: e.target.value })
                            }
                        />

                        <button
                            className="mini-button danger-mini-button"
                            onClick={() => deleteMeeting(meeting)}
                        >
                            מחק
                        </button>
                    </div>

                    <div className="meeting-teachers">
                        {teachers.map((teacher) => (
                            <label key={teacher.id} className="free-day-checkbox">
                                <input
                                    type="checkbox"
                                    checked={meeting.teacherIds?.includes(teacher.id) || false}
                                    onChange={() => toggleTeacher(meeting, teacher.id)}
                                />
                                {teacher.name}
                            </label>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}