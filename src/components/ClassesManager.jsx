export default function ClassesManager({
    classes,
    teachers,
    setSchoolData,
    homeroomTeacherColor,
}) {
    const sortedClasses = [...classes].sort((a, b) =>
        a.localeCompare(b, "he")
    );

    function getClassTeacher(className) {
        const teacher = teachers.find(
            (teacher) => teacher.educationClass === className
        );

        return teacher?.id || "";
    }

    function updateClassName(oldClassName, newClassName) {
        const cleanName = newClassName.trim();

        if (!cleanName) {
            alert("שם כיתה לא יכול להיות ריק");
            return;
        }

        setSchoolData((prev) => ({
            ...prev,

            classes: prev.classes.map((className) =>
                className === oldClassName ? cleanName : className
            ),

            teachingUnits: prev.teachingUnits.map((unit) =>
                unit.className === oldClassName
                    ? { ...unit, className: cleanName }
                    : unit
            ),

            teachingLoads: Object.fromEntries(
                Object.entries(prev.teachingLoads || {}).map(([className, loads]) => [
                    className === oldClassName ? cleanName : className,
                    loads,
                ])
            ),

            teachers: prev.teachers.map((teacher) =>
                teacher.educationClass === oldClassName
                    ? { ...teacher, educationClass: cleanName }
                    : teacher
            ),
        }));
    }

    function setClassTeacher(className, teacherId) {
        setSchoolData((prev) => ({
            ...prev,
            teachers: prev.teachers.map((teacher) => {
                if (teacher.educationClass === className) {
                    return { ...teacher, educationClass: "" };
                }

                if (teacher.id === teacherId) {
                    return { ...teacher, educationClass: className };
                }

                return teacher;
            }),
        }));
    }

    function addClass() {
        const className = prompt("הכנס שם כיתה חדשה");

        if (!className || className.trim() === "") {
            alert("שם כיתה לא יכול להיות ריק");
            return;
        }

        const cleanName = className.trim();

        setSchoolData((prev) => {
            if (prev.classes.includes(cleanName)) {
                alert("כיתה בשם זה כבר קיימת");
                return prev;
            }

            return {
                ...prev,
                classes: [...prev.classes, cleanName],
                teachingLoads: {
                    ...(prev.teachingLoads || {}),
                    [cleanName]: {},
                },
            };
        });
    }

    function deleteClass(className) {
        if (!confirm(`למחוק את הכיתה ${className}?`)) return;

        setSchoolData((prev) => {
            const newTeachingLoads = { ...(prev.teachingLoads || {}) };
            delete newTeachingLoads[className];

            return {
                ...prev,
                classes: prev.classes.filter((name) => name !== className),
                teachingUnits: prev.teachingUnits.filter(
                    (unit) => unit.className !== className
                ),
                teachingLoads: newTeachingLoads,
                teachers: prev.teachers.map((teacher) =>
                    teacher.educationClass === className
                        ? { ...teacher, educationClass: "" }
                        : teacher
                ),
            };
        });
    }

    return (
        <div className="classes-manager">
            <div className="manager-header">
                <h3>ניהול כיתות</h3>

                <button className="action-button" onClick={addClass}>
                    הוסף כיתה
                </button>
            </div>

            <label className="homeroom-color-picker">
                צבע מחנך/ת:
                <input
                    type="color"
                    value={homeroomTeacherColor || "#c8e6c9"}
                    onChange={(e) =>
                        setSchoolData((prev) => ({
                            ...prev,
                            homeroomTeacherColor: e.target.value,
                        }))
                    }
                />
            </label>

            <table className="manager-table">
                <thead>
                    <tr>
                        <th>שם כיתה</th>
                        <th>מחנך/ת</th>
                        <th>פעולות</th>
                    </tr>
                </thead>

                <tbody>
                    {sortedClasses.map((className) => (
                        <tr key={className}>
                            <td>
                                <input
                                    defaultValue={className}
                                    onBlur={(e) =>
                                        updateClassName(className, e.target.value)
                                    }
                                />
                            </td>

                            <td>
                                <select
                                    value={getClassTeacher(className)}
                                    onChange={(e) =>
                                        setClassTeacher(className, e.target.value)
                                    }
                                >
                                    <option value="">ללא מחנך</option>

                                    {teachers.map((teacher) => (
                                        <option key={teacher.id} value={teacher.id}>
                                            {teacher.name}
                                        </option>
                                    ))}
                                </select>
                            </td>

                            <td>
                                <button
                                    className="mini-button danger-mini-button"
                                    onClick={() => deleteClass(className)}
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