export default function ShahafView({
    classes,
    days,
    hours,
    selectedClassForShahaf,
    setSelectedClassForShahaf,
    getCellUnitIds,
    getUnitById,
    getTeacherById,
}) {
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
                    {hours.map((hour) => (
                        <tr key={hour}>
                            <td className="shahaf-hour">שעה {hour}</td>

                            {days.map((day) => {
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
                                        {teachers.length === 0
                                            ? ""
                                            : teachers.map((teacherName, index) => (
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