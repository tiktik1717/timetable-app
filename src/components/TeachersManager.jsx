export default function TeachersManager({ teachers, setSchoolData, removeTeacherFromDay, }) {
    const days = ["א", "ב", "ג", "ד", "ה", "ו"];

    const sortedTeachers = [...teachers].sort((a, b) =>
        a.name.localeCompare(b.name, "he")
    );

    function updateTeacher(teacherId, updates) {
        setSchoolData((prev) => ({
            ...prev,
            teachers: prev.teachers.map((teacher) =>
                teacher.id === teacherId ? { ...teacher, ...updates } : teacher
            ),
        }));
    }

    function handleNameChange(teacherId, value) {
        if (value.trim() === "") {
            alert("שם מורה לא יכול להיות ריק");
            return;
        }

        updateTeacher(teacherId, { name: value });
    }

    function toggleFreeDay(teacher, day) {
        const freeDays = teacher.freeDays || [];
        const isAddingFreeDay = !freeDays.includes(day);

        if (isAddingFreeDay) {
            const confirmRemove = confirm(
                `הגדרת יום ${day} כיום חופשי תסיר את כל השיבוצים של ${teacher.name} ביום זה.\n\nהאם להמשיך?`
            );

            if (!confirmRemove) return;

            const result = removeTeacherFromDay(teacher.id, day);

            if (result.removedCount > 0) {
                const groupsText =
                    result.removedGroups.length > 0
                        ? `\nהוסרו גם קבוצות: ${result.removedGroups.join(", ")}`
                        : "";

                alert(
                    `הוסרו ${result.removedCount} שיבוץ/ים של ${teacher.name} ביום ${day}.${groupsText}`
                );
            }
        }

        const nextFreeDays = isAddingFreeDay
            ? [...freeDays, day]
            : freeDays.filter((freeDay) => freeDay !== day);

        updateTeacher(teacher.id, { freeDays: nextFreeDays });
    }

    function addTeacher() {
        const name = prompt("הכנס שם מורה חדש");

        if (!name || name.trim() === "") {
            alert("שם מורה לא יכול להיות ריק");
            return;
        }

        setSchoolData((prev) => {
            const maxId = Math.max(
                0,
                ...prev.teachers.map((teacher) => Number(teacher.id) || 0)
            );

            const newTeacher = {
                id: String(maxId + 1),
                name: name.trim(),
                freeDays: [],
            };

            return {
                ...prev,
                teachers: [...prev.teachers, newTeacher],
            };
        });
    }

    function deleteTeacher(teacherId) {
        if (!confirm("למחוק את המורה?")) return;

        setSchoolData((prev) => ({
            ...prev,
            teachers: prev.teachers.filter((teacher) => teacher.id !== teacherId),
            teachingUnits: prev.teachingUnits.filter(
                (unit) => unit.teacherId !== teacherId
            ),
        }));
    }

    return (
        <div className="teachers-manager">
            <div className="manager-header">
                <h3>ניהול מורים</h3>

                <button className="action-button" onClick={addTeacher}>
                    הוסף מורה
                </button>
            </div>

            <table className="manager-table">
                <thead>
                    <tr>
                        <th>קוד</th>
                        <th>שם מורה</th>
                        <th>ימים חופשיים</th>
                        <th>פעולות</th>
                    </tr>
                </thead>

                <tbody>
                    {sortedTeachers.map((teacher) => (
                        <tr key={teacher.id}>
                            <td>{teacher.id}</td>

                            <td>
                                <input
                                    value={teacher.name}
                                    onChange={(e) =>
                                        updateTeacher(teacher.id, { name: e.target.value })
                                    }
                                    onBlur={(e) => handleNameChange(teacher.id, e.target.value)}
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

                            <td>
                                <button
                                    className="mini-button danger-mini-button"
                                    onClick={() => deleteTeacher(teacher.id)}
                                >
                                    מחק
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}