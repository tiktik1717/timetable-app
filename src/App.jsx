import { useEffect, useRef, useState } from "react";
import { DndContext } from "@dnd-kit/core";
import {
  readExcelFile,
  buildDataFromTimetableSheet,
} from "./services/excelImport";

import "./App.css";

import DroppableCell from "./components/DroppableCell";
import LoadItem from "./components/LoadItem";
import LoadCell from "./components/LoadCell";

import {
  teachers as mockTeachers,
  classes as mockClasses,
  hours as mockHours,
  days as mockDays,
  teachingLoads as mockTeachingLoads,
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
  const [hoveredCell, setHoveredCell] = useState(null);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [importedExcel, setImportedExcel] = useState(null);
  const [schoolData, setSchoolData] = useState({
    teachers: mockTeachers,
    classes: mockClasses,
    hours: mockHours,
    days: mockDays,
    teachingLoads: mockTeachingLoads,
  });

  const { teachers, classes, hours, days, teachingLoads } = schoolData;


  const scheduleRef = useRef(schedule);
  const historyRef = useRef(history);
  const futureRef = useRef(future);
  const tableScrollRef = useRef(null);

  useEffect(() => {
    scheduleRef.current = schedule;
  }, [schedule]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    futureRef.current = future;
  }, [future]);

  function undo() {
    const currentHistory = historyRef.current;

    if (currentHistory.length === 0) return;

    const previousSchedule = currentHistory[currentHistory.length - 1];
    const newHistory = currentHistory.slice(0, -1);
    const newFuture = [scheduleRef.current, ...futureRef.current];

    setSchedule(previousSchedule);
    setHistory(newHistory);
    setFuture(newFuture);
  }

  function redo() {
    const currentFuture = futureRef.current;

    if (currentFuture.length === 0) return;

    const nextSchedule = currentFuture[0];
    const newFuture = currentFuture.slice(1);
    const newHistory = [...historyRef.current, scheduleRef.current];

    setSchedule(nextSchedule);
    setHistory(newHistory);
    setFuture(newFuture);
  }

  function updateScheduleWithHistory(updater) {
    const currentSchedule = scheduleRef.current;

    const nextSchedule =
      typeof updater === "function" ? updater(currentSchedule) : updater;

    setHistory((prevHistory) => [...prevHistory, currentSchedule]);
    setFuture([]);
    setSchedule(nextSchedule);
  }

  useEffect(() => {
    localStorage.setItem("schoolSchedule", JSON.stringify(schedule));
  }, [schedule]);

  useEffect(() => {
    function handleKeyDown(event) {
      const key = event.key.toLowerCase();

      const scrollEl = tableScrollRef.current;

      if (scrollEl) {
        const step = 40;

        if (event.key === "ArrowLeft") {
          event.preventDefault();
          scrollEl.scrollLeft -= step;
          return;
        }

        if (event.key === "ArrowRight") {
          event.preventDefault();
          scrollEl.scrollLeft += step;
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          scrollEl.scrollTop -= step;
          return;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          scrollEl.scrollTop += step;
          return;
        }
      }

      if (event.ctrlKey && (key === "z" || key === "ז")) {
        event.preventDefault();
        undo();
        return;
      }

      if (event.ctrlKey && (key === "y" || key === "ט")) {
        event.preventDefault();
        redo();
        return;
      }

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
    updateScheduleWithHistory((prev) => {
      const newSchedule = structuredClone(prev);

      if (newSchedule[selectedDay]?.[className]) {
        delete newSchedule[selectedDay][className][hour];
      }

      return newSchedule;
    });

    setSelectedCell(null);
  }

  function placeTeacherInCell(className, hour, teacherId) {
    updateScheduleWithHistory((prev) => ({
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

    updateScheduleWithHistory((prev) => {
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

  async function handleExcelUpload(event) {
    const file = event.target.files[0];

    if (!file) return;

    try {
      const result = await readExcelFile(file);
      const parsedData = buildDataFromTimetableSheet(result);

      console.log("Excel imported:", result);
      console.log("Parsed school data:", parsedData);

      setImportedExcel(result);
      setSchoolData(parsedData);

      setSchedule({});
      setHistory([]);
      setFuture([]);
      localStorage.removeItem("schoolSchedule");

      alert(
        `הייבוא הצליח!\nנטענו ${parsedData.teachers.length} מורים ו-${parsedData.classes.length} כיתות.`
      );
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  }

  return (
    <DndContext
      onDragOver={(event) => {
        const overId = event.over?.id;

        if (!overId || String(overId).startsWith("load-cell")) {
          setHoveredCell(null);
          return;
        }

        const [className, hour] = String(overId).split("-");

        setHoveredCell({
          className,
          hour: String(hour),
        });
      }}
      onDragEnd={(event) => {
        setHoveredCell(null);
        handleDragEnd(event);
      }}
      onDragCancel={() => setHoveredCell(null)}
    >
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
            className="action-button"
            onClick={undo}
            disabled={history.length === 0}
          >
            ביטול פעולה
          </button>

          <button
            className="action-button"
            onClick={redo}
            disabled={future.length === 0}
          >
            בצע שוב
          </button>

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

          <label className="upload-button">
            ייבוא Excel
            <input
              type="file"
              accept=".xlsx,.xlsm,.xls"
              onChange={handleExcelUpload}
              hidden
            />
          </label>
        </div>

        <div
          className="table-scroll-wrapper"
          ref={tableScrollRef}
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>מחסן שעות</th>
                <th>כיתה</th>
                {hours.map((hour) => (
                  <th
                    key={hour}
                    className={
                      hoveredCell?.hour === String(hour) ? "highlighted-header" : ""
                    }
                  >
                    שעה {hour}
                  </th>))}
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

                  <td
                    className={
                      hoveredCell?.className === className
                        ? "class-name highlighted-header"
                        : "class-name"
                    }
                  >
                    {className}
                  </td>

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
                        highlighted={
                          hoveredCell?.className === className &&
                          hoveredCell?.hour === String(hour)
                        }
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