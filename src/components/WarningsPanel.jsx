export default function WarningsPanel({ warnings }) {
    const teacherWarnings = warnings.filter((w) => w.type === "teacherConflict");
    const sameTimeWarnings = warnings.filter((w) => w.type === "notSameTime");
    const sameDayWarnings = warnings.filter(
        (w) => w.type === "notSameDaySameClass"
    );

    return (
        <div className="warnings-panel">
            <strong>מרכז אזהרות:</strong>

            <span>התנגשויות מורה: {teacherWarnings.length}</span>
            <span>אסור באותו טור: {sameTimeWarnings.length}</span>
            <span>אסור באותה שורה: {sameDayWarnings.length}</span>

            {warnings.length === 0 && <span className="no-warnings">אין אזהרות</span>}
        </div>
    );
}