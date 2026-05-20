import { useDraggable } from "@dnd-kit/core";

export default function DraggableTeacher({ teacher }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: teacher.id,
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
      className="teacher-card"
    >
      {teacher.name}
    </div>
  );
}