export default function TeacherView({
    teachers,
    classes,
    days,
    hours,
    selectedTeacherForView,
    setSelectedTeacherForView,
    getCellUnitIds,
    getUnitById,
}) {
    function getTeacherLessons(day, hour) {
        const lessons = [];

        for (const className of classes) {
            const unitIds = getCellUnitIds(day, className, hour);

            for (const unitId of unitIds) {
                const unit = getUnitById(unitId);

                if (unit?.teacherId === selectedTeacherForView) {
                    lessons.push(
                        unit.subject && unit.subject !== "רגיל"
                            ? `${className} / ${unit.subject}`
                            : className
                    );
                }
            }
        }

        return lessons;
    }

    return (
        <div className="teacher-view">
            <div className="teacher-view-header">
                <h3>תצוגת מורה</h3>

                <label>
                    מורה:
                    <select
                        value={selectedTeacherForView}
                        onChange={(e) => setSelectedTeacherForView(e.target.value)}
                    >
                        {teachers.map((teacher) => (
                            <option key={teacher.id} value={teacher.id}>
                                {teacher.name}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <table className="teacher-view-table">
                <thead>
                    <tr>
                        <th>שעה</th>
                        {days.map((day) => (
                            <th key={day}>יום {day}</th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {hours.map((hour) => (
                        <tr key={hour}>
                            <td className="teacher-view-hour">שעה {hour}</td>

                            {days.map((day) => {
                                const lessons = getTeacherLessons(day, hour);

                                return (
                                    <td key={day} className="teacher-view-cell">
                                        {lessons.map((lesson, index) => (
                                            <div key={index}>{lesson}</div>
                                        ))}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}