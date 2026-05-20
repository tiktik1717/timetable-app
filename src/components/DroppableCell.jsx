import { useDraggable, useDroppable } from "@dnd-kit/core";

export default function DroppableCell({
  className,
  hour,
  teacher,
  teacherId,
  conflict,
  selected,
  onClick,
}) {
  const cellId = `${className}-${hour}`;

  const { setNodeRef: setDroppableRef } = useDroppable({
    id: cellId,
  });

  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
  } = useDraggable({
    id: `cell-${className}-${hour}`,
    data: {
      fromClass: className,
      fromHour: String(hour),
      teacherId,
    },
    disabled: !teacherId,
  });

  const style = {
    transform: transform
      ? `translate(${transform.x}px, ${transform.y}px)`
      : undefined,
  };

  return (
    <td
      ref={setDroppableRef}
      className={[
        conflict ? "conflict" : "",
        selected ? "selected-cell" : "",
      ].join(" ")}
      onClick={onClick}
    >
      {teacher ? (
        <div
          ref={setDraggableRef}
          style={style}
          {...listeners}
          {...attributes}
          className="cell-teacher"
        >
          {teacher.name}
        </div>
      ) : null}
    </td>
  );
}