function countByType(warnings, type) {
    return warnings.filter((w) => w.type === type).length;
}

export default function WarningsPanel({ warnings, selectedDay }) {
    const currentDayWarnings = warnings.filter((w) => w.day === selectedDay);

    return (
        <div className="warnings-panel">
            <strong>מרכז אזהרות:</strong>

            <span>
                היום — מורה: {countByType(currentDayWarnings, "teacherConflict")}
            </span>

            <span>
                היום — אותו טור: {countByType(currentDayWarnings, "notSameTime")}
            </span>

            <span>
                היום — אותה שורה:{" "}
                {countByType(currentDayWarnings, "notSameDaySameClass")}
            </span>

            <span className="warnings-divider">|</span>

            <span>שבוע — מורה: {countByType(warnings, "teacherConflict")}</span>

            <span>שבוע — אותו טור: {countByType(warnings, "notSameTime")}</span>

            <span>
                שבוע — אותה שורה: {countByType(warnings, "notSameDaySameClass")}
            </span>

            {warnings.length === 0 && <span className="no-warnings">אין אזהרות</span>}
        </div>
    );
}