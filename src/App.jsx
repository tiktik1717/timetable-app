import { useEffect, useState } from "react";
import { DndContext } from "@dnd-kit/core";
import "./App.css";

import DraggableTeacher from "./components/DraggableTeacher";
import DroppableCell from "./components/DroppableCell";

import {
  teachers,
  classes,
  hours,
  days,
  teachingLoads,
} from "./data/mockData";

export default function App() {
  const [selectedDay, setSelectedDay] = useState("א");
  const [schedule, setSchedule] = useState({});
  const [selectedCell, setSelectedCell] = useState(null);
  const [ctrlPressed, setCtrlPressed] = useState(false);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Control") {
        setCtrlPressed(true);
      }

      if (event.key === "Delete" && selectedCell) {
        removeTeacherFromCell(selectedCell.className, selectedCell.hour);
      }
    }

    function handleKeyUp(event) {
      if (event.key === "Control") {
        setCtrlPressed(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedCell, schedule, selectedDay]);

  function countScheduledHours(className, teacherId) {
    let count = 0;

    for (const day of days) {
      for (const hour of hours) {
        if (schedule[day]?.[className]?.[hour] === teacherId) {
          count++;
        }
      }
    }

    return count;
  }

  function getRemainingHours(className, teacherId) {
    const required = teachingLoads[className]?.[teacherId] || 0;
    const scheduled = countScheduledHours(className, teacherId);

    return required - scheduled;
  }

  function hasConflict(currentClass, hour, teacherId) {
    for (const className of classes) {
      if (className === currentClass) continue;

      if (schedule[selectedDay]?.[className]?.[hour] === teacherId) {
        return true;
      }
    }

    return false;
  }

  function removeTeacherFromCell(className, hour) {
    setSchedule((prev) => {
      const newSchedule = structuredClone(prev);

      if (newSchedule[selectedDay]?.[className]) {
        delete newSchedule[selectedDay][className][hour];
      }

      return newSchedule;
    });
  }

  function placeTeacherInCell(className, hour, teacherId) {
    setSchedule((prev) => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        [className]: {
          ...prev[selectedDay]?.[className],
          [hour]: teacherId,
        },
      },
    }));
  }

  function moveTeacherWithinRow(fromClass, fromHour, toClass, toHour, teacherId) {
    if (fromClass !== toClass) {
      alert("אפשר לגרור מורה רק בתוך אותה שורה / אותה כיתה");
      return;
    }

    if (fromHour === toHour) return;

    const targetTeacherId = schedule[selectedDay]?.[toClass]?.[toHour];

    setSchedule((prev) => {
      const newSchedule = structuredClone(prev);

      if (!newSchedule[selectedDay]) newSchedule[selectedDay] = {};
      if (!newSchedule[selectedDay][fromClass]) {
        newSchedule[selectedDay][fromClass] = {};
      }

      if (ctrlPressed && targetTeacherId) {
        // Ctrl + גרירה לתא תפוס = החלפה
        newSchedule[selectedDay][fromClass][fromHour] = targetTeacherId;
        newSchedule[selectedDay][toClass][toHour] = teacherId;
      } else {
        // גרירה רגילה = דריסה. המורה שהיה ביעד חוזר למחסן אוטומטית
        delete newSchedule[selectedDay][fromClass][fromHour];
        newSchedule[selectedDay][toClass][toHour] = teacherId;
      }

      return newSchedule;
    });
  }

  function handleDragEnd(event) {
    const { active, over } = event;

    if (!over) return;

    const [toClass, toHour] = over.id.split("-");

    const isDragFromCell = String(active.id).startsWith("cell-");

    if (isDragFromCell) {
      const { fromClass, fromHour, teacherId } = active.data.current;

      moveTeacherWithinRow(
        fromClass,
        fromHour,
        toClass,
        toHour,
        teacherId
      );

      return;
    }

    const teacherId = String(active.id);
    const currentTeacherInCell = schedule[selectedDay]?.[toClass]?.[toHour];

    if (currentTeacherInCell === teacherId) return;

    const remaining = getRemainingHours(toClass, teacherId);

    if (remaining <= 0) {
      alert("אין למורה הזה שעות שנותרו לשיבוץ בכיתה זו");
      return;
    }

    placeTeacherInCell(toClass, toHour, teacherId);
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="container">
        <h1>מערכת שעות - אב טיפוס</h1>

        <div className="days-bar">
          {days.map((day) => (
            <button
              key={day}
              className={
                selectedDay === day
                  ? "day-button active-day"
                  : "day-button"
              }
              onClick={() => {
                setSelectedDay(day);
                setSelectedCell(null);
              }}
            >
              יום {day}
            </button>
          ))}
        </div>

        <div className="layout">
          <div className="teachers-panel">
            <h2>מורים</h2>

            {teachers.map((teacher) => (
              <DraggableTeacher key={teacher.id} teacher={teacher} />
            ))}

            <p className="hint">
              Delete מוחק תא מסומן. Ctrl + גרירה מתא לתא מבצע החלפה.
            </p>
          </div>

          <table>
            <thead>
              <tr>
                <th>כיתה</th>
                <th>מחסן שעות</th>
                {hours.map((hour) => (
                  <th key={hour}>שעה {hour}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {classes.map((className) => (
                <tr key={className}>
                  <td className="class-name">{className}</td>

                  <td className="load-cell">
                    {Object.entries(teachingLoads[className] || {}).map(
                      ([teacherId]) => {
                        const teacher = teachers.find(
                          (t) => t.id === teacherId
                        );

                        const remaining = getRemainingHours(
                          className,
                          teacherId
                        );

                        if (remaining <= 0) return null;

                        return (
                          <div key={teacherId} className="load-item">
                            {teacher?.name} × {remaining}
                          </div>
                        );
                      }
                    )}
                  </td>

                  {hours.map((hour) => {
                    const teacherId =
                      schedule[selectedDay]?.[className]?.[hour];

                    const teacher = teachers.find((t) => t.id === teacherId);

                    const conflict =
                      teacherId && hasConflict(className, hour, teacherId);

                    const selected =
                      selectedCell?.className === className &&
                      selectedCell?.hour === String(hour);

                    return (
                      <DroppableCell
                        key={hour}
                        className={className}
                        hour={hour}
                        teacher={teacher}
                        teacherId={teacherId}
                        conflict={conflict}
                        selected={selected}
                        onClick={() =>
                          setSelectedCell({
                            className,
                            hour: String(hour),
                          })
                        }
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