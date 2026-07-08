export default function FreeDaysView({ teachers, days }) {
    const teachersByDay = {};

    for (const day of days) {
        teachersByDay[day] = teachers
            .filter((teacher) => teacher.freeDays?.includes(day))
            .sort((a, b) => a.name.localeCompare(b.name, "he"));
    }

    const maxRows = Math.max(
        0,
        ...days.map((day) => teachersByDay[day].length)
    );

    return (
        <div className="free-days-view">
            <h2>חלוקת ימים חופשיים</h2>

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
                            <td key={day}>
                                {teachersByDay[day].length} מורים
                            </td>
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