import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { getReadableTextColor } from "../utils/colorUtils";

export default function LoadItem({
  unit,
  teacher,
  remaining,
  placements,
  displayMode,
  isFreeDay,
  group,
  highlightedGroup,
  onAssignGroup,
  onHighlightGroup,
  teacherHighlight,
  selectedLoadUnitId,
  onSelectLoadUnit,
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `load-${unit.id}`,
    data: {
      source: "load",
      className: unit.className,
      unitId: unit.id,
    },
    disabled: remaining <= 0 || isFreeDay,
  });

  const backgroundColor = group?.color || undefined;

  const style = {
    transform: transform
      ? `translate(${transform.x}px, ${transform.y}px)`
      : undefined,
    backgroundColor,
    color: getReadableTextColor(backgroundColor),
    borderColor: teacherHighlight?.color,
  };

  const label =
    displayMode === "names"
      ? unit.subject && unit.subject !== "רגיל"
        ? `${teacher?.name} / ${unit.subject}`
        : teacher?.name
      : unit.teacherId;

  const tooltipText =
    placements.length > 0 ? placements.join(", ") : "אין שיבוצים עדיין";

  return (
    <div
      className="load-item-wrapper"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onMouseDown={() => setShowTooltip(false)}
        onClick={() => {
          onSelectLoadUnit(unit.id);
          setShowTooltip(false);
          if (unit.constraintGroupId) {
            onHighlightGroup(unit.constraintGroupId);
          }
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          setShowTooltip(false);
          onAssignGroup(unit);
        }}
        className={[
          "load-item",
          remaining <= 0 ? "load-item-empty" : "",
          isFreeDay ? "load-item-free-day" : "",
          highlightedGroup ? "group-highlight" : "",
          teacherHighlight ? "teacher-search-highlight" : "",
          selectedLoadUnitId === unit.id ? "selected-load-item" : "",
        ].join(" ")}
      >
        <span className="load-teacher-code">{label}</span>
        <span className="load-count">
          {" "}
          ({remaining}/{unit.hours})
        </span>
      </div>

      {showTooltip && (
        <div className="load-tooltip">
          {tooltipText}
        </div>
      )}
    </div>
  );
}