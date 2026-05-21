import { useEffect, useState } from "react";
import { DndContext } from "@dnd-kit/core";
import "./App.css";

import DroppableCell from "./components/DroppableCell";
import LoadItem from "./components/LoadItem";
import LoadCell from "./components/LoadCell";

import {
  teachers,
  classes,
  hours,
  days,
  teachingLoads,
} from "./data/mockData";

export default function App() {
  const [selectedDay, setSelectedDay] = useState("א");

  const [schedule, setSchedule] = useState(() => {
    const savedSchedule = localStorage.getItem("schoolSchedule");

    if (savedSchedule) {
      return JSON.parse(savedSchedule);
    }

    return {};
  });

  const [selectedCell, setSelectedCell] = useState(null);
  const [ctrlPressed, setCtrlPressed] = useState(false);
  const [displayMode, setDisplayMode] = useState("names");

  useEffect(() => {
    localStorage.setItem("schoolSchedule", JSON.stringify(schedule));
  }, [schedule]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Control") setCtrlPressed(true);

      if (event.key === "Delete" && selectedCell) {
        removeTeacherFromCell(selectedCell.className, selectedCell.hour);
      }
    }

    function handleKeyUp(event) {
      if (event.key === "Control") setCtrlPressed(false);
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

  function getTeacherPlacements(className, teacherId) {
    const placements = [];

    for (const day of days) {
      for (const hour of hours) {
        if (schedule[day]?.[className]?.[hour] === teacherId) {
          placements.push(`${day}:${hour}`);
        }
      }
    }

    return placements;
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

    setSelectedCell(null);
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
        newSchedule[selectedDay][fromClass][fromHour] = targetTeacherId;
        newSchedule[selectedDay][toClass][toHour] = teacherId;
      } else {
        delete newSchedule[selectedDay][fromClass][fromHour];
        newSchedule[selectedDay][toClass][toHour] = teacherId;
      }

      return newSchedule;
    });
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;

    const data = active.data.current;
    const overData = over.data.current;

    if (data?.source === "cell" && overData?.source === "loadCell") {
      if (data.fromClass !== overData.className) {
        alert("אפשר להחזיר מורה רק למחסן של אותה כיתה");
        return;
      }

      removeTeacherFromCell(data.fromClass, data.fromHour);
      return;
    }

    const [toClass, toHour] = over.id.split("-");

    if (data?.source === "cell") {
      moveTeacherWithinRow(
        data.fromClass,
        data.fromHour,
        toClass,
        toHour,
        data.teacherId
      );
      return;
    }

    if (data?.source === "load") {
      const teacherId = String(data.teacherId);

      if (data.className !== toClass) {
        alert("אפשר לשבץ מורה רק בשורה של הכיתה שממנה נגרר במחסן השעות");
        return;
      }

      const remaining = getRemainingHours(toClass, teacherId);

      if (remaining <= 0) {
        alert("אין למורה הזה שעות שנותרו לשיבוץ בכיתה זו");
        return;
      }

      placeTeacherInCell(toClass, toHour, teacherId);
    }
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="container">
        <h1>מערכת שעות - אב טיפוס</h1>

        <div className="top-bar">
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

          <label className="display-mode">
            תצוגה:
            <select
              value={displayMode}
              onChange={(e) => setDisplayMode(e.target.value)}
            >
              <option value="names">שמות</option>
              <option value="codes">קודים</option>
            </select>
          </label>

          <button
            className="clear-button"
            onClick={() => {
              if (confirm("האם למחוק את כל השיבוצים?")) {
                setSchedule({});
                localStorage.removeItem("schoolSchedule");
              }
            }}
          >
            נקה מערכת
          </button>
        </div>

        <div className="table-scroll-wrapper">
          <table>
            <thead>
              <tr>
                <th>מחסן שעות</th>
                <th>כיתה</th>
                {hours.map((hour) => (
                  <th key={hour}>שעה {hour}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {classes.map((className) => (
                <tr key={className}>

                  <LoadCell className={className}>
                    {Object.entries(teachingLoads[className] || {}).map(
                      ([teacherId]) => {
                        const teacher = teachers.find((t) => t.id === teacherId);
                        const remaining = getRemainingHours(className, teacherId);


                        return (
                          <LoadItem
                            key={teacherId}
                            className={className}
                            teacherId={teacherId}
                            teacher={teacher}
                            remaining={remaining}
                            placements={getTeacherPlacements(className, teacherId)}
                            displayMode={displayMode}
                          />
                        );
                      }
                    )}
                  </LoadCell>

                  <td className="class-name">{className}</td>

                  {hours.map((hour) => {
                    const teacherId = schedule[selectedDay]?.[className]?.[hour];
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
                        displayMode={displayMode}
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

        <p className="hint">
          Delete מוחק תא מסומן. גרירה למחסן מוחקת שיבוץ. Ctrl + גרירה מתא לתא
          מבצע החלפה.
        </p>
      </div>
    </DndContext>
  );
}