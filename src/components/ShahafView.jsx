import { useEffect, useState } from "react";

export default function ShahafView({
    classes,
    days,
    selectedClassForShahaf,
    setSelectedClassForShahaf,
    getCellUnitIds,
    getUnitById,
    getTeacherById,
    getClassHoursForDay,
    isShahafCellChanged,
    activeCheckpoint,
    checkpoints,
    comparisonCheckpointId,
    setComparisonCheckpointId,
    comparisonCheckpoint,
    classHasShahafChanges,
}) {
    const maxHoursForClass = Math.max(
        0,
        ...days.map((day) => getClassHoursForDay(selectedClassForShahaf, day))
    );

    const visibleHours = Array.from(
        { length: maxHoursForClass },
        (_, index) => index + 1
    );

    const [showChangedClassesOnly, setShowChangedClassesOnly] = useState(false);

    const visibleClassesForShahaf =
        showChangedClassesOnly && comparisonCheckpointId
            ? classes.filter(classHasShahafChanges)
            : classes;

    const currentClassIndex = visibleClassesForShahaf.indexOf(
        selectedClassForShahaf
    );

    useEffect(() => {
        if (
            visibleClassesForShahaf.length > 0 &&
            !visibleClassesForShahaf.includes(selectedClassForShahaf)
        ) {
            setSelectedClassForShahaf(visibleClassesForShahaf[0]);
        }
    }, [showChangedClassesOnly, comparisonCheckpointId, classes]);

    function goToPreviousClass() {
        if (visibleClassesForShahaf.length === 0) return;

        const index = visibleClassesForShahaf.indexOf(selectedClassForShahaf);
        const nextIndex =
            index <= 0 ? visibleClassesForShahaf.length - 1 : index - 1;

        setSelectedClassForShahaf(visibleClassesForShahaf[nextIndex]);
    }

    function goToNextClass() {
        if (visibleClassesForShahaf.length === 0) return;

        const index = visibleClassesForShahaf.indexOf(selectedClassForShahaf);
        const nextIndex =
            index === -1 || index >= visibleClassesForShahaf.length - 1
                ? 0
                : index + 1;

        setSelectedClassForShahaf(visibleClassesForShahaf[nextIndex]);
    }

    return (
        <div className="shahaf-view">
            <div className="shahaf-header">
                <h3>תצוגת הזנה ידנית לשחף</h3>
                <label>
                    השווה מול:
                    <select
                        value={comparisonCheckpointId}
                        onChange={(e) => setComparisonCheckpointId(e.target.value)}
                    >
                        <option value="">ללא השוואה</option>

                        {checkpoints.map((checkpoint) => (
                            <option key={checkpoint.id} value={checkpoint.id}>
                                {checkpoint.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label>
                    כיתה:
                    <select
                        value={selectedClassForShahaf}
                        onChange={(e) => setSelectedClassForShahaf(e.target.value)}
                    >
                        {visibleClassesForShahaf.map((className) => (
                            <option key={className} value={className}>
                                {className}
                            </option>
                        ))}
                    </select>
                </label>

                <button type="button" className="mini-button" onClick={goToPreviousClass}>
                    הקודם
                </button>

                <button type="button" className="mini-button" onClick={goToNextClass}>
                    הבא
                </button>

                <label className="inline-checkbox">
                    <input
                        type="checkbox"
                        checked={showChangedClassesOnly}
                        disabled={!comparisonCheckpointId}
                        onChange={(e) => setShowChangedClassesOnly(e.target.checked)}
                    />
                    הצג כיתות ששונו בלבד
                </label>
            </div>

            <table className="shahaf-table">
                <thead>
                    <tr>
                        <th>שעה</th>
                        {days.map((day) => (
                            <th key={day}>יום {day}</th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {visibleHours.map((hour) => (
                        <tr key={hour}>
                            <td className="shahaf-hour">שעה {hour}</td>

                            {days.map((day) => {
                                const isBlocked =
                                    hour > getClassHoursForDay(selectedClassForShahaf, day);

                                if (isBlocked) {
                                    return <td key={day} className="blocked-cell"></td>;
                                }

                                const unitIds = getCellUnitIds(
                                    day,
                                    selectedClassForShahaf,
                                    hour
                                );

                                const teachers = unitIds
                                    .map(getUnitById)
                                    .filter(Boolean)
                                    .map((unit) => getTeacherById(unit.teacherId)?.name)
                                    .filter(Boolean);

                                const changed = isShahafCellChanged?.(
                                    day,
                                    selectedClassForShahaf,
                                    hour
                                );

                                return (
                                    <td
                                        key={day}
                                        className={[
                                            "shahaf-cell",
                                            changed ? "changed-cell" : "",
                                        ].join(" ")}
                                    >
                                        {teachers.map((teacherName, index) => (
                                            <div key={index}>{teacherName}</div>
                                        ))}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}