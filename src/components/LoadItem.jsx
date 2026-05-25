import { useDraggable } from "@dnd-kit/core";

export default function LoadItem({
  className,
  teacherId,
  teacher,
  remaining,
  placements,
  displayMode,
  isFreeDay,
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `load-${className}-${teacherId}`,
    data: {
      source: "load",
      className,
      teacherId,
    },
    disabled: remaining <= 0 || isFreeDay,
  });

  const style = {
    transform: transform
      ? `translate(${transform.x}px, ${transform.y}px)`
      : undefined,
  };

  const label = displayMode === "names" ? teacher?.name : teacherId;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={[
        "load-item",
        remaining <= 0 ? "load-item-empty" : "",
        isFreeDay ? "load-item-free-day" : "",
      ].join(" ")}
    >
      <span className="load-teacher-code">{label}</span>
      <span className="load-count"> × {remaining}</span>

      {placements.length > 0 && (
        <span className="load-placements">
          {" "}
          ({placements.join(", ")})
        </span>
      )}
    </div>
  );
}