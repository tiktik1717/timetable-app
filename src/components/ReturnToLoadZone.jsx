import { useDroppable } from "@dnd-kit/core";

export default function ReturnToLoadZone() {
  const { setNodeRef, isOver } = useDroppable({
    id: "return-to-load",
  });

  return (
    <div
      ref={setNodeRef}
      className={isOver ? "return-zone return-zone-over" : "return-zone"}
    >
      גרור לכאן כדי להחזיר למחסן
    </div>
  );
}