export default function ShahafView({
    classes,
    days,
    selectedClassForShahaf,
    setSelectedClassForShahaf,
    getCellUnitIds,
    getUnitById,
    getTeacherById,
    getClassHoursForDay,
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

                                return (
                                    <td key={day} className="shahaf-cell">
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