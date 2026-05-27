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
import ConstraintGroupsPanel from "./components/ConstraintGroupsPanel";
import {
  teachers as mockTeachers,
  classes as mockClasses,
  hours as mockHours,
  days as mockDays,
  teachingLoads as mockTeachingLoads,
  teachingUnits as mockTeachingUnits,
  constraintGroups as mockConstraintGroups,
} from "./data/mockData";

export default function App() {
  const [selectedDay, setSelectedDay] = useState("א");

  const [schedule, setSchedule] = useState(() => {
    const savedSchedule = localStorage.getItem("schoolSchedule");

    if (savedSchedule) {
      try {
        return JSON.parse(savedSchedule);
      } catch {
        return {};
      }
    }

    return {};
  });

  useEffect(() => {
    localStorage.setItem("schoolSchedule", JSON.stringify(schedule));
  }, [schedule]);

  const [selectedCell, setSelectedCell] = useState(null);
  const [ctrlPressed, setCtrlPressed] = useState(false);
  const [shiftPressed, setShiftPressed] = useState(false);
  const [displayMode, setDisplayMode] = useState("names");
  const [showFreeDayTeachers, setShowFreeDayTeachers] = useState(true);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [importedExcel, setImportedExcel] = useState(null);
  const [groupDialogUnit, setGroupDialogUnit] = useState(null);
  const [singleDragUnitId, setSingleDragUnitId] = useState(null);
  const [schoolData, setSchoolData] = useState(() => {
    const defaultData = {
      teachers: mockTeachers,
      classes: mockClasses,
      hours: mockHours,
      days: mockDays,
      teachingLoads: mockTeachingLoads,
      teachingUnits: mockTeachingUnits,
      constraintGroups: mockConstraintGroups,
    };

    const savedSchoolData =
      localStorage.getItem("schoolData");

    if (savedSchoolData) {
      return {
        ...defaultData,
        ...JSON.parse(savedSchoolData),
      };
    }

    return defaultData;
  });

  const {
    teachers,
    classes,
    hours,
    days,
    teachingLoads,
    teachingUnits = [],
    constraintGroups = [],
  } = schoolData;

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

  function assignUnitToGroup(unitId, groupId) {
    setSchoolData((prev) => ({
      ...prev,
      teachingUnits: prev.teachingUnits.map((unit) =>
        unit.id === unitId
          ? {
            ...unit,
            constraintGroupId: groupId || null,
          }
          : unit
      ),
    }));

    setGroupDialogUnit(null);
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
    localStorage.setItem(
      "schoolData",
      JSON.stringify(schoolData)
    );
  }, [schoolData]);

  function getUnitById(unitId) {
    return teachingUnits.find((unit) => unit.id === unitId);
  }

  function getTeacherById(teacherId) {
    return teachers.find((teacher) => teacher.id === String(teacherId));
  }

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

      if (event.key === "Shift") setShiftPressed(true);

      if (event.key === "Delete" && selectedCell) {
        removeTeacherFromCell(selectedCell.className, selectedCell.hour);
      }
    }

    function handleKeyUp(event) {
      if (event.key === "Control") setCtrlPressed(false);
      if (event.key === "Shift") setShiftPressed(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedCell, schedule, selectedDay]);

  function getConstraintGroupById(groupId) {
    return constraintGroups.find((group) => group.id === groupId);
  }

  function countScheduledUnitHours(unitId) {
    let count = 0;

    for (const day of days) {
      for (const className of classes) {
        for (const hour of hours) {
          if (getCellUnitIds(day, className, hour).includes(unitId)) {
            count++;
          }
        }
      }
    }

    return count;
  }

  function getRemainingUnitHours(unitId) {
    const unit = getUnitById(unitId);

    if (!unit) return 0;

    return unit.hours - countScheduledUnitHours(unitId);
  }

  function getCellUnitIds(day, className, hour) {
    const value = schedule[day]?.[className]?.[hour];

    if (!value) return [];

    return Array.isArray(value) ? value : [value];
  }

  function setCellUnitIds(draftSchedule, day, className, hour, unitIds) {
    if (!draftSchedule[day]) draftSchedule[day] = {};
    if (!draftSchedule[day][className]) draftSchedule[day][className] = {};

    if (unitIds.length === 0) {
      delete draftSchedule[day][className][hour];
    } else {
      draftSchedule[day][className][hour] = unitIds;
    }
  }

  function getUnitPlacements(unitId) {
    const placements = [];

    for (const day of days) {
      for (const className of classes) {
        for (const hour of hours) {
          if (schedule[day]?.[className]?.[hour] === unitId) {
            placements.push(`${day}:${hour}`);
          }
        }
      }
    }

    return placements;
  }

  function hasTeacherConflict(currentClass, hour, teacherId) {
    for (const className of classes) {
      if (className === currentClass) continue;

      const otherUnitIds = getCellUnitIds(selectedDay, className, hour);

      const hasSameTeacher = otherUnitIds.some((unitId) => {
        const otherUnit = getUnitById(unitId);
        return otherUnit?.teacherId === teacherId;
      });

      if (hasSameTeacher) return true;
    }

    return false;
  }

  function normalizeDay(value) {
    return String(value)
      .replaceAll("יום", "")
      .replaceAll("'", "")
      .replaceAll('"', "")
      .trim();
  }

  function isTeacherFreeDay(teacherId, day) {
    const teacher = teachers.find((t) => t.id === String(teacherId));

    if (!teacher) return false;

    const currentDay = normalizeDay(day);

    return teacher.freeDays?.some(
      (freeDay) => normalizeDay(freeDay) === currentDay
    );
  }

  function removeTeacherFromCell(className, hour) {
    const unitIds = getCellUnitIds(selectedDay, className, hour);
    const units = unitIds.map(getUnitById).filter(Boolean);

    const sameTimeUnit = units.find((unit) => isSameTimeGroup(unit));

    if (sameTimeUnit) {
      removeSameTimeGroupAt(
        selectedDay,
        hour,
        sameTimeUnit.constraintGroupId
      );
      return;
    }

    updateScheduleWithHistory((prev) => {
      const newSchedule = structuredClone(prev);

      setCellUnitIds(newSchedule, selectedDay, className, hour, []);

      return newSchedule;
    });

    setSelectedCell(null);
  }
  
  function placeUnitInCell(className, hour, unitId, append = false) {
    updateScheduleWithHistory((prev) => {
      const newSchedule = structuredClone(prev);

      const currentUnits = getCellUnitIdsFromSchedule(
        newSchedule,
        selectedDay,
        className,
        hour
      );

      const nextUnits = append
        ? [...currentUnits, unitId]
        : [unitId];

      setCellUnitIds(newSchedule, selectedDay, className, hour, nextUnits);

      return newSchedule;
    });
  }
  function getScheduledSameTimeGroupUnitsAt(day, hour, groupId) {
    const result = [];

    for (const className of classes) {
      const unitIds = getCellUnitIds(day, className, hour);

      for (const unitId of unitIds) {
        const unit = getUnitById(unitId);

        if (unit?.constraintGroupId === groupId) {
          result.push(unit);
        }
      }
    }

    return result;
  }

  function moveSameTimeGroup(fromHour, toHour, groupId, append = false) {
    if (fromHour === toHour) return;

    const groupUnits = getScheduledSameTimeGroupUnitsAt(
      selectedDay,
      fromHour,
      groupId
    );

    if (groupUnits.length === 0) return;

    updateScheduleWithHistory((prev) => {
      const newSchedule = structuredClone(prev);

      for (const unit of groupUnits) {
        const fromUnits = getCellUnitIdsFromSchedule(
          newSchedule,
          selectedDay,
          unit.className,
          fromHour
        );

        const toUnits = getCellUnitIdsFromSchedule(
          newSchedule,
          selectedDay,
          unit.className,
          toHour
        );

        const cleanedFromUnits = fromUnits.filter((id) => id !== unit.id);

        setCellUnitIds(
          newSchedule,
          selectedDay,
          unit.className,
          fromHour,
          cleanedFromUnits
        );

        const nextToUnits = append ? [...toUnits, unit.id] : [unit.id];

        setCellUnitIds(
          newSchedule,
          selectedDay,
          unit.className,
          toHour,
          nextToUnits
        );
      }

      return newSchedule;
    });

    setSelectedCell({
      className: groupUnits[0].className,
      hour: String(toHour),
    });
  }

  function getCellUnitIdsFromSchedule(scheduleObject, day, className, hour) {
    const value = scheduleObject[day]?.[className]?.[hour];

    if (!value) return [];

    return Array.isArray(value) ? value : [value];
  }

  function isSameTimeGroup(unit) {
    const group = getConstraintGroupById(unit.constraintGroupId);
    return group?.type === "sameTime";
  }

  function getSameTimeGroupUnits(unit) {
    if (!unit?.constraintGroupId) return [unit];

    const group = getConstraintGroupById(unit.constraintGroupId);

    if (group?.type !== "sameTime") return [unit];

    return teachingUnits.filter(
      (candidate) => candidate.constraintGroupId === unit.constraintGroupId
    );
  }

  function canPlaceUnitOnSelectedDay(unit) {
    if (isTeacherFreeDay(unit.teacherId, selectedDay)) {
      return false;
    }

    return getRemainingUnitHours(unit.id) > 0;
  }

  function placeUnitsByClassAtHour(unitsToPlace, hour, append = false) {
    updateScheduleWithHistory((prev) => {
      const newSchedule = structuredClone(prev);

      for (const unit of unitsToPlace) {
        const currentUnits = getCellUnitIdsFromSchedule(
          newSchedule,
          selectedDay,
          unit.className,
          hour
        );

        const nextUnits = append
          ? [...currentUnits, unit.id]
          : [unit.id];

        setCellUnitIds(
          newSchedule,
          selectedDay,
          unit.className,
          hour,
          nextUnits
        );
      }

      return newSchedule;
    });
  }

  function removeSameTimeGroupAt(day, hour, groupId) {
    const groupUnits = getScheduledSameTimeGroupUnitsAt(day, hour, groupId);

    if (groupUnits.length === 0) return;

    updateScheduleWithHistory((prev) => {
      const newSchedule = structuredClone(prev);

      for (const unit of groupUnits) {
        const currentUnits = getCellUnitIdsFromSchedule(
          newSchedule,
          day,
          unit.className,
          hour
        );

        const nextUnits = currentUnits.filter((id) => id !== unit.id);

        setCellUnitIds(
          newSchedule,
          day,
          unit.className,
          hour,
          nextUnits
        );
      }

      return newSchedule;
    });

    setSelectedCell(null);
  }

  function moveSingleUnitWithinRow(fromClass, fromHour, toClass, toHour, unitId) {
    if (fromClass !== toClass) {
      alert("אפשר לגרור רק בתוך אותה שורה / אותה כיתה");
      return;
    }

    if (fromHour === toHour) return;

    updateScheduleWithHistory((prev) => {
      const newSchedule = structuredClone(prev);

      const fromUnits = getCellUnitIdsFromSchedule(
        newSchedule,
        selectedDay,
        fromClass,
        fromHour
      );

      const targetUnits = getCellUnitIdsFromSchedule(
        newSchedule,
        selectedDay,
        toClass,
        toHour
      );

      const remainingFromUnits = fromUnits.filter((id) => id !== unitId);

      if (ctrlPressed && targetUnits.length > 0) {
        const newTargetUnits = targetUnits.filter((id) => id !== unitId);

        setCellUnitIds(
          newSchedule,
          selectedDay,
          fromClass,
          fromHour,
          [...remainingFromUnits, ...targetUnits]
        );

        setCellUnitIds(
          newSchedule,
          selectedDay,
          toClass,
          toHour,
          [...newTargetUnits, unitId]
        );
      } else if (shiftPressed) {
        setCellUnitIds(
          newSchedule,
          selectedDay,
          fromClass,
          fromHour,
          remainingFromUnits
        );

        setCellUnitIds(
          newSchedule,
          selectedDay,
          toClass,
          toHour,
          [...targetUnits, unitId]
        );
      }

      return newSchedule;
    });

    setSelectedCell({
      className: toClass,
      hour: String(toHour),
    });
  }

  function moveUnitsWithinRow(fromClass, fromHour, toClass, toHour, unitIds) {
    if (fromClass !== toClass) {
      alert("אפשר לגרור רק בתוך אותה שורה / אותה כיתה");
      return;
    }

    if (fromHour === toHour) return;

    updateScheduleWithHistory((prev) => {
      const newSchedule = structuredClone(prev);

      const fromUnits = getCellUnitIdsFromSchedule(
        newSchedule,
        selectedDay,
        fromClass,
        fromHour
      );

      const targetUnits = getCellUnitIdsFromSchedule(
        newSchedule,
        selectedDay,
        toClass,
        toHour
      );

      if (ctrlPressed && targetUnits.length > 0) {
        setCellUnitIds(
          newSchedule,
          selectedDay,
          fromClass,
          fromHour,
          targetUnits
        );

        setCellUnitIds(
          newSchedule,
          selectedDay,
          toClass,
          toHour,
          fromUnits
        );
      } else {
        setCellUnitIds(newSchedule, selectedDay, fromClass, fromHour, []);
        setCellUnitIds(newSchedule, selectedDay, toClass, toHour, fromUnits);
      }

      return newSchedule;
    });

    setSelectedCell({
      className: toClass,
      hour: String(toHour),
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
      const draggedUnitIds = singleDragUnitId
        ? [singleDragUnitId]
        : data.unitIds || [];

      const sameTimeUnit = draggedUnitIds
        .map(getUnitById)
        .find((unit) => unit && isSameTimeGroup(unit));

      if (sameTimeUnit) {
        moveSameTimeGroup(
          data.fromHour,
          toHour,
          sameTimeUnit.constraintGroupId,
          shiftPressed
        );

        return;
      }

      if (shiftPressed && singleDragUnitId) {
        moveSingleUnitWithinRow(
          data.fromClass,
          data.fromHour,
          toClass,
          toHour,
          singleDragUnitId
        );
      } else {
        moveUnitsWithinRow(
          data.fromClass,
          data.fromHour,
          toClass,
          toHour,
          data.unitIds || []
        );
      }

      return;
    }

    if (data?.source === "load") {
      const unit = getUnitById(data.unitId);

      if (!unit) return;

      if (unit.className !== toClass) {
        alert("אפשר לשבץ רק בשורה של הכיתה שממנה נגררה השעה");
        return;
      }

      const unitsToPlace = getSameTimeGroupUnits(unit);

      const invalidUnits = unitsToPlace.filter(
        (candidate) => !canPlaceUnitOnSelectedDay(candidate)
      );

      if (invalidUnits.length > 0) {
        const names = invalidUnits
          .map((candidate) => {
            const teacher = getTeacherById(candidate.teacherId);
            return `${teacher?.name || candidate.teacherId} (${candidate.className})`;
          })
          .join(", ");

        alert(`לא ניתן לשבץ את כל הקבוצה. יש בעיה עם: ${names}`);
        return;
      }

      placeUnitsByClassAtHour(unitsToPlace, toHour, shiftPressed);
      return;
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
      localStorage.setItem(
        "schoolData",
        JSON.stringify(parsedData)
      );
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
      onDragStart={(event) => {
        if (!shiftPressed) {
          setSingleDragUnitId(null);
          return;
        }

        const target = event.activatorEvent?.target;
        const unitElement = target?.closest?.("[data-unit-id]");
        const unitId = unitElement?.dataset?.unitId;

        setSingleDragUnitId(unitId || null);
      }}

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
        setSingleDragUnitId(null);
      }}

      onDragCancel={() => {
        setHoveredCell(null);
        setSingleDragUnitId(null);
      }}
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
                setHistory([]);
                setFuture([]);
                localStorage.removeItem("schoolSchedule");
              }
              setSchoolData((prev) => {
                const cleanedSchoolData = {
                  ...prev,
                  teachingUnits: prev.teachingUnits.map((unit) => ({
                    ...unit,
                    constraintGroupId: null,
                    color: null,
                  })),
                };

                localStorage.setItem(
                  "schoolData",
                  JSON.stringify(cleanedSchoolData)
                );

                return cleanedSchoolData;
              });
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

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showFreeDayTeachers}
              onChange={(e) => setShowFreeDayTeachers(e.target.checked)}
            />
            הצג מורים ביום חופשי
          </label>
        </div>

        <ConstraintGroupsPanel constraintGroups={constraintGroups} />

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
                    {teachingUnits
                      .filter((unit) => unit.className === className)
                      .map((unit) => {
                        const teacher = getTeacherById(unit.teacherId);
                        const remaining = getRemainingUnitHours(unit.id);
                        const isFreeDay = isTeacherFreeDay(unit.teacherId, selectedDay);

                        if (!showFreeDayTeachers && isFreeDay) return null;
                        const group = getConstraintGroupById(unit.constraintGroupId);
                        return (
                          <LoadItem
                            key={unit.id}
                            unit={unit}
                            teacher={teacher}
                            remaining={remaining}
                            placements={getUnitPlacements(unit.id)}
                            displayMode={displayMode}
                            isFreeDay={isFreeDay}
                            group={group}
                            onAssignGroup={setGroupDialogUnit}
                          />
                        );
                      })
                    }
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
                    const unitIds = getCellUnitIds(selectedDay, className, hour);
                    const units = unitIds.map(getUnitById).filter(Boolean);

                    const teachersByUnit = {};
                    const groupsByUnit = {};

                    for (const unit of units) {
                      teachersByUnit[unit.id] = getTeacherById(unit.teacherId);
                      groupsByUnit[unit.id] = getConstraintGroupById(unit.constraintGroupId);
                    }

                    const conflictingTeacherIds = units
                      .filter((unit) =>
                        hasTeacherConflict(className, hour, unit.teacherId)
                      )
                      .map((unit) => unit.teacherId);


                    const selected =
                      selectedCell?.className === className &&
                      selectedCell?.hour === String(hour);

                    const highlighted =
                      hoveredCell?.className === className &&
                      hoveredCell?.hour === String(hour);

                    return (
                      <DroppableCell
                        key={hour}
                        className={className}
                        hour={hour}
                        units={units}
                        teachersByUnit={teachersByUnit}
                        groupsByUnit={groupsByUnit}
                        conflictingTeacherIds={conflictingTeacherIds}
                        selected={selected}
                        highlighted={highlighted}
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
          {groupDialogUnit && (
            <div className="modal-backdrop" onClick={() => setGroupDialogUnit(null)}>
              <div className="group-dialog" onClick={(e) => e.stopPropagation()}>
                <h3>שיוך לקבוצת שיבוץ</h3>

                <p>
                  יחידה:{" "}
                  <strong>
                    {getTeacherById(groupDialogUnit.teacherId)?.name}
                    {groupDialogUnit.subject && groupDialogUnit.subject !== "רגיל"
                      ? ` / ${groupDialogUnit.subject}`
                      : ""}
                  </strong>
                </p>

                <button
                  className="group-option no-group"
                  onClick={() => assignUnitToGroup(groupDialogUnit.id, null)}
                >
                  ללא קבוצה
                </button>

                {constraintGroups.map((group) => (
                  <button
                    key={group.id}
                    className="group-option"
                    onClick={() => assignUnitToGroup(groupDialogUnit.id, group.id)}
                  >
                    <span
                      className="constraint-color"
                      style={{ backgroundColor: group.color }}
                    />
                    {group.name} —{" "}
                    {group.type === "sameTime" ? "חייב ביחד" : "אסור ביחד"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="hint">
          Delete מוחק תא מסומן. גרירה למחסן מוחקת שיבוץ. Ctrl + גרירה מתא לתא
          מבצע החלפה.
        </p>
      </div>
    </DndContext>
  );
}