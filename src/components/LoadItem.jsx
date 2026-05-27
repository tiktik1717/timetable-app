import { useDraggable } from "@dnd-kit/core";

export default function LoadItem({
  unit,
  teacher,
  remaining,
  placements,
  displayMode,
  isFreeDay,
  group,
  onAssignGroup,
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `load-${unit.id}`,
    data: {
      source: "load",
      className: unit.className,
      unitId: unit.id,
    },
    disabled: remaining <= 0 || isFreeDay,
  });

  const style = {
    transform: transform
      ? `translate(${transform.x}px, ${transform.y}px)`
      : undefined,
    backgroundColor: group?.color || undefined,
  };

  const label =
    displayMode === "names"
      ? unit.subject && unit.subject !== "רגיל"
        ? `${teacher?.name} / ${unit.subject}`
        : teacher?.name
      : unit.teacherId;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onContextMenu={(event) => {
        event.preventDefault();
        onAssignGroup(unit);
      }}
      className={[
        "load-item",
        remaining <= 0 ? "load-item-empty" : "",
        isFreeDay ? "load-item-free-day" : "",
      ].join(" ")}
    >
      <span className="load-teacher-code">{label}</span>
      <span className="load-count"> × {remaining}</span>

      {placements.length > 0 && (
        <span className="load-placements"> ({placements.join(", ")})</span>
      )}
    </div>
  );
}