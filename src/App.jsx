import { useState } from "react";
import "./App.css";

import {
  DndContext,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";

const teachers = [
  { id: "1", name: "אוחנה תהילה" },
  { id: "2", name: "כהן רחל" },
  { id: "3", name: "לוי מיכל" },
];

const classes = ["א1", "א2", "ב1", "ב2"];

const hours = [1, 2, 3, 4, 5, 6];

function DraggableTeacher({ teacher }) {
  const { attributes, listeners, setNodeRef, transform } =
    useDraggable({
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

function DroppableCell({
  className,
  hour,
  teacher,
  conflict,
}) {
  const { setNodeRef } = useDroppable({
    id: `${className}-${hour}`,
  });

  return (
    <td
      ref={setNodeRef}
      className={conflict ? "conflict" : ""}
    >
      {teacher ? teacher.name : ""}
    </td>
  );
}

export default function App() {
  const [schedule, setSchedule] = useState({});

  function hasConflict(currentClass, hour, teacherId) {
    for (const className of classes) {
      if (className === currentClass) continue;

      if (schedule[className]?.[hour] === teacherId) {
        return true;
      }
    }

    return false;
  }

  function handleDragEnd(event) {
    const { active, over } = event;

    if (!over) return;

    const teacherId = active.id;

    const [className, hour] = over.id.split("-");

    setSchedule((prev) => ({
      ...prev,
      [className]: {
        ...prev[className],
        [hour]: teacherId,
      },
    }));
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="container">
        <h1>מערכת שעות - אב טיפוס</h1>

        <div className="layout">
          <div className="teachers-panel">
            <h2>מורים</h2>

            {teachers.map((teacher) => (
              <DraggableTeacher
                key={teacher.id}
                teacher={teacher}
              />
            ))}
          </div>

          <table>
            <thead>
              <tr>
                <th>כיתה</th>

                {hours.map((hour) => (
                  <th key={hour}>שעה {hour}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {classes.map((className) => (
                <tr key={className}>
                  <td className="class-name">
                    {className}
                  </td>

                  {hours.map((hour) => {
                    const teacherId =
                      schedule[className]?.[hour];

                    const teacher = teachers.find(
                      (t) => t.id === teacherId
                    );

                    const conflict =
                      teacherId &&
                      hasConflict(
                        className,
                        hour,
                        teacherId
                      );

                    return (
                      <DroppableCell
                        key={hour}
                        className={className}
                        hour={hour}
                        teacher={teacher}
                        conflict={conflict}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DndContext>
  );
}