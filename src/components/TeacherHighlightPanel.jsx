const DEFAULT_COLORS = ["#1976d2", "#2e7d32", "#7b1fa2", "#f57c00"];

export default function TeacherHighlightPanel({
    teacherHighlights,
    setTeacherHighlights,
}) {
    function updateHighlight(index, updates) {
        setTeacherHighlights((prev) =>
            prev.map((item, itemIndex) =>
                itemIndex === index ? { ...item, ...updates } : item
            )
        );
    }

    return (
        <div className="teacher-highlight-panel">
            <strong>הדגשת מורים:</strong>

            {teacherHighlights.map((highlight, index) => (
                <div
                    key={index}
                    className="teacher-highlight-control"
                    style={{ borderColor: highlight.color }}
                >
                    <input
                        data-highlight-index={index}
                        value={highlight.query}
                        placeholder="קוד או שם"
                        onChange={(e) =>
                            updateHighlight(index, { query: e.target.value })
                        }
                    />

                    <input
                        className="teacher-highlight-color"
                        type="color"
                        value={highlight.color}
                        onChange={(e) =>
                            updateHighlight(index, { color: e.target.value })
                        }
                        onContextMenu={(e) => e.stopPropagation()}
                        title="שינוי צבע"
                    />
                </div>
            ))}
        </div>
    );
}

export function createDefaultTeacherHighlights() {
    return DEFAULT_COLORS.map((color) => ({
        query: "",
        color,
    }));
}