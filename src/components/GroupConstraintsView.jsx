import { useEffect, useMemo, useState } from "react";

export default function GroupConstraintsView({
  constraintGroups,
  days,
  hours,
  isGroupBlockedAt,
  onToggleSlot,
  onSetAllSlots,
}) {
  const [selectedGroupId, setSelectedGroupId] = useState(
    constraintGroups[0]?.id || ""
  );

  useEffect(() => {
    if (
      constraintGroups.length > 0 &&
      !constraintGroups.some((group) => group.id === selectedGroupId)
    ) {
      setSelectedGroupId(constraintGroups[0].id);
    }

    if (constraintGroups.length === 0 && selectedGroupId) {
      setSelectedGroupId("");
    }
  }, [constraintGroups, selectedGroupId]);

  const selectedGroup = constraintGroups.find(
    (group) => group.id === selectedGroupId
  );

  const summary = useMemo(() => {
    if (!selectedGroup) return { allowed: 0, total: 0 };

    const total = days.length * hours.length;
    let blocked = 0;

    for (const day of days) {
      for (const hour of hours) {
        if (isGroupBlockedAt(selectedGroup.id, day, hour)) {
          blocked += 1;
        }
      }
    }

    return { allowed: total - blocked, total };
  }, [selectedGroup, days, hours, isGroupBlockedAt]);

  if (constraintGroups.length === 0) {
    return (
      <div className="group-constraints-view">
        <h3>אילוצי קבוצות</h3>
        <div className="group-constraints-empty">
          עדיין לא הוגדרו קבוצות שיבוץ. יש ליצור קבוצה בחלונית קבוצות השיבוץ
          במסך בונה המערכת.
        </div>
      </div>
    );
  }

  return (
    <div className="group-constraints-view">
      <div className="group-constraints-header">
        <h3>אילוצי קבוצות</h3>

        <label>
          קבוצת שיבוץ:
          <select
            value={selectedGroupId}
            onChange={(event) => setSelectedGroupId(event.target.value)}
          >
            {constraintGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>

        <span className="group-constraints-summary">
          {summary.allowed} מתוך {summary.total} משבצות מותרות
        </span>

        <button
          type="button"
          className="mini-button"
          onClick={() => onSetAllSlots(selectedGroupId, false)}
        >
          אפשר הכול
        </button>

        <button
          type="button"
          className="mini-button"
          onClick={() => onSetAllSlots(selectedGroupId, true)}
        >
          חסום הכול
        </button>
      </div>

      <div className="group-constraints-note">
        תא לבן הוא זמן מותר. תא שחור הוא זמן חסום. לחיצה על תא משנה את מצבו.
        כל יחידות ההוראה המשויכות לקבוצה כפופות להגבלה.
      </div>

      <table className="group-constraints-table">
        <thead>
          <tr>
            <th>שעה</th>
            {days.map((day) => (
              <th key={day}>יום {day}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {hours.map((hour) => (
            <tr key={hour}>
              <td className="group-constraints-hour">שעה {hour}</td>

              {days.map((day) => {
                const blocked = isGroupBlockedAt(
                  selectedGroupId,
                  day,
                  hour
                );

                return (
                  <td
                    key={day}
                    className={`group-constraints-cell ${
                      blocked ? "group-constraints-blocked" : ""
                    }`}
                    onClick={() =>
                      onToggleSlot(selectedGroupId, day, hour)
                    }
                    title={
                      blocked
                        ? "זמן חסום — לחץ כדי לאפשר"
                        : "זמן מותר — לחץ כדי לחסום"
                    }
                  >
                    {blocked ? "חסום" : "מותר"}
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
