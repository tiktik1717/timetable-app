import { useDroppable } from "@dnd-kit/core";

export default function LoadCell({ className, children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `load-cell-${className}`,
    data: {
      source: "loadCell",
      className,
    },
  });

  return (
    <td
      ref={setNodeRef}
      className={isOver ? "load-cell load-cell-over" : "load-cell"}
    >
      {children}
    </td>
  );
}