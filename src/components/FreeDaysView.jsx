import { useState } from "react";

export default function FreeDaysView({ teachers, classes, days }) {
    const [showHomeroomOnly, setShowHomeroomOnly] = useState(false);

    const homeroomTeacherIds = new Set(
        classes
            .map((classItem) =>
                typeof classItem === "string"
                    ? null
                    : classItem.homeroomTeacherId || classItem.teacherId
            )
            .filter(Boolean)
    );

    const relevantTeachers = showHomeroomOnly
        ? teachers.filter((teacher) => homeroomTeacherIds.has(teacher.id))
        : teachers;

    const teachersByDay = {};

    for (const day of days) {
        teachersByDay[day] = relevantTeachers
            .filter((teacher) => teacher.freeDays?.includes(day))
            .sort((a, b) => a.name.localeCompare(b.name, "he"));
    }

    const maxRows = Math.max(
        0,
        ...days.map((day) => teachersByDay[day].length)
    );

    return (
        <div className="free-days-view">
            <div className="free-days-header">
                <h2>חלוקת ימים חופשיים</h2>

                <label className="inline-checkbox">
                    <input
                        type="checkbox"
                        checked={showHomeroomOnly}
                        onChange={(e) => setShowHomeroomOnly(e.target.checked)}
                    />
                    הצג מחנכים בלבד
                </label>
            </div>

            <table className="free-days-table">
                <thead>
                    <tr>
                        {days.map((day) => (
                            <th key={day}>יום {day}</th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    <tr className="free-days-count-row">
                        {days.map((day) => (
                            <td key={day}>{teachersByDay[day].length} מורים</td>
                        ))}
                    </tr>

                    {Array.from({ length: maxRows }, (_, index) => (
                        <tr key={index}>
                            {days.map((day) => (
                                <td key={day}>
                                    {teachersByDay[day][index]?.name || ""}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}