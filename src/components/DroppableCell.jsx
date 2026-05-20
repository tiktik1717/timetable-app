import { useDroppable } from "@dnd-kit/core";

export default function DroppableCell({ className, hour, teacher, conflict }) {
  const { setNodeRef } = useDroppable({
    id: `${className}-${hour}`,
  });

  return (
    <td ref={setNodeRef} className={conflict ? "conflict" : ""}>
      {teacher ? teacher.name : ""}
    </td>
  );
}