export default function TeachersManager({
    teachers,
    setSchoolData,
}) {
    const days = ["א", "ב", "ג", "ד", "ה", "ו"];

    function updateTeacher(teacherId, updates) {
        setSchoolData((prev) => ({
            ...prev,
            teachers: prev.teachers.map((teacher) =>
                teacher.id === teacherId
                    ? { ...teacher, ...updates }
                    : teacher
            ),
        }));
    }

    function toggleFreeDay(teacher, day) {
        const freeDays = teacher.freeDays || [];

        const nextFreeDays = freeDays.includes(day)
            ? freeDays.filter((freeDay) => freeDay !== day)
            : [...freeDays, day];

        updateTeacher(teacher.id, { freeDays: nextFreeDays });
    }

    return (
        <div className="teachers-manager">
            <h3>ניהול מורים</h3>

            <table className="manager-table">
                <thead>
                    <tr>
                        <th>קוד</th>
                        <th>שם מורה</th>
                        <th>ימים חופשיים</th>
                    </tr>
                </thead>

                <tbody>
                    {teachers.map((teacher) => (
                        <tr key={teacher.id}>
                            <td>{teacher.id}</td>

                            <td>
                                <input
                                    value={teacher.name}
                                    onChange={(e) =>
                                        updateTeacher(teacher.id, {
                                            name: e.target.value,
                                        })
                                    }
                                />
                            </td>

                            <td>
                                <div className="free-days-list">
                                    {days.map((day) => (
                                        <label key={day} className="free-day-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={teacher.freeDays?.includes(day) || false}
                                                onChange={() => toggleFreeDay(teacher, day)}
                                            />
                                            יום {day}
                                        </label>
                                    ))}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}