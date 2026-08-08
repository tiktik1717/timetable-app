import { useState } from "react";

const SEARCH_FIELDS = [
    { value: "all", label: "הכל" },
    { value: "teacherName", label: "מורה" },
    { value: "subject", label: "מקצוע" },
    { value: "className", label: "כיתה" },
    { value: "notes", label: "הערות" },
];

export default function SadinSheetEditor({
    sheetRows,
    teachers,
    classes,
    onUpdateRows,
}) {
    const [firstSearchText, setFirstSearchText] = useState("");
    const [firstSearchField, setFirstSearchField] = useState("all");
    const [secondSearchText, setSecondSearchText] = useState("");
    const [secondSearchField, setSecondSearchField] = useState("all");

    const sortedSheetRows = [...sheetRows].sort((a, b) => {
        const teacherComparison = (a.teacherName || "").localeCompare(
            b.teacherName || "",
            "he"
        );

        if (teacherComparison !== 0) return teacherComparison;

        return (a.className || "").localeCompare(
            b.className || "",
            "he",
            { numeric: true }
        );
    });

    function updateRow(index, field, value) {
        const nextRows = sheetRows.map((row, rowIndex) =>
            rowIndex === index ? { ...row, [field]: value } : row
        );

        onUpdateRows(nextRows);
    }

    function normalizeSearch(value) {
        return String(value || "").trim().toLowerCase();
    }

    function matchesCriterion(row, field, text) {
        const search = normalizeSearch(text);
        if (!search) return true;

        const fields = {
            teacherName: row.teacherName,
            subject: row.subject,
            className: row.className,
            notes: row.notes,
        };

        if (field === "all") {
            return Object.values(fields).some((value) =>
                normalizeSearch(value).includes(search)
            );
        }

        return normalizeSearch(fields[field]).includes(search);
    }

    function rowMatchesSearch(row) {
        return (
            matchesCriterion(row, firstSearchField, firstSearchText) &&
            matchesCriterion(row, secondSearchField, secondSearchText)
        );
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

    function clearSearches() {
        setFirstSearchText("");
        setSecondSearchText("");
    }

    const filteredSadinRows = sortedSheetRows.filter(rowMatchesSearch);
    const hasAnySearch = firstSearchText || secondSearchText;

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

                <div className="sadin-search-box sadin-double-search">
                    <div className="sadin-search-criterion">
                        <label>
                            חיפוש ראשון:
                            <select
                                value={firstSearchField}
                                onChange={(e) => setFirstSearchField(e.target.value)}
                            >
                                {SEARCH_FIELDS.map((field) => (
                                    <option key={field.value} value={field.value}>
                                        {field.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <input
                            type="text"
                            value={firstSearchText}
                            onChange={(e) => setFirstSearchText(e.target.value)}
                            placeholder="הקלד מילת חיפוש..."
                        />
                    </div>

                    <div className="sadin-search-criterion">
                        <label>
                            חיפוש שני:
                            <select
                                value={secondSearchField}
                                onChange={(e) => setSecondSearchField(e.target.value)}
                            >
                                {SEARCH_FIELDS.map((field) => (
                                    <option key={field.value} value={field.value}>
                                        {field.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <input
                            type="text"
                            value={secondSearchText}
                            onChange={(e) => setSecondSearchText(e.target.value)}
                            placeholder="הקלד מילת חיפוש נוספת..."
                        />
                    </div>

                    {hasAnySearch && (
                        <button
                            type="button"
                            className="mini-button"
                            onClick={clearSearches}
                        >
                            נקה חיפושים
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

                <tbody>{filteredSadinRows.map((row) => {
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

                                    {[...teachers]
                                        .sort((a, b) =>
                                            (a.name || "").localeCompare(b.name || "", "he")
                                        )
                                        .map((teacher) => (
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
                })}</tbody>
            </table>
        </div>
    );
}
