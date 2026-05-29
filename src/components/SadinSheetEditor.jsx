export default function SadinSheetEditor({
    sheetRows,
    teachers,
    classes,
    onUpdateRows,
}) {
    function updateRow(index, field, value) {
        const nextRows = sheetRows.map((row, rowIndex) =>
            rowIndex === index ? { ...row, [field]: value } : row
        );

        onUpdateRows(nextRows);
    }

    function addRow() {
        const firstTeacher = teachers[0];

        const newRow = {
            teacherId: firstTeacher?.id || "",
            teacherName: firstTeacher?.name || "",
            subject: "רגיל",
            className: classes[0] || "",
            hours: 1,
            notes: "",
        };

        onUpdateRows([...sheetRows, newRow]);
    }

    function deleteRow(index) {
        if (!confirm("למחוק את השורה?")) return;

        onUpdateRows(sheetRows.filter((_, rowIndex) => rowIndex !== index));
    }

    return (
        <div className="sadin-editor">
            <div className="manager-header">
                <h3>גליון סדין</h3>

                <button className="action-button" onClick={addRow}>
                    הוסף שורה
                </button>
            </div>

            <table className="manager-table sadin-table">
                <thead>
                    <tr>
                        <th>שם המורה</th>
                        <th>מקצוע</th>
                        <th>כיתה</th>
                        <th>מספר שעות</th>
                        <th>הערות</th>
                        <th>פעולות</th>
                    </tr>
                </thead>

                <tbody>
                    {sheetRows.map((row, index) => (
                        <tr key={index}>
                            <td>
                                <select
                                    value={row.teacherId}
                                    onChange={(e) => {
                                        const teacher = teachers.find(
                                            (t) => t.id === e.target.value
                                        );

                                        const nextRows = sheetRows.map((r, rowIndex) =>
                                            rowIndex === index
                                                ? {
                                                    ...r,
                                                    teacherId: teacher?.id || "",
                                                    teacherName: teacher?.name || "",
                                                }
                                                : r
                                        );

                                        onUpdateRows(nextRows);
                                    }}
                                >
                                    <option value="">בחר מורה</option>

                                    {teachers.map((teacher) => (
                                        <option key={teacher.id} value={teacher.id}>
                                            {teacher.name}
                                        </option>
                                    ))}
                                </select>
                            </td>

                            <td>
                                <input
                                    value={row.subject || ""}
                                    onChange={(e) =>
                                        updateRow(index, "subject", e.target.value)
                                    }
                                />
                            </td>

                            <td>
                                <select
                                    value={row.className}
                                    onChange={(e) =>
                                        updateRow(index, "className", e.target.value)
                                    }
                                >
                                    <option value="">בחר כיתה</option>

                                    {classes.map((className) => (
                                        <option key={className} value={className}>
                                            {className}
                                        </option>
                                    ))}
                                </select>
                            </td>

                            <td>
                                <input
                                    className="small-number-input"
                                    type="number"
                                    min="0"
                                    value={row.hours}
                                    onChange={(e) =>
                                        updateRow(index, "hours", Number(e.target.value) || 0)
                                    }
                                />
                            </td>

                            <td>
                                <input
                                    value={row.notes || ""}
                                    onChange={(e) =>
                                        updateRow(index, "notes", e.target.value)
                                    }
                                />
                            </td>

                            <td>
                                <button
                                    className="mini-button danger-mini-button"
                                    onClick={() => deleteRow(index)}
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