export default function ShahafView({
    classes,
    days,
    selectedClassForShahaf,
    setSelectedClassForShahaf,
    getCellUnitIds,
    getUnitById,
    getTeacherById,
    getClassHoursForDay,
    isShahafCellChanged,
    activeCheckpoint,
    checkpoints,
    comparisonCheckpointId,
    setComparisonCheckpointId,
    comparisonCheckpoint,
}) {
    const maxHoursForClass = Math.max(
        0,
        ...days.map((day) => getClassHoursForDay(selectedClassForShahaf, day))
    );

    const visibleHours = Array.from(
        { length: maxHoursForClass },
        (_, index) => index + 1
    );

    return (
        <div className="shahaf-view">
            <div className="shahaf-header">
                <h3>תצוגת הזנה ידנית לשחף</h3>
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
                {comparisonCheckpoint && (
                    <div className="comparison-note">
                        השוואה מול נקודת שמירה: {comparisonCheckpoint.name}
                    </div>
                )}
                <label>
                    כיתה:
                    <select
                        value={selectedClassForShahaf}
                        onChange={(e) => setSelectedClassForShahaf(e.target.value)}
                    >
                        {classes.map((className) => (
                            <option key={className} value={className}>
                                {className}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <table className="shahaf-table">
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
                            <td className="shahaf-hour">שעה {hour}</td>

                            {days.map((day) => {
                                const isBlocked =
                                    hour > getClassHoursForDay(selectedClassForShahaf, day);

                                if (isBlocked) {
                                    return <td key={day} className="blocked-cell"></td>;
                                }

                                const unitIds = getCellUnitIds(
                                    day,
                                    selectedClassForShahaf,
                                    hour
                                );

                                const teachers = unitIds
                                    .map(getUnitById)
                                    .filter(Boolean)
                                    .map((unit) => getTeacherById(unit.teacherId)?.name)
                                    .filter(Boolean);

                                const changed = isShahafCellChanged?.(
                                    day,
                                    selectedClassForShahaf,
                                    hour
                                );

                                return (
                                    <td
                                        key={day}
                                        className={[
                                            "shahaf-cell",
                                            changed ? "changed-cell" : "",
                                        ].join(" ")}
                                    >
                                        {teachers.map((teacherName, index) => (
                                            <div key={index}>{teacherName}</div>
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