export default function TeacherView({
    teachers,
    classes,
    days,
    selectedTeacherForView,
    setSelectedTeacherForView,
    getCellUnitIds,
    getUnitById,
    getClassHoursForDay,
    checkpoints,
    comparisonCheckpointId,
    setComparisonCheckpointId,
    isTeacherCellChanged,
}) {
    function getTeacherLessons(day, hour) {
        const lessons = [];

        for (const className of classes) {
            if (hour > getClassHoursForDay(className, day)) continue;

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

    const maxHoursForAllClasses = Math.max(
        0,
        ...days.map((day) =>
            Math.max(
                0,
                ...classes.map((className) => getClassHoursForDay(className, day))
            )
        )
    );

    const visibleHours = Array.from(
        { length: maxHoursForAllClasses },
        (_, index) => index + 1
    );

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

                <label>
                    השווה מול:
                    <select
                        value={comparisonCheckpointId}
                        onChange={(e) => setComparisonCheckpointId(e.target.value)}
                    >
                        <option value="">ללא השוואה</option>

                        {checkpoints.map((checkpoint) => (
                            <option key={checkpoint.id} value={checkpoint.id}>
                                {checkpoint.name}
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
                    {visibleHours.map((hour) => (
                        <tr key={hour}>
                            <td className="teacher-view-hour">שעה {hour}</td>

                            {days.map((day) => {
                                const lessons = getTeacherLessons(day, hour);

                                const changed = isTeacherCellChanged?.(
                                    selectedTeacherForView,
                                    day,
                                    hour
                                );

                                return (
                                    <td
                                        key={day}
                                        className={[
                                            "teacher-view-cell",
                                            changed ? "changed-cell" : "",
                                        ].join(" ")}
                                    >
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