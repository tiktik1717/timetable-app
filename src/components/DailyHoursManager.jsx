export default function DailyHoursManager({
    classes,
    days,
    dailyHoursByClass,
    setSchoolData,
}) {
    function updateDailyHours(className, day, value) {
        const hours = Math.max(0, Number(value) || 0);

        setSchoolData((prev) => ({
            ...prev,
            dailyHoursByClass: {
                ...(prev.dailyHoursByClass || {}),
                [className]: {
                    ...(prev.dailyHoursByClass?.[className] || {}),
                    [day]: hours,
                },
            },
        }));
    }

    return (
        <div className="daily-hours-manager">
            <h3>הגדרת שעות יומיות</h3>

            <table className="manager-table">
                <thead>
                    <tr>
                        <th>כיתה</th>
                        {days.map((day) => (
                            <th key={day}>יום {day}</th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {classes.map((className) => (
                        <tr key={className}>
                            <td className="class-name">{className}</td>

                            {days.map((day) => (
                                <td key={day}>
                                    <input
                                        className="daily-hours-input"
                                        type="number"
                                        min="0"
                                        max="12"
                                        value={dailyHoursByClass?.[className]?.[day] ?? 6}
                                        onChange={(e) =>
                                            updateDailyHours(className, day, e.target.value)
                                        }
                                    />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}