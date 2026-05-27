import { useDraggable, useDroppable } from "@dnd-kit/core";

export default function DroppableCell({
  className,
  hour,
  teacher,
  teacherId,
  conflict,
  selected,
  highlighted,
  displayMode,
  onClick,
  unit,
  group,
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
      source: "cell",
      fromClass: className,
      fromHour: String(hour),
      unitId: unit?.id,
    },
    disabled: !teacherId,
  });

  const style = {
    transform: transform
      ? `translate(${transform.x}px, ${transform.y}px)`
      : undefined,
  };

  const teacherStyle = {
    transform: transform
      ? `translate(${transform.x}px, ${transform.y}px)`
      : undefined,
    backgroundColor: group?.color || undefined,
  };

  return (
    <td
      ref={setDroppableRef}
      className={[
        conflict ? "conflict" : "",
        selected ? "selected-cell" : "",
        highlighted ? "highlighted-cell" : "",
      ].join(" ")}
      onMouseDown={onClick}
    >
      {teacher ? (
        <div
          ref={setDraggableRef}
          style={teacherStyle}
          {...listeners}
          {...attributes}
          className="cell-teacher"
        >
          {displayMode === "names"
            ? unit?.subject && unit.subject !== "רגיל"
              ? `${teacher.name} / ${unit.subject}`
              : group
                ? `${teacher.name} [${group.name}]`
                : teacher.name
            : teacherId}
        </div>
      ) : null}
    </td>
  );
}
