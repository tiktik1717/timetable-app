import { useDraggable } from "@dnd-kit/core";

export default function LoadItem({ className, teacherId, teacher, remaining, displayMode }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `load-${className}-${teacherId}`,
    data: {
      source: "load",
      className,
      teacherId,
    },
  });

  const style = {
    transform: transform
      ? `translate(${transform.x}px, ${transform.y}px)`
      : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="load-item"
    >
      {displayMode === "names" ? teacher?.name : teacherId} × {remaining}
    </div>
  );
}