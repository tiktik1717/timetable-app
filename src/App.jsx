import { useState } from "react";
import { DndContext } from "@dnd-kit/core";
import "./App.css";

import DraggableTeacher from "./components/DraggableTeacher";
import DroppableCell from "./components/DroppableCell";
import { teachers, classes, hours } from "./data/mockData";

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
              <DraggableTeacher key={teacher.id} teacher={teacher} />
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
                  <td className="class-name">{className}</td>

                  {hours.map((hour) => {
                    const teacherId = schedule[className]?.[hour];

                    const teacher = teachers.find((t) => t.id === teacherId);

                    const conflict =
                      teacherId && hasConflict(className, hour, teacherId);

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