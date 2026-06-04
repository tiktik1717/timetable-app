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
    setSchoolData,
    isTeacherFreeDay,
    isTeacherBlockedHour,
    removeTeacherFromSpecificTime,
}) {
    const selectedTeacher = teachers.find(
        (teacher) => teacher.id === selectedTeacherForView
    );

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

    function toggleBlockedHour(day, hour) {
        if (!selectedTeacherForView) return;

        if (isTeacherFreeDay(selectedTeacherForView, day)) {
            return;
        }
        const wasBlocked = isTeacherBlockedHour(selectedTeacherForView, day, hour);
        setSchoolData((prev) => ({
            ...prev,
            teachers: prev.teachers.map((teacher) => {
                if (teacher.id !== selectedTeacherForView) return teacher;

                const blockedHours = { ...(teacher.blockedHours || {}) };
                const dayHours = blockedHours[day] || [];

                const hourNumber = Number(hour);

                blockedHours[day] = dayHours.includes(hourNumber)
                    ? dayHours.filter((h) => h !== hourNumber)
                    : [...dayHours, hourNumber].sort((a, b) => a - b);

                return {
                    ...teacher,
                    blockedHours,
                };
            }),
        }));
        if (!wasBlocked) {
            const result = removeTeacherFromSpecificTime(
                selectedTeacherForView,
                day,
                hour
            );

            if (result.removedCount > 0) {
                const groupsText =
                    result.removedGroups.length > 0
                        ? `\nהוסרו גם קבוצות: ${result.removedGroups.join(", ")}`
                        : "";

                alert(
                    `בעקבות חסימת השעה הוסרו ${result.removedCount} שיבוץ/ים.${groupsText}`
                );
            }
        }
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

            <div className="teacher-view-note">
                לחיצה על תא פנוי מסמנת/מבטלת שעה חסומה למורה. ימים חופשיים מנוהלים במסך ניהול מורים בלבד.
            </div>

            <table className="teacher-view-table">
                <thead>
                    <tr>
                        <th>שעה</th>
                        {days.map((day) => (
                            <th
                                key={day}
                                className={
                                    isTeacherFreeDay(selectedTeacherForView, day)
                                        ? "teacher-free-day-header"
                                        : ""
                                }
                            >
                                יום {day}
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {visibleHours.map((hour) => (
                        <tr key={hour}>
                            <td className="teacher-view-hour">שעה {hour}</td>

                            {days.map((day) => {
                                const lessons = getTeacherLessons(day, hour);
                                const isFreeDay = isTeacherFreeDay(selectedTeacherForView, day);
                                const isBlocked = isTeacherBlockedHour(
                                    selectedTeacherForView,
                                    day,
                                    hour
                                );

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
                                            isFreeDay ? "teacher-free-day-cell" : "",
                                            isBlocked ? "teacher-blocked-hour-cell" : "",
                                        ].join(" ")}
                                        onClick={() => toggleBlockedHour(day, hour)}
                                        title={
                                            isFreeDay
                                                ? "יום חופשי — ניתן לשינוי במסך ניהול מורים"
                                                : isBlocked
                                                    ? "שעה חסומה — לחץ לביטול"
                                                    : "לחץ כדי לחסום שעה זו"
                                        }
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