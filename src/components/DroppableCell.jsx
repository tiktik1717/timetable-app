import { useDraggable, useDroppable } from "@dnd-kit/core";
import { getReadableTextColor } from "../utils/colorUtils";

export default function DroppableCell({
  className,
  hour,
  units,
  teachersByUnit,
  groupsByUnit,
  conflictingTeacherIds,
  selected,
  highlighted,
  displayMode,
  onClick,
  highlightedUnitIds,
  blocked,
  teacherHighlightsByUnit,
}) {
  const cellId = `${className}-${hour}`;

  const { setNodeRef: setDroppableRef } = useDroppable({
    id: cellId,
    disabled: blocked,
  });

  const firstUnit = units[0];

  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
  } = useDraggable({
    id: `cell-${className}-${hour}`,
    data: {
      source: "cell",
      fromClass: className,
      fromHour: String(hour),
      unitIds: units.map((unit) => unit.id),
    },
    disabled: blocked || units.length === 0,
  });

  const teacherStyle = {
    transform: transform
      ? `translate(${transform.x}px, ${transform.y}px)`
      : undefined,
  };

  const hasConflict = conflictingTeacherIds.length > 0;

  return (
    <td
      ref={setDroppableRef}
      className={[
        hasConflict ? "conflict" : "",
        selected ? "selected-cell" : "",
        highlighted ? "highlighted-cell" : "",
        blocked ? "blocked-cell" : "",
      ].join(" ")}
      onMouseDown={onClick}
    >
      {!blocked && units.length > 0 && (
        <div
          ref={setDraggableRef}
          style={teacherStyle}
          {...listeners}
          {...attributes}
          className="cell-stack"
        >
          {units.map((unit) => {
            const teacherHighlight = teacherHighlightsByUnit?.[unit.id];
            const teacher = teachersByUnit[unit.id];
            const group = groupsByUnit[unit.id];
            const isHighlighted = highlightedUnitIds?.has(unit.id);
            const isConflicting = conflictingTeacherIds.includes(
              unit.teacherId
            );
            const backgroundColor = group?.color || undefined;
            return (
              <div
                key={unit.id}
                data-unit-id={unit.id}
                className={[
                  "cell-teacher",
                  isConflicting ? "cell-teacher-conflict" : "",
                  isHighlighted ? "group-highlight" : "",
                  teacherHighlight ? "teacher-search-highlight" : "",
                ].join(" ")}
                style={{
                  backgroundColor,
                  color: getReadableTextColor(backgroundColor),
                  borderColor: teacherHighlight?.color,
                }}
              >
                {displayMode === "names"
                  ? unit.subject && unit.subject !== "רגיל"
                    ? `${teacher?.name} / ${unit.subject}`
                    : teacher?.name
                  : unit.teacherId}
              </div>
            );
          })}
        </div>
      )}
    </td>
  );
}