import { useState } from "react";

export default function SadinSheetEditor({
    sheetRows,
    teachers,
    classes,
    onUpdateRows,
}) {
    const sortedSheetRows = [...sheetRows].sort((a, b) =>
        (a.teacherName || "").localeCompare(b.teacherName || "", "he")
    );
    const [sadinSearchText, setSadinSearchText] = useState("");
    const [sadinSearchField, setSadinSearchField] = useState("all");
    function updateRow(index, field, value) {
        const nextRows = sheetRows.map((row, rowIndex) =>
            rowIndex === index ? { ...row, [field]: value } : row
        );

        onUpdateRows(nextRows);
    }

    function normalizeSearch(value) {
        return String(value || "").trim().toLowerCase();
    }

    function rowMatchesSearch(row) {
        const search = normalizeSearch(sadinSearchText);

        if (!search) return true;

        const fields = {
            teacherName: row.teacherName,
            subject: row.subject,
            className: row.className,
            notes: row.notes,
        };

        if (sadinSearchField === "all") {
            return Object.values(fields).some((value) =>
                normalizeSearch(value).includes(search)
            );
        }

        return normalizeSearch(fields[sadinSearchField]).includes(search);
    }

    function addRow() {
        const newRow = {
            teacherId: "",
            teacherName: "",
            subject: "",
            className: "",
            hours: 1,
            notes: "",
        };

        onUpdateRows([...sheetRows, newRow]);
    }

    function deleteRow(index) {
        if (!confirm("למחוק את השורה?")) return;

        onUpdateRows(sheetRows.filter((_, rowIndex) => rowIndex !== index));
    }

    const filteredSadinRows = sortedSheetRows.filter(rowMatchesSearch);
    return (
        <div className="sadin-editor">
            <div className="manager-header">
                <h3>גליון סדין</h3>

                <button
                    type="button"
                    className="action-button"
                    onClick={addRow}
                >
                    הוסף שורה
                </button>

                <div className="sadin-search-box">
                    <label>
                        חפש לפי:
                        <select
                            value={sadinSearchField}
                            onChange={(e) => setSadinSearchField(e.target.value)}
                        >
                            <option value="all">הכל</option>
                            <option value="teacherName">מורה</option>
                            <option value="subject">מקצוע</option>
                            <option value="className">כיתה</option>
                            <option value="notes">הערות</option>
                        </select>
                    </label>

                    <input
                        type="text"
                        value={sadinSearchText}
                        onChange={(e) => setSadinSearchText(e.target.value)}
                        placeholder="הקלד מילת חיפוש..."
                    />

                    {sadinSearchText && (
                        <button
                            type="button"
                            className="mini-button"
                            onClick={() => setSadinSearchText("")}
                        >
                            נקה
                        </button>
                    )}

                    <span className="sadin-search-count">
                        {filteredSadinRows.length} מתוך {sheetRows.length}
                    </span>
                </div>
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
                    {filteredSadinRows.map((row) => {
                        const index = sheetRows.indexOf(row);

                        return (
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
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}