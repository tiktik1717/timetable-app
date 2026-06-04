import { useEffect, useRef, useState } from "react";

import { DndContext } from "@dnd-kit/core";
import {
  readExcelFile,
  buildDataFromTimetableSheet,
  buildDataFromRawSadin,
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

import WarningsPanel from "./components/WarningsPanel";
import ConstraintGroupDialog from "./components/ConstraintGroupDialog";
import ShahafView from "./components/ShahafView";
import TeacherView from "./components/TeacherView";
import TeachersManager from "./components/TeachersManager";
import ClassesManager from "./components/ClassesManager";
import MeetingsManager from "./components/MeetingsManager";
import DailyHoursManager from "./components/DailyHoursManager";
import SadinSheetEditor from "./components/SadinSheetEditor";
import TeacherHighlightPanel, {
  createDefaultTeacherHighlights,
} from "./components/TeacherHighlightPanel";
import FileManager from "./components/FileManager";
import AuthPanel from "./components/AuthPanel";
import { supabase } from "./services/supabaseClient";

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


  useEffect(() => {
    function handleClickOutside(event) {
      if (
        panelsMenuRef.current &&
        !panelsMenuRef.current.contains(event.target)
      ) {
        setShowPanelsMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);


  const panelsMenuRef = useRef(null);
  const [dragSource, setDragSource] = useState(null);
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
  const [groupDialogHours, setGroupDialogHours] = useState("");
  const [groupDialogSubject, setGroupDialogSubject] = useState("");
  const [singleDragUnitId, setSingleDragUnitId] = useState(null);
  const [highlightedGroupId, setHighlightedGroupId] = useState(null);
  const [showConstraintGroupDialog, setShowConstraintGroupDialog] = useState(false);
  const [editingConstraintGroup, setEditingConstraintGroup] = useState(null);
  const [activeView, setActiveView] = useState("scheduler");
  const [selectedLoadUnitId, setSelectedLoadUnitId] = useState(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showPanelsMenu, setShowPanelsMenu] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [user, setUser] = useState(null);
  const [cloudProjects, setCloudProjects] = useState([]);
  const [draggedTeacherId, setDraggedTeacherId] = useState(null);
  const [draggedClassName, setDraggedClassName] = useState(null);
  const [activePlacementUnitId, setActivePlacementUnitId] = useState(null);
  const [dragOriginCell, setDragOriginCell] = useState(null);
  const pendingPurpleHoleCheckRef = useRef(null);
  const [rowHeightOffset, setRowHeightOffset] = useState(() => {
    return Number(localStorage.getItem("rowHeightOffset")) || 0;
  });
  const [visiblePanels, setVisiblePanels] = useState({
    groups: true,
    warnings: true,
    highlights: true,
    dailyBalance: true,
    purpleHoleAlerts: true,
    difficultyHints: false,
  });
  const [hasUnsavedCloudChanges, setHasUnsavedCloudChanges] = useState(false);
  const [lastCloudSavedAt, setLastCloudSavedAt] = useState(null);
  const [lockedPlacements, setLockedPlacements] = useState(() => {
    const saved = localStorage.getItem("lockedPlacements");

    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }

    return {};
  });
  const [checkpoints, setCheckpoints] = useState(() => {
    const saved = localStorage.getItem("checkpoints");

    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }

    return [];
  });

  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user || null);
    }

    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const [selectedCloudProjectId, setSelectedCloudProjectId] = useState(() => {
    return localStorage.getItem("selectedCloudProjectId") || "";
  });

  useEffect(() => {
    localStorage.setItem("lockedPlacements", JSON.stringify(lockedPlacements));
  }, [lockedPlacements]);

  useEffect(() => {
    localStorage.setItem("rowHeightOffset", String(rowHeightOffset));
  }, [rowHeightOffset]);

  useEffect(() => {
    localStorage.setItem(
      "selectedCloudProjectId",
      selectedCloudProjectId || ""
    );
  }, [selectedCloudProjectId]);

  useEffect(() => {
    localStorage.setItem("checkpoints", JSON.stringify(checkpoints));
  }, [checkpoints]);


  const [currentCheckpointId, setCurrentCheckpointId] = useState(() => {
    return localStorage.getItem("currentCheckpointId") || "";
  });

  const [comparisonCheckpointId, setComparisonCheckpointId] = useState(() => {
    return localStorage.getItem("comparisonCheckpointId") || "";
  });

  const [teacherHighlights, setTeacherHighlights] = useState(() => {
    const saved = localStorage.getItem("teacherHighlights");

    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return createDefaultTeacherHighlights();
      }
    }

    return createDefaultTeacherHighlights();
  });

  useEffect(() => {
    localStorage.setItem("currentCheckpointId", currentCheckpointId || "");
  }, [currentCheckpointId]);

  useEffect(() => {
    localStorage.setItem("comparisonCheckpointId", comparisonCheckpointId || "");
  }, [comparisonCheckpointId]);


  const [schoolData, setSchoolData] = useState(() => {
    const defaultData = {
      teachers: mockTeachers,
      classes: mockClasses,
      hours: mockHours,
      days: mockDays,
      teachingLoads: mockTeachingLoads,
      teachingUnits: mockTeachingUnits,
      constraintGroups: mockConstraintGroups,
      homeroomTeacherColor: "#c8e6c9",
      meetings: [],
      dailyHoursByClass: createDefaultDailyHours(
        mockClasses,
        mockDays,
        6
      ),
    };

    const savedSchoolData =
      localStorage.getItem("schoolData");

    if (savedSchoolData) {
      return ensureDailyHoursForClasses({
        ...defaultData,
        ...JSON.parse(savedSchoolData),
      });
    }

    return defaultData;
  });

  useEffect(() => {
    if (selectedCloudProjectId) {
      setHasUnsavedCloudChanges(true);
    }
  }, [
    schoolData,
    schedule,
    teacherHighlights,
    checkpoints,
    currentCheckpointId,
    comparisonCheckpointId,
  ]);

  const {
    teachers,
    classes,
    hours,
    days,
    teachingLoads,
    teachingUnits = [],
    constraintGroups = [],
    meetings = [],
    dailyHoursByClass = {},
  } = schoolData;

  const [selectedClassForShahaf, setSelectedClassForShahaf] = useState(
    classes[0] || ""
  );
  const [selectedTeacherForView, setSelectedTeacherForView] = useState(
    teachers[0]?.id || ""
  );


  function createDefaultDailyHours(classes, days, defaultHours = 6) {
    const result = {};

    for (const className of classes) {
      result[className] = {};

      for (const day of days) {
        result[className][day] = defaultHours;
      }
    }

    return result;
  }

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

  useEffect(() => {
    localStorage.setItem(
      "teacherHighlights",
      JSON.stringify(teacherHighlights)
    );
  }, [teacherHighlights]);

  useEffect(() => {
    async function initializeCloudProjects() {
      if (!user) {
        setCloudProjects([]);
        setSelectedCloudProjectId("");
        return;
      }

      await loadCloudProjects();

      const savedProjectId = localStorage.getItem("selectedCloudProjectId");

      if (savedProjectId) {
        await loadCloudProjectById(savedProjectId);
      }
    }

    initializeCloudProjects();
  }, [user]);


  useEffect(() => {
    if (!user || !selectedCloudProjectId || !hasUnsavedCloudChanges) return;

    const timer = setTimeout(async () => {
      const { error } = await supabase
        .from("projects")
        .update({
          data: buildProjectData(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedCloudProjectId);

      if (error) {
        console.error("Auto save failed:", error);
        return;
      }

      setHasUnsavedCloudChanges(false);
      setLastCloudSavedAt(new Date().toLocaleTimeString("he-IL"));
      loadCloudProjects();
    }, 30000);

    return () => clearTimeout(timer);
  }, [
    user,
    selectedCloudProjectId,
    hasUnsavedCloudChanges,
    schoolData,
    schedule,
    teacherHighlights,
    checkpoints,
    currentCheckpointId,
    comparisonCheckpointId,
  ]);

  useEffect(() => {
    const pending = pendingPurpleHoleCheckRef.current;

    if (!pending) return;

    pendingPurpleHoleCheckRef.current = null;

    const afterHoles = getPurpleHolesForAllDaysFromSchedule(schedule);

    alertNewPurpleHoles(pending.beforeHoles, afterHoles);
  }, [schedule, schoolData]);

  function buildProjectData() {
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      schoolData,
      schedule,
      teacherHighlights,
      checkpoints,
      currentCheckpointId,
      comparisonCheckpointId,
    };
  }

  async function loadCloudProjectById(projectId) {
    if (!user) {
      alert("יש להתחבר לפני טעינה מהענן");
      return;
    }

    if (!projectId) return;

    const { data, error } = await supabase
      .from("projects")
      .select("id, name, data")
      .eq("id", projectId)
      .single();

    if (error) {
      alert("טעינת הפרויקט נכשלה: " + error.message);
      return;
    }

    const projectData = data.data;

    const normalizedSchoolData = ensureDailyHoursForClasses(
      projectData.schoolData
    );

    setSchoolData(normalizedSchoolData);
    setSchedule(projectData.schedule || {});
    setTeacherHighlights(
      projectData.teacherHighlights || createDefaultTeacherHighlights()
    );
    setCheckpoints(projectData.checkpoints || []);
    setCurrentCheckpointId(projectData.currentCheckpointId || "");
    setComparisonCheckpointId(projectData.comparisonCheckpointId || "");

    setHistory([]);
    setFuture([]);

    localStorage.setItem("schoolData", JSON.stringify(normalizedSchoolData));
    localStorage.setItem(
      "schoolSchedule",
      JSON.stringify(projectData.schedule || {})
    );
    localStorage.setItem(
      "teacherHighlights",
      JSON.stringify(
        projectData.teacherHighlights || createDefaultTeacherHighlights()
      )
    );
    localStorage.setItem("checkpoints", JSON.stringify(projectData.checkpoints || []));
    localStorage.setItem("currentCheckpointId", projectData.currentCheckpointId || "");
    localStorage.setItem(
      "comparisonCheckpointId",
      projectData.comparisonCheckpointId || ""
    );

    setSelectedCloudProjectId(projectId);
    setHasUnsavedCloudChanges(false);
    setLastCloudSavedAt(new Date().toLocaleTimeString("he-IL"));

    alert(`הפרויקט "${data.name}" נטען מהענן`);
  }

  async function handleCloudProjectSelection(projectId) {
    if (!projectId) {
      setSelectedCloudProjectId("");
      return;
    }

    if (hasUnsavedCloudChanges && selectedCloudProjectId) {
      const shouldSaveFirst = confirm(
        "יש שינויים שלא נשמרו בענן.\n\nלחץ אישור כדי לשמור את הפרויקט הנוכחי ואז לטעון את הפרויקט שנבחר.\nלחץ ביטול כדי לטעון בלי לשמור."
      );

      if (shouldSaveFirst) {
        await updateSelectedCloudProject();
      }
    }

    await loadCloudProjectById(projectId);
  }

  async function loadCloudProjects() {
    if (!user) return;

    const { data, error } = await supabase
      .from("projects")
      .select("id, name, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      alert("טעינת רשימת הפרויקטים נכשלה: " + error.message);
      return;
    }

    setCloudProjects(data || []);
  }

  async function saveProjectToCloud() {
    if (!user) {
      alert("יש להתחבר לפני שמירה בענן");
      return;
    }

    const name = prompt("שם הפרויקט לשמירה בענן");

    if (!name || !name.trim()) {
      alert("יש להזין שם פרויקט");
      return;
    }

    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        name: name.trim(),
        data: buildProjectData(),
        updated_at: new Date().toISOString(),
      })
      .select("id, name, updated_at")
      .single();

    if (error) {
      alert("שמירה בענן נכשלה: " + error.message);
      return;
    }

    alert("הפרויקט נשמר בענן");
    setSelectedCloudProjectId(data.id);
    await loadCloudProjects();
  }

  async function updateSelectedCloudProject() {
    if (!user) {
      alert("יש להתחבר לפני שמירה בענן");
      return;
    }

    if (!selectedCloudProjectId) {
      alert("יש לבחור פרויקט לעדכון");
      return;
    }
    async function autoSaveSelectedCloudProject() {
      if (!user || !selectedCloudProjectId || !hasUnsavedCloudChanges) return;

      const { error } = await supabase
        .from("projects")
        .update({
          data: buildProjectData(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedCloudProjectId);

      if (error) {
        console.error("Auto save failed:", error);
        return;
      }

      setHasUnsavedCloudChanges(false);
      setLastCloudSavedAt(new Date().toLocaleTimeString("he-IL"));
      await loadCloudProjects();
    }
    const { error } = await supabase
      .from("projects")
      .update({
        data: buildProjectData(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedCloudProjectId);

    if (error) {
      alert("עדכון הפרויקט בענן נכשל: " + error.message);
      return;
    }

    alert("הפרויקט עודכן בענן");
    setHasUnsavedCloudChanges(false);
    setLastCloudSavedAt(new Date().toLocaleTimeString("he-IL"));
    await loadCloudProjects();
  }

  async function loadSelectedCloudProject() {
    if (!user) {
      alert("יש להתחבר לפני טעינה מהענן");
      return;
    }

    if (!selectedCloudProjectId) {
      alert("יש לבחור פרויקט לטעינה");
      return;
    }

    const { data, error } = await supabase
      .from("projects")
      .select("id, name, data")
      .eq("id", selectedCloudProjectId)
      .single();

    if (error) {
      alert("טעינת הפרויקט נכשלה: " + error.message);
      return;
    }

    const projectData = data.data;

    const normalizedSchoolData = ensureDailyHoursForClasses(projectData.schoolData);

    setSchoolData(normalizedSchoolData);
    setSchedule(projectData.schedule || {});
    setTeacherHighlights(
      projectData.teacherHighlights || createDefaultTeacherHighlights()
    );
    setCheckpoints(projectData.checkpoints || []);
    setCurrentCheckpointId(projectData.currentCheckpointId || "");
    setComparisonCheckpointId(projectData.comparisonCheckpointId || "");

    setHistory([]);
    setFuture([]);

    localStorage.setItem("schoolData", JSON.stringify(normalizedSchoolData));
    localStorage.setItem("schoolSchedule", JSON.stringify(projectData.schedule || {}));
    localStorage.setItem(
      "teacherHighlights",
      JSON.stringify(projectData.teacherHighlights || createDefaultTeacherHighlights())
    );
    localStorage.setItem("checkpoints", JSON.stringify(projectData.checkpoints || []));
    localStorage.setItem("currentCheckpointId", projectData.currentCheckpointId || "");
    localStorage.setItem(
      "comparisonCheckpointId",
      projectData.comparisonCheckpointId || ""
    );
    setHasUnsavedCloudChanges(false);
    setLastCloudSavedAt(new Date().toLocaleTimeString("he-IL"));
    alert(`הפרויקט "${data.name}" נטען מהענן`);
  }


  async function deleteSelectedCloudProject() {
    if (!selectedCloudProjectId) {
      alert("יש לבחור פרויקט למחיקה");
      return;
    }

    if (!confirm("למחוק את הפרויקט מהענן?")) return;

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", selectedCloudProjectId);

    if (error) {
      alert("מחיקת הפרויקט נכשלה: " + error.message);
      return;
    }

    setSelectedCloudProjectId("");
    await loadCloudProjects();
  }


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

  function getLockKey(day, className, hour, unitId) {
    return `${day}|${className}|${hour}|${unitId}`;
  }

  function isUnitLocked(day, className, hour, unitId) {
    return !!lockedPlacements[getLockKey(day, className, hour, unitId)];
  }

  function isCellLocked(day, className, hour) {
    const unitIds = getCellUnitIds(day, className, hour);

    return unitIds.some((unitId) =>
      isUnitLocked(day, className, hour, unitId)
    );
  }

  function requestPurpleHoleCheck() {
    pendingPurpleHoleCheckRef.current = {
      beforeHoles: getPurpleHolesForAllDaysFromSchedule(schedule),
    };
  }

  function toggleCellLock(day, className, hour) {
    const unitIds = getCellUnitIds(day, className, hour);

    if (unitIds.length === 0) return;

    const shouldUnlock = unitIds.some((unitId) =>
      isUnitLocked(day, className, hour, unitId)
    );

    setLockedPlacements((prev) => {
      const next = { ...prev };

      for (const unitId of unitIds) {
        const unit = getUnitById(unitId);

        if (!unit) continue;

        if (isSameTimeGroup(unit)) {
          const groupUnits = getScheduledSameTimeGroupUnitsAt(
            day,
            hour,
            unit.constraintGroupId
          );

          for (const groupUnit of groupUnits) {
            const key = getLockKey(
              day,
              groupUnit.className,
              hour,
              groupUnit.id
            );

            if (shouldUnlock) {
              delete next[key];
            } else {
              next[key] = true;
            }
          }
        } else {
          const key = getLockKey(day, className, hour, unitId);

          if (shouldUnlock) {
            delete next[key];
          } else {
            next[key] = true;
          }
        }
      }

      return next;
    });
  }

  function togglePanel(panelName) {
    setVisiblePanels((prev) => ({
      ...prev,
      [panelName]: !prev[panelName],
    }));
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

  function getActivePlacementUnits() {
    const baseUnit = getUnitById(activePlacementUnitId);

    if (!baseUnit) return [];

    return getSameTimeGroupUnits(baseUnit);
  }

  function getGroupPlacementStatus(day, hour) {
    const units = getActivePlacementUnits();
    const activeUnit = getUnitById(activePlacementUnitId);

    if (units.length === 0 || !activeUnit) return null;

    let hasGroupProblem = false;
    const ignoredUnitIds =
      dragSource === "cell" && activePlacementUnitId
        ? [activePlacementUnitId]
        : [];

    for (const unit of units) {
      const isActiveUnit = unit.id === activeUnit.id;

      const isBlockedOrFree =
        isTeacherBlockedHour(unit.teacherId, day, hour) ||
        isTeacherFreeDay(unit.teacherId, day);

      if (isBlockedOrFree) {
        if (isActiveUnit) {
          return "teacherBlocked";
        }

        hasGroupProblem = true;
        continue;
      }

      if (isTeacherBusyAt(unit.teacherId, day, hour)) {
        if (isActiveUnit) {
          return "busy";
        }

        hasGroupProblem = true;
        continue;
      }

      if (
        violatesConstraintRules(unit, day, unit.className, hour, {
          ignoredUnitIds,
        })
      ) {
        if (isActiveUnit) {
          return "busy";
        }

        hasGroupProblem = true;
        continue;
      }
    }

    if (hasGroupProblem) {
      return "groupBusy";
    }

    return "available";
  }

  function removeTeacherFromDay(teacherId, day) {
    let removedCount = 0;
    const removedGroups = new Set();

    updateScheduleWithHistory((prev) => {
      const newSchedule = structuredClone(prev);

      for (const hour of hours) {
        const groupsToRemove = new Set();
        const singleUnitIdsToRemove = new Set();

        // שלב א: מזהים מה צריך להסיר בשעה הזו
        for (const className of classes) {
          const unitIds = getCellUnitIdsFromSchedule(
            newSchedule,
            day,
            className,
            hour
          );

          for (const unitId of unitIds) {
            const unit = getUnitById(unitId);

            if (unit?.teacherId !== teacherId) continue;

            if (isSameTimeGroup(unit)) {
              groupsToRemove.add(unit.constraintGroupId);
            } else {
              singleUnitIdsToRemove.add(unit.id);
            }
          }
        }

        // שלב ב: מסירים יחידות בודדות
        for (const className of classes) {
          const unitIds = getCellUnitIdsFromSchedule(
            newSchedule,
            day,
            className,
            hour
          );

          const nextUnitIds = unitIds.filter((unitId) => {
            const shouldRemove = singleUnitIdsToRemove.has(unitId);

            if (shouldRemove) removedCount++;

            return !shouldRemove;
          });

          if (nextUnitIds.length !== unitIds.length) {
            setCellUnitIds(newSchedule, day, className, hour, nextUnitIds);
          }
        }

        // שלב ג: מסירים קבוצות sameTime שלמות
        for (const groupId of groupsToRemove) {
          const group = getConstraintGroupById(groupId);
          removedGroups.add(group?.name || groupId);

          for (const className of classes) {
            const unitIds = getCellUnitIdsFromSchedule(
              newSchedule,
              day,
              className,
              hour
            );

            const nextUnitIds = unitIds.filter((unitId) => {
              const unit = getUnitById(unitId);
              const shouldRemove = unit?.constraintGroupId === groupId;

              if (shouldRemove) removedCount++;

              return !shouldRemove;
            });

            if (nextUnitIds.length !== unitIds.length) {
              setCellUnitIds(newSchedule, day, className, hour, nextUnitIds);
            }
          }
        }
      }

      return newSchedule;
    });

    return {
      removedCount,
      removedGroups: [...removedGroups],
    };
  }

  function saveProjectToFile() {
    const projectData = {
      version: 1,
      savedAt: new Date().toISOString(),
      schoolData,
      schedule,
      teacherHighlights,
      checkpoints,
      currentCheckpointId,
      comparisonCheckpointId,
    };

    const json = JSON.stringify(projectData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `school-timetable-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  function clearProject() {
    if (!confirm("האם למחוק את כל השיבוצים?")) return;

    setSchedule({});
    setHistory([]);
    setFuture([]);
    localStorage.removeItem("schoolSchedule");

    setSchoolData((prev) => {
      const cleanedSchoolData = {
        ...prev,
        teachingUnits: prev.teachingUnits.map((unit) => ({
          ...unit,
          constraintGroupId: null,
          color: null,
        })),
      };

      localStorage.setItem("schoolData", JSON.stringify(cleanedSchoolData));

      return cleanedSchoolData;
    });
  }

  function getUnfilledHoursForClassInDay(className, day) {
    const classHours = getClassHoursForDay(className, day);
    let unfilled = 0;

    for (let hour = 1; hour <= classHours; hour++) {
      const unitIds = getCellUnitIds(day, className, hour);

      if (unitIds.length === 0) {
        unfilled++;
      }
    }

    return unfilled;
  }

  function getActivePlacementClassName() {
    if (draggedClassName) return draggedClassName;

    if (!selectedLoadUnitId) return null;

    const unit = getUnitById(selectedLoadUnitId);
    return unit?.className || null;
  }

  function cellHasActiveTeacher(className, day, hour) {
    const teacherId = getActivePlacementTeacherId();

    if (!teacherId) return false;

    const unitIds = getCellUnitIds(day, className, hour);

    return unitIds.some((unitId) => {
      const unit = getUnitById(unitId);
      return unit?.teacherId === teacherId;
    });
  }

  function getComparisonCheckpoint() {
    return checkpoints.find(
      (checkpoint) => checkpoint.id === comparisonCheckpointId
    );
  }

  function getCellUnitIdsFromAnySchedule(scheduleObject, day, className, hour) {
    const value = scheduleObject?.[day]?.[className]?.[hour];

    if (!value) return [];

    return Array.isArray(value) ? value : [value];
  }

  function getTeacherNamesForScheduleCell(scheduleObject, day, className, hour) {
    const unitIds = getCellUnitIdsFromAnySchedule(
      scheduleObject,
      day,
      className,
      hour
    );

    return unitIds
      .map(getUnitById)
      .filter(Boolean)
      .map((unit) => getTeacherById(unit.teacherId)?.name)
      .filter(Boolean)
      .sort()
      .join("|");
  }

  function isShahafCellChanged(day, className, hour) {
    const checkpoint = getComparisonCheckpoint();

    if (!checkpoint) return false;

    const currentValue = getTeacherNamesForScheduleCell(
      schedule,
      day,
      className,
      hour
    );

    const checkpointValue = getTeacherNamesForScheduleCell(
      checkpoint.schedule || {},
      day,
      className,
      hour
    );

    return currentValue !== checkpointValue;
  }

  function getDifficultyCount(className, day, hour) {
    if (isBlockedCell(className, day, hour)) return null;

    const unitIds = getCellUnitIds(day, className, hour);

    // דרגת קושי מוצגת רק בתאים ריקים
    if (unitIds.length > 0) return null;

    let count = 0;

    for (const unit of teachingUnits) {
      if (canUnitFillCell(unit, day, className, hour)) {
        count++;
      }
    }

    return count;
  }

  function getDifficultyLevel(count) {
    if (count === null || count === undefined) return null;

    if (count === 0) return "zero";
    if (count === 1) return "one";
    if (count === 2) return "two";
    if (count === 3) return "three";
    if (count <= 5) return "medium";

    return "easy";
  }

  function getBalanceTextColor(backgroundColor) {
    const color = backgroundColor.replace("#", "");

    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);

    const brightness =
      (r * 299 + g * 587 + b * 114) / 1000;

    return brightness > 140 ? "#000" : "#fff";
  }

  function getRemainingHoursForClassInDay(className, day) {
    let total = 0;

    for (const unit of teachingUnits) {
      if (unit.className !== className) continue;

      if (isTeacherFreeDay(unit.teacherId, day)) continue;

      total += getRemainingUnitHours(unit.id);
    }

    return total;
  }


  function createCheckpoint() {
    const name = prompt("שם נקודת השמירה");

    if (!name || !name.trim()) {
      alert("יש להזין שם לנקודת השמירה");
      return;
    }

    const newCheckpoint = {
      id: `checkpoint-${Date.now()}`,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      schedule: structuredClone(schedule),
      schoolData: structuredClone(schoolData),
    };

    setCheckpoints((prev) => {
      const next = [newCheckpoint, ...prev];

      if (next.length > 10) {
        alert("נשמרות עד 10 נקודות שמירה. הנקודה הישנה ביותר נמחקה.");
        return next.slice(0, 10);
      }

      return next;
    });

    setCurrentCheckpointId(newCheckpoint.id);
    setComparisonCheckpointId(getPreviousCheckpointId(newCheckpoint.id, [newCheckpoint, ...checkpoints]));
  }

  function getActivePlacementTeacherId() {
    if (draggedTeacherId) return draggedTeacherId;

    if (!selectedLoadUnitId) return null;

    const unit = getUnitById(selectedLoadUnitId);
    return unit?.teacherId || null;
  }

  function isTeacherBusyAt(teacherId, day, hour) {
    for (const className of classes) {
      const isOriginCell =
        dragOriginCell &&
        dragOriginCell.className === className &&
        dragOriginCell.hour === String(hour);

      const unitIds = getCellUnitIds(day, className, hour);

      for (const unitId of unitIds) {
        const unit = getUnitById(unitId);

        if (unit?.teacherId !== teacherId) continue;

        // אם זה התא שממנו התחלנו לגרור, לא מחשיבים את אותו שיבוץ כתפוס
        if (isOriginCell) continue;

        return true;
      }
    }

    return false;
  }

  function getPlacementHint(className, day, hour) {
    const activeClassName = getActivePlacementClassName();
    if (
      dragOriginCell &&
      dragOriginCell.className === className &&
      dragOriginCell.hour === String(hour)
    ) {
      return null;
    }

    if (!activeClassName) return null;

    if (className !== activeClassName) return null;

    if (isBlockedCell(className, day, hour)) {
      return null;
    }

    return getGroupPlacementStatus(day, hour);
  }

  function removeTeacherFromSpecificTime(teacherId, day, hour) {
    let removedCount = 0;
    const removedGroups = new Set();

    updateScheduleWithHistory((prev) => {
      const newSchedule = structuredClone(prev);

      const groupsToRemove = new Set();
      const singleUnitIdsToRemove = new Set();

      // שלב א: לזהות מה צריך להסיר
      for (const className of classes) {
        const unitIds = getCellUnitIdsFromSchedule(
          newSchedule,
          day,
          className,
          hour
        );

        for (const unitId of unitIds) {
          const unit = getUnitById(unitId);

          if (unit?.teacherId !== teacherId) continue;

          if (isSameTimeGroup(unit)) {
            groupsToRemove.add(unit.constraintGroupId);
          } else {
            singleUnitIdsToRemove.add(unit.id);
          }
        }
      }

      // שלב ב: להסיר יחידות בודדות
      for (const className of classes) {
        const unitIds = getCellUnitIdsFromSchedule(
          newSchedule,
          day,
          className,
          hour
        );

        const nextUnitIds = unitIds.filter((unitId) => {
          const shouldRemove = singleUnitIdsToRemove.has(unitId);

          if (shouldRemove) removedCount++;

          return !shouldRemove;
        });

        if (nextUnitIds.length !== unitIds.length) {
          setCellUnitIds(newSchedule, day, className, hour, nextUnitIds);
        }
      }

      // שלב ג: להסיר קבוצות sameTime שלמות
      for (const groupId of groupsToRemove) {
        const group = getConstraintGroupById(groupId);
        removedGroups.add(group?.name || groupId);

        for (const className of classes) {
          const unitIds = getCellUnitIdsFromSchedule(
            newSchedule,
            day,
            className,
            hour
          );

          const nextUnitIds = unitIds.filter((unitId) => {
            const unit = getUnitById(unitId);

            const shouldRemove = unit?.constraintGroupId === groupId;

            if (shouldRemove) removedCount++;

            return !shouldRemove;
          });

          if (nextUnitIds.length !== unitIds.length) {
            setCellUnitIds(newSchedule, day, className, hour, nextUnitIds);
          }
        }
      }

      return newSchedule;
    });

    return {
      removedCount,
      removedGroups: [...removedGroups],
    };
  }

  function getPreviousCheckpointId(checkpointId, checkpointList = checkpoints) {
    const sorted = [...checkpointList].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const index = sorted.findIndex((checkpoint) => checkpoint.id === checkpointId);

    if (index === -1 || index === sorted.length - 1) return "";

    return sorted[index + 1].id;
  }

  function deleteCheckpoint(checkpointId) {
    if (!confirm("למחוק את נקודת השמירה?")) return;

    setCheckpoints((prev) =>
      prev.filter((checkpoint) => checkpoint.id !== checkpointId)
    );

    if (currentCheckpointId === checkpointId) {
      setCurrentCheckpointId("");
    }

    if (comparisonCheckpointId === checkpointId) {
      setComparisonCheckpointId("");
    }
  }

  function isTeacherBlockedHour(teacherId, day, hour) {
    const teacher = getTeacherById(teacherId);

    return teacher?.blockedHours?.[day]?.includes(Number(hour)) || false;
  }

  function canTeacherWorkAt(teacherId, day, hour) {
    return (
      !isTeacherFreeDay(teacherId, day) &&
      !isTeacherBlockedHour(teacherId, day, hour)
    );
  }

  function restoreCheckpoint(checkpointId) {
    const checkpoint = checkpoints.find((item) => item.id === checkpointId);

    if (!checkpoint) return;

    if (!confirm("לשחזר את המערכת לנקודת השמירה הזו? הפעולה תחליף את המצב הנוכחי.")) {
      return;
    }

    const normalizedSchoolData = ensureDailyHoursForClasses(
      checkpoint.schoolData
    );

    setSchoolData(normalizedSchoolData);
    setSchedule(checkpoint.schedule || {});
    setHistory([]);
    setFuture([]);

    localStorage.setItem("schoolData", JSON.stringify(normalizedSchoolData));
    localStorage.setItem(
      "schoolSchedule",
      JSON.stringify(checkpoint.schedule || {})
    );

    setCurrentCheckpointId(checkpointId);
    setComparisonCheckpointId(getPreviousCheckpointId(checkpointId));
  }

  function quickPlaceSelectedLoadUnit(hour) {
    if (!selectedLoadUnitId) return;

    const unit = getUnitById(selectedLoadUnitId);
    if (!unit) return;

    if (isBlockedCell(unit.className, selectedDay, hour)) {
      alert("לא ניתן לשבץ בשעה שאינה קיימת בכיתה זו ביום זה");
      return;
    }

    if (!canTeacherWorkAt(unit.teacherId, selectedDay, hour)) {
      alert("לא ניתן לשבץ מורה ביום החופשי שלו");
      return;
    }

    const unitsToPlace = getSameTimeGroupUnits(unit);

    const invalidUnits = unitsToPlace.filter((candidate) => {
      const alreadyInTarget = getCellUnitIds(
        selectedDay,
        candidate.className,
        hour
      ).includes(candidate.id);

      return (
        !alreadyInTarget &&
        !canUnitFillCell(candidate, selectedDay, candidate.className, hour)
      );
    });

    if (invalidUnits.length > 0) {
      alert("לא ניתן לשבץ את כל הקבוצה");
      return;
    }

    placeUnitsByClassAtHour(unitsToPlace, String(hour), false);
  }

  function hasRule(group, ruleName) {
    return group?.rules?.includes(ruleName) || group?.type === ruleName;
  }

  function violatesConstraintRules(unit, day, className, hour, options = {}) {
    const ignoredUnitIds = new Set(options.ignoredUnitIds || []);

    if (!unit?.constraintGroupId) return false;

    const group = getConstraintGroupById(unit.constraintGroupId);

    if (!group) return false;

    // אסור באותה שורה: לא עוד יחידה מאותה קבוצה באותה כיתה באותו יום
    if (hasRule(group, "notSameDaySameClass")) {
      const classHours = getClassHoursForDay(className, day);

      for (let currentHour = 1; currentHour <= classHours; currentHour++) {
        const unitIds = getCellUnitIds(day, className, currentHour);

        for (const unitId of unitIds) {
          if (ignoredUnitIds.has(unitId)) continue;

          const scheduledUnit = getUnitById(unitId);

          if (scheduledUnit?.constraintGroupId === unit.constraintGroupId) {
            return true;
          }
        }
      }
    }

    // אסור באותו טור: לא עוד יחידה מאותה קבוצה באותה שעה בכיתה אחרת/אותה כיתה
    if (hasRule(group, "notSameTime")) {
      for (const currentClassName of classes) {
        const unitIds = getCellUnitIds(day, currentClassName, hour);

        for (const unitId of unitIds) {
          if (ignoredUnitIds.has(unitId)) continue;

          const scheduledUnit = getUnitById(unitId);

          if (scheduledUnit?.constraintGroupId === unit.constraintGroupId) {
            return true;
          }
        }
      }
    }

    return false;
  }



  function getDailyBalanceColor(className, day) {
    const remaining = getRemainingHoursForClassInDay(className, day);
    const unfilledHours = getUnfilledHoursForClassInDay(className, day);

    // היום הושלם
    if (unfilledHours === 0) {
      return "#b3e5fc"; // תכלת
    }

    const ratio = remaining / unfilledHours;

    if (ratio <= 0.25) return "#b71c1c";
    if (ratio <= 0.5) return "#e53935";
    if (ratio <= 0.75) return "#fb8c00";
    if (ratio <= 1.0) return "#fdd835";
    if (ratio <= 1.25) return "#9ccc65";
    if (ratio <= 1.5) return "#43a047";

    return "#1b5e20";
  }

  function isUnitAvailableForSelectedCell(unit) {
    if (!selectedCell) return false;

    return canUnitFillCell(
      unit,
      selectedDay,
      selectedCell.className,
      selectedCell.hour
    );
  }

  async function loadProjectFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const projectData = JSON.parse(text);

      if (!projectData.schoolData || !projectData.schedule) {
        throw new Error("קובץ הפרויקט אינו תקין");
      }

      const normalizedSchoolData = ensureDailyHoursForClasses(
        projectData.schoolData
      );

      setSchoolData(normalizedSchoolData);
      setSchedule(projectData.schedule || {});
      setTeacherHighlights(
        projectData.teacherHighlights || createDefaultTeacherHighlights()
      );


      setCheckpoints(projectData.checkpoints || []);
      setCurrentCheckpointId(
        projectData.currentCheckpointId || projectData.activeCheckpointId || ""
      );

      setComparisonCheckpointId(projectData.comparisonCheckpointId || "");

      setHistory([]);
      setFuture([]);

      localStorage.setItem("schoolData", JSON.stringify(normalizedSchoolData));
      localStorage.setItem(
        "schoolSchedule",
        JSON.stringify(projectData.schedule || {})
      );
      localStorage.setItem(
        "teacherHighlights",
        JSON.stringify(
          projectData.teacherHighlights || createDefaultTeacherHighlights()
        )
      );

      localStorage.setItem(
        "checkpoints",
        JSON.stringify(projectData.checkpoints || [])
      );

      localStorage.setItem(
        "currentCheckpointId",
        projectData.currentCheckpointId || projectData.activeCheckpointId || ""
      );

      localStorage.setItem(
        "comparisonCheckpointId",
        projectData.comparisonCheckpointId || ""
      );

      alert("הפרויקט נטען בהצלחה");
    } catch (error) {
      console.error(error);
      alert("טעינת הפרויקט נכשלה: " + error.message);
    } finally {
      event.target.value = "";
    }
  }

  function getTeacherHighlight(teacher) {
    if (!teacher) return null;

    for (const highlight of teacherHighlights) {
      const query = highlight.query.trim();

      if (!query) continue;

      const isNumericQuery = /^\d+$/.test(query);

      if (isNumericQuery && teacher.id === query) {
        return highlight;
      }

      if (
        !isNumericQuery &&
        teacher.name?.toLowerCase().includes(query.toLowerCase())
      ) {
        return highlight;
      }
    }

    return null;
  }

  function getClassHoursForDay(className, day) {
    return Number(dailyHoursByClass?.[className]?.[day]) || 0;
  }

  function getMaxHoursForDay(day) {
    return Math.max(
      0,
      ...classes.map((className) =>
        shouldShowClassInSelectedDay(className)
          ? getClassHoursForDay(className, day)
          : 0
      )
    );
  }

  function ensureDailyHoursForClasses(schoolData) {
    const existing = schoolData.dailyHoursByClass || {};
    const result = { ...existing };

    for (const className of schoolData.classes || []) {
      if (!result[className]) {
        result[className] = {};
      }

      for (const day of schoolData.days || []) {
        if (result[className][day] === undefined) {
          result[className][day] = 6;
        }
      }
    }

    return {
      ...schoolData,
      dailyHoursByClass: result,
    };
  }

  function buildTeachingUnitsFromSheetRows(sheetRows) {
    const mergedMap = new Map();

    for (const row of sheetRows) {
      if (!row.teacherId || !row.className || Number(row.hours) <= 0) continue;

      const key = `${row.className}|${row.teacherId}`;

      if (!mergedMap.has(key)) {
        mergedMap.set(key, {
          className: row.className,
          teacherId: row.teacherId,
          subject: "רגיל",
          hours: 0,
          constraintGroupId: null,
        });
      }

      mergedMap.get(key).hours += Number(row.hours) || 0;
    }

    return [...mergedMap.values()].map((row, index) => ({
      id: `base-${row.className}-${row.teacherId}-${index}`,
      ...row,
    }));
  }

  function buildTeachingLoadsFromUnits(units, classes) {
    const teachingLoads = {};

    for (const className of classes) {
      teachingLoads[className] = {};
    }

    for (const unit of units) {
      if (!teachingLoads[unit.className]) {
        teachingLoads[unit.className] = {};
      }

      teachingLoads[unit.className][unit.teacherId] =
        (teachingLoads[unit.className][unit.teacherId] || 0) + unit.hours;
    }

    return teachingLoads;
  }

  function countUnitScheduled(unitId, scheduleObject) {
    let count = 0;

    for (const day of days) {
      for (const className of classes) {
        for (const hour of hours) {
          const value = scheduleObject[day]?.[className]?.[hour];
          const unitIds = Array.isArray(value) ? value : value ? [value] : [];

          if (unitIds.includes(unitId)) {
            count++;
          }
        }
      }
    }

    return count;
  }

  function trimScheduleToUnitHours(nextUnits) {
    let removedCount = 0;

    setSchedule((prevSchedule) => {
      const nextSchedule = structuredClone(prevSchedule);

      for (const unit of nextUnits) {
        let scheduledCount = countUnitScheduled(unit.id, nextSchedule);

        while (scheduledCount > unit.hours) {
          let removed = false;

          for (const day of days) {
            for (const className of classes) {
              for (const hour of hours) {
                const currentUnitIds = getCellUnitIdsFromSchedule(
                  nextSchedule,
                  day,
                  className,
                  hour
                );

                if (currentUnitIds.includes(unit.id)) {
                  const nextUnitIds = currentUnitIds.filter(
                    (id, index) =>
                      id !== unit.id || index !== currentUnitIds.indexOf(unit.id)
                  );

                  setCellUnitIds(
                    nextSchedule,
                    day,
                    className,
                    hour,
                    nextUnitIds
                  );

                  scheduledCount--;
                  removedCount++;
                  removed = true;
                  break;
                }
              }

              if (removed) break;
            }

            if (removed) break;
          }
        }
      }

      return nextSchedule;
    });

    if (removedCount > 0) {
      alert(`בעקבות הפחתת שעות הוסרו ${removedCount} שיבוצים קיימים.`);
    }
  }

  function getPurpleHoleKey(hole) {
    return `${hole.day}|${hole.className}|${hole.hour}`;
  }

  function getPurpleHolesForDayFromSchedule(scheduleObject, dayToCheck) {
    const holes = [];

    for (const className of classes) {
      const classHours = getClassHoursForDay(className, dayToCheck);

      for (let hour = 1; hour <= classHours; hour++) {
        if (isPurpleHoleCellInSchedule(scheduleObject, dayToCheck, className, hour)) {
          holes.push({
            day: dayToCheck,
            className,
            hour,
          });
        }
      }
    }

    return holes;
  }

  function isPurpleHoleCellInSchedule(scheduleObject, day, className, hour) {
    if (isBlockedCell(className, day, hour)) return false;

    const unitIds = getCellUnitIdsFromSchedule(
      scheduleObject,
      day,
      className,
      hour
    );

    if (unitIds.length > 0) return false;

    return !teachingUnits.some((unit) =>
      canUnitFillCellInSchedule(unit, scheduleObject, day, className, hour)
    );
  }

  function canUnitFillCellInSchedule(unit, scheduleObject, day, className, hour) {
    if (!unit) return false;

    if (unit.className !== className) return false;

    if (getRemainingUnitHours(unit.id, scheduleObject) <= 0) return false;

    if (!canTeacherWorkAt(unit.teacherId, day, hour)) return false;

    if (
      isTeacherBusyAtInSchedule(
        unit.teacherId,
        day,
        hour,
        scheduleObject
      )
    ) {
      return false;
    }

    return true;
  }

  function isTeacherBusyAtInSchedule(teacherId, day, hour, scheduleObject) {
    for (const className of classes) {
      const unitIds = getCellUnitIdsFromSchedule(
        scheduleObject,
        day,
        className,
        hour
      );

      for (const unitId of unitIds) {
        const unit = getUnitById(unitId);

        if (unit?.teacherId === teacherId) {
          return true;
        }
      }
    }

    return false;
  }

  function updateSadinRows(nextRows) {
    requestPurpleHoleCheck();
    const nextUnits = buildTeachingUnitsFromSheetRows(nextRows);
    const nextTeachingLoads = buildTeachingLoadsFromUnits(nextUnits, classes);

    setSchoolData((prev) => ({
      ...prev,
      sheetRows: nextRows,
      rawSubjectRows: nextRows,
      teachingUnits: nextUnits,
      teachingLoads: nextTeachingLoads,
    }));

    trimScheduleToUnitHours(nextUnits);

  }

  function getVisibleHoursForSelectedDay() {
    const maxHours = getMaxHoursForDay(selectedDay);

    return Array.from({ length: maxHours }, (_, index) => index + 1);
  }

  function isBlockedCell(className, day, hour) {
    return Number(hour) > getClassHoursForDay(className, day);
  }

  function splitUnitAndAssignGroup(unitId, groupId, hoursToAssign, subject) {
    setSchoolData((prev) => {
      const originalUnit = prev.teachingUnits.find((unit) => unit.id === unitId);

      if (!originalUnit) return prev;

      const hoursNumber = Number(hoursToAssign);

      if (!hoursNumber || hoursNumber <= 0) {
        alert("יש להזין מספר שעות תקין");
        return prev;
      }

      if (hoursNumber > originalUnit.hours) {
        alert("אי אפשר לשייך יותר שעות ממספר השעות של היחידה");
        return prev;
      }

      const isRemovingGroup = !groupId;
      const cleanSubject = isRemovingGroup
        ? "רגיל"
        : subject.trim() || originalUnit.subject || "רגיל";

      const updatedUnits = prev.teachingUnits.flatMap((unit) => {
        if (unit.id !== unitId) return [unit];

        // שינוי כל היחידה
        if (hoursNumber === originalUnit.hours) {
          return [
            {
              ...originalUnit,
              subject: cleanSubject,
              constraintGroupId: groupId || null,
            },
          ];
        }

        // פיצול חלקי
        const remainingOriginalUnit = {
          ...originalUnit,
          hours: originalUnit.hours - hoursNumber,
        };

        const newSplitUnit = {
          ...originalUnit,
          id: `${originalUnit.id}-split-${Date.now()}`,
          hours: hoursNumber,
          subject: cleanSubject,
          constraintGroupId: groupId || null,
        };

        return [remainingOriginalUnit, newSplitUnit];
      });

      return {
        ...prev,
        teachingUnits: mergeSimilarUnitsInList(updatedUnits),
      };
    });

    setGroupDialogUnit(null);
    setGroupDialogHours("");
    setGroupDialogSubject("");
  }

  function getWarnings() {
    const warnings = [];

    for (const day of days) {
      for (const className of classes) {
        for (const hour of hours) {
          const unitIds = getCellUnitIds(day, className, hour);
          const units = unitIds.map(getUnitById).filter(Boolean);

          for (const unit of units) {
            if (hasTeacherConflict(className, hour, unit.teacherId, day)) {
              warnings.push({
                type: "teacherConflict",
                day,
                className,
                hour,
                unitId: unit.id,
                teacherId: unit.teacherId,
              });
            }

            if (hasNotSameTimeConflict(className, hour, unit, day)) {
              warnings.push({
                type: "notSameTime",
                day,
                className,
                hour,
                unitId: unit.id,
                groupId: unit.constraintGroupId,
              });
            }

            if (hasNotSameDaySameClassConflict(className, hour, unit, day)) {
              warnings.push({
                type: "notSameDaySameClass",
                day,
                className,
                hour,
                unitId: unit.id,
                groupId: unit.constraintGroupId,
              });
            }
          }
        }
      }
    }

    return warnings;
  }

  function isHomeroomTeacherForClass(unit) {
    const teacher = getTeacherById(unit.teacherId);

    return teacher?.educationClass === unit.className;
  }

  function getUnitDisplayGroup(unit) {
    const group = getConstraintGroupById(unit.constraintGroupId);
    //const group = getUnitDisplayGroup(unit);
    if (group) return group;

    if (isHomeroomTeacherForClass(unit)) {
      return {
        id: "homeroom-teacher",
        name: "מחנך/ת כיתה",
        color: schoolData.homeroomTeacherColor || "#c8e6c9",
        rules: [],
      };
    }

    return null;
  }

  function saveConstraintGroup(groupToSave) {
    setSchoolData((prev) => {
      const exists = prev.constraintGroups.some(
        (group) => group.id === groupToSave.id
      );

      const constraintGroups = exists
        ? prev.constraintGroups.map((group) =>
          group.id === groupToSave.id ? groupToSave : group
        )
        : [...prev.constraintGroups, groupToSave];

      return {
        ...prev,
        constraintGroups,
      };
    });

    setEditingConstraintGroup(null);
    setShowConstraintGroupDialog(false);
  }
  function isTeacherCellChanged(
    teacherId,
    day,
    hour
  ) {
    const checkpoint = getComparisonCheckpoint();

    if (!checkpoint) return false;

    const currentClasses = getTeacherClassesForCell(
      schedule,
      teacherId,
      day,
      hour
    );

    const checkpointClasses = getTeacherClassesForCell(
      checkpoint.schedule || {},
      teacherId,
      day,
      hour
    );

    return currentClasses !== checkpointClasses;
  }

  function getTeacherClassesForCell(
    scheduleObject,
    teacherId,
    day,
    hour
  ) {
    const result = [];

    for (const className of classes) {
      const unitIds =
        scheduleObject?.[day]?.[className]?.[hour] || [];

      const units = unitIds
        .map(getUnitById)
        .filter(Boolean);

      if (
        units.some(
          (unit) => unit.teacherId === teacherId
        )
      ) {
        result.push(className);
      }
    }

    return result.sort().join("|");
  }

  function deleteConstraintGroup(groupId) {
    if (!confirm("למחוק את קבוצת השיבוץ? השיוך יוסר מכל היחידות.")) {
      return;
    }

    setSchoolData((prev) => ({
      ...prev,
      constraintGroups: prev.constraintGroups.filter(
        (group) => group.id !== groupId
      ),
      teachingUnits: prev.teachingUnits.map((unit) =>
        unit.constraintGroupId === groupId
          ? { ...unit, constraintGroupId: null }
          : unit
      ),
    }));

    if (highlightedGroupId === groupId) {
      setHighlightedGroupId(null);
    }
  }

  function updateScheduleWithHistory(updater) {
    const currentSchedule = scheduleRef.current;

    const nextSchedule =
      typeof updater === "function" ? updater(currentSchedule) : updater;

    setHistory((prevHistory) => [...prevHistory, currentSchedule]);
    setFuture([]);
    setSchedule(nextSchedule);
  }

  function groupHasRule(group, rule) {
    if (!group) return false;

    if (Array.isArray(group.rules)) {
      return group.rules.includes(rule);
    }

    // תמיכה בנתונים ישנים שעדיין משתמשים ב-type
    return group.type === rule;
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

  function mergeSimilarUnitsInList(units) {
    const mergedMap = new Map();
    const result = [];

    for (const unit of units) {
      const key = [
        unit.className,
        unit.teacherId,
        unit.subject || "רגיל",
        unit.constraintGroupId || "",
      ].join("|");

      if (mergedMap.has(key)) {
        const existingUnit = mergedMap.get(key);
        existingUnit.hours += unit.hours;
      } else {
        const copy = { ...unit };
        mergedMap.set(key, copy);
        result.push(copy);
      }
    }

    return result;
  }

  useEffect(() => {
    function handleKeyDown(event) {
      const tagName = event.target.tagName;

      if (
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT"
      ) {
        return;
      }
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

      if (event.altKey) {
        const key = event.key.toLowerCase();

        if (["1", "2", "3", "4", "5", "6"].includes(key)) {
          event.preventDefault();
          setSelectedDay(days[Number(key) - 1]);
          setSelectedCell(null);
          return;
        }

        if (key === "c" || key === "ק") {
          event.preventDefault();
          setDisplayMode("codes");
          return;
        }

        if (key === "n" || key === "מ") {
          event.preventDefault();
          setDisplayMode("names");
          return;
        }

        if (key === "f" || key === "כ") {
          event.preventDefault();
          setIsFocusMode((prev) => !prev);
          return;
        }

        if (key === "v" || key === "ת") {
          event.preventDefault();
          setShowPanelsMenu((prev) => !prev);
          return;
        }

        if (key === "q" || event.key === "/") {
          event.preventDefault();
          setSelectedLoadUnitId(null);
          setDraggedTeacherId(null);
          return;
        }
      }

      if (event.ctrlKey && (event.key.toLowerCase() === "d" || event.key === "ג")) {
        event.preventDefault();
        setVisiblePanels((prev) => ({
          ...prev,
          highlights: !prev.highlights,
        }));
        return;
      }

      if (
        event.ctrlKey &&
        ["1", "2", "3", "4"].includes(event.key)
      ) {
        event.preventDefault();
        setVisiblePanels((prev) => ({
          ...prev,
          highlights: true,
        }));

        setTimeout(() => {
          const input = document.querySelector(
            `[data-highlight-index="${Number(event.key) - 1}"]`
          );
          input?.focus();
          input?.select();
        }, 0);

        return;
      }

      if (
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        /^[1-9]$/.test(event.key)
      ) {
        event.preventDefault();
        event.stopPropagation();

        const hour = Number(event.key);
        quickPlaceSelectedLoadUnit(hour);

        return;
      }

      if (event.key === "Control") setCtrlPressed(true);

      if (event.key === "Shift") setShiftPressed(true);

      if (event.key === "Delete" && selectedCell) {
        removeTeacherFromCell(selectedCell.className, selectedCell.hour);
      }
    }

    function handleKeyUp(event) {
      const tagName = event.target.tagName;

      if (
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT"
      ) {
        return;
      }
      if (event.key === "Control") setCtrlPressed(false);
      if (event.key === "Shift") setShiftPressed(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    selectedCell,
    schedule,
    selectedDay,
    selectedLoadUnitId,
    teachingUnits,
    classes,
    days,
    hours,
  ]);


  function removeSameTimeGroupsFromTarget(newSchedule, day, hour, targetUnitIds) {
    const groupIdsToRemove = new Set();

    for (const unitId of targetUnitIds) {
      const unit = getUnitById(unitId);

      if (unit && isSameTimeGroup(unit)) {
        groupIdsToRemove.add(unit.constraintGroupId);
      }
    }

    if (groupIdsToRemove.size === 0) return;

    for (const groupId of groupIdsToRemove) {
      const groupUnits = getScheduledSameTimeGroupUnitsAt(day, hour, groupId);

      for (const unit of groupUnits) {
        const currentUnits = getCellUnitIdsFromSchedule(
          newSchedule,
          day,
          unit.className,
          hour
        );

        setCellUnitIds(
          newSchedule,
          day,
          unit.className,
          hour,
          currentUnits.filter((id) => id !== unit.id)
        );
      }
    }
  }

  function getConstraintGroupById(groupId) {
    return constraintGroups.find((group) => group.id === groupId);
  }

  function getUnitGroupId(unitId) {
    const unit = getUnitById(unitId);

    if (!unit) return null;

    return unit.constraintGroupId;
  }

  function countScheduledUnitHours(unitId, scheduleObject = schedule) {
    let count = 0;

    for (const day of days) {
      for (const className of classes) {
        for (const hour of hours) {
          const unitIds = getCellUnitIdsFromSchedule(
            scheduleObject,
            day,
            className,
            hour
          );

          if (unitIds.includes(unitId)) {
            count++;
          }
        }
      }
    }

    return count;
  }

  function getRemainingUnitHours(unitId, scheduleObject = schedule) {
    const unit = getUnitById(unitId);

    if (!unit) return 0;

    return unit.hours - countScheduledUnitHours(unitId, scheduleObject);
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
          const unitIds = getCellUnitIds(day, className, hour);

          if (unitIds.includes(unitId)) {
            placements.push(`${day}-${hour}`);
          }
        }
      }
    }

    return placements;
  }

  function hasTeacherConflict(currentClass, hour, teacherId, day = selectedDay) {
    const currentUnitIds = getCellUnitIds(day, currentClass, hour);
    const currentUnits = currentUnitIds
      .map(getUnitById)
      .filter((unit) => unit?.teacherId === teacherId);

    for (const className of classes) {
      if (className === currentClass) continue;

      const otherUnitIds = getCellUnitIds(day, className, hour);
      const otherUnits = otherUnitIds
        .map(getUnitById)
        .filter((unit) => unit?.teacherId === teacherId);

      for (const currentUnit of currentUnits) {
        for (const otherUnit of otherUnits) {
          const sameGroup =
            currentUnit.constraintGroupId &&
            currentUnit.constraintGroupId === otherUnit.constraintGroupId;

          const group = getConstraintGroupById(currentUnit.constraintGroupId);

          const allowedSameTimeGroup =
            sameGroup && groupHasRule(group, "sameTime");

          if (!allowedSameTimeGroup) {
            return true;
          }
        }
      }
    }

    return false;
  }

  function hasNotSameDaySameClassConflict(currentClass, currentHour, unit, day = selectedDay) {
    const group = getConstraintGroupById(unit.constraintGroupId);

    if (!groupHasRule(group, "notSameDaySameClass")) {
      return false;
    }

    for (const hour of hours) {
      if (String(hour) === String(currentHour)) continue;

      const unitIds = getCellUnitIds(day, currentClass, hour);

      const hasSameGroup = unitIds.some((unitId) => {
        const otherUnit = getUnitById(unitId);

        return (
          otherUnit &&
          otherUnit.constraintGroupId === unit.constraintGroupId
        );
      });

      if (hasSameGroup) {
        return true;
      }
    }

    return false;
  }

  function hasNotSameTimeConflict(currentClass, currentHour, unit, day = selectedDay) {
    const group = getConstraintGroupById(unit.constraintGroupId);

    if (!groupHasRule(group, "notSameTime")) {
      return false;
    }

    for (const className of classes) {
      if (className === currentClass) continue;

      const unitIds = getCellUnitIds(day, className, currentHour);

      const hasSameGroup = unitIds.some((unitId) => {
        const otherUnit = getUnitById(unitId);

        return (
          otherUnit &&
          otherUnit.constraintGroupId === unit.constraintGroupId
        );
      });

      if (hasSameGroup) {
        return true;
      }
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

  function canUnitFillCell(unit, day, className, hour, options = {}) {
    if (!unit) return false;

    if (unit.className !== className) return false;

    if (getRemainingUnitHours(unit.id) <= 0 && !options.allowAlreadyScheduledUnit) {
      return false;
    }

    if (!canTeacherWorkAt(unit.teacherId, day, hour)) return false;

    if (isTeacherBusyAt(unit.teacherId, day, hour)) return false;

    if (violatesConstraintRules(unit, day, className, hour, options)) {
      return false;
    }

    return true;
  }
  function isPurpleHoleCell(day, className, hour) {
    if (isBlockedCell(className, day, hour)) return false;

    const unitIds = getCellUnitIds(day, className, hour);

    if (unitIds.length > 0) return false;

    return !teachingUnits.some((unit) =>
      canUnitFillCell(unit, day, className, hour)
    );
  }

  function getPurpleHoles(dayToCheck = selectedDay) {
    const holes = [];

    for (const className of classes) {
      const classHours = getClassHoursForDay(className, dayToCheck);

      for (let hour = 1; hour <= classHours; hour++) {
        if (isPurpleHoleCell(dayToCheck, className, hour)) {
          holes.push({
            day: dayToCheck,
            className,
            hour,
          });
        }
      }
    }

    return holes;
  }


  function alertNewPurpleHoles(beforeHoles, afterHoles) {
    console.log("purple alert check", {
      enabled: visiblePanels.purpleHoleAlerts,
      beforeHoles,
      afterHoles,
    });
    if (!visiblePanels.purpleHoleAlerts) return;

    const beforeKeys = new Set(beforeHoles.map(getPurpleHoleKey));

    const newHoles = afterHoles.filter(
      (hole) => !beforeKeys.has(getPurpleHoleKey(hole))
    );

    if (newHoles.length === 0) return;

    const text = newHoles
      .map((hole) => `יום ${hole.day}, כיתה ${hole.className}, שעה ${hole.hour}`)
      .join("\n");

    alert(`נוצרו חורים סגולים חדשים:\n\n${text}`);
  }

  function isScheduledUnitMovableToSelectedCell(unit, sourceClassName, sourceHour) {
    if (!selectedCell) return false;

    if (unit.className !== selectedCell.className) return false;

    if (String(sourceHour) === String(selectedCell.hour)) return false;

    if (isCellLocked(selectedDay, sourceClassName, sourceHour)) return false;

    if (!canTeacherWorkAt(unit.teacherId, selectedDay, selectedCell.hour)) {
      return false;
    }

    if (isTeacherBusyAt(unit.teacherId, selectedDay, selectedCell.hour)) {
      return false;
    }

    return true;
  }

  function removeTeacherFromCell(className, hour) {
    if (isCellLocked(selectedDay, className, hour)) {
      alert("לא ניתן למחוק תא נעול");
      return;
    }
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

      const unit = getUnitById(unitId);

      if (
        append &&
        unit &&
        cellAlreadyHasTeacher(currentUnits, unit.teacherId)
      ) {
        return newSchedule;
      }

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

  function isHighlightedGroup(unit) {
    return (
      highlightedGroupId &&
      unit?.constraintGroupId === highlightedGroupId
    );
  }

  function moveSameTimeGroup(
    fromHour,
    toHour,
    groupId,
    append = false,
    swap = false
  ) {
    if (fromHour === toHour) return;

    const groupUnits = getScheduledSameTimeGroupUnitsAt(
      selectedDay,
      fromHour,
      groupId
    );

    if (groupUnits.length === 0) return;

    updateScheduleWithHistory((prev) => {
      const newSchedule = structuredClone(prev);

      const unitsByClass = {};

      for (const unit of groupUnits) {
        if (!unitsByClass[unit.className]) {
          unitsByClass[unit.className] = [];
        }

        unitsByClass[unit.className].push(unit);
      }

      for (const [className, unitsForClass] of Object.entries(unitsByClass)) {
        const unitIdsForClass = unitsForClass.map((unit) => unit.id);

        const fromUnits = getCellUnitIdsFromSchedule(
          newSchedule,
          selectedDay,
          className,
          fromHour
        );

        const toUnits = getCellUnitIdsFromSchedule(
          newSchedule,
          selectedDay,
          className,
          toHour
        );

        const cleanedFromUnits = fromUnits.filter(
          (id) => !unitIdsForClass.includes(id)
        );

        if (swap && toUnits.length > 0) {
          setCellUnitIds(
            newSchedule,
            selectedDay,
            className,
            fromHour,
            [...cleanedFromUnits, ...toUnits]
          );

          setCellUnitIds(
            newSchedule,
            selectedDay,
            className,
            toHour,
            unitIdsForClass
          );
        } else {
          setCellUnitIds(
            newSchedule,
            selectedDay,
            className,
            fromHour,
            cleanedFromUnits
          );

          const nextToUnits = append
            ? [...toUnits, ...unitIdsForClass.filter((id) => !toUnits.includes(id))]
            : unitIdsForClass;

          setCellUnitIds(
            newSchedule,
            selectedDay,
            className,
            toHour,
            nextToUnits
          );
        }
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
    return groupHasRule(group, "sameTime");
  }

  function getSameTimeGroupUnits(unit) {
    if (!unit?.constraintGroupId) return [unit];

    const group = getConstraintGroupById(unit.constraintGroupId);

    if (!groupHasRule(group, "sameTime")) return [unit];

    return teachingUnits.filter(
      (candidate) => candidate.constraintGroupId === unit.constraintGroupId
    );
  }

  function canPlaceUnitAt(unit, day, hour) {
    return canTeacherWorkAt(unit.teacherId, day, hour);
  }

  //return getRemainingUnitHours(unit.id) > 0;
  //}

  function placeUnitsByClassAtHour(unitsToPlace, hour, append = false) {
    updateScheduleWithHistory((prev) => {
      const newSchedule = structuredClone(prev);

      const unitsByClass = {};

      for (const unit of unitsToPlace) {
        if (!unitsByClass[unit.className]) {
          unitsByClass[unit.className] = [];
        }

        unitsByClass[unit.className].push(unit);
      }

      for (const [className, unitsForClass] of Object.entries(unitsByClass)) {
        const currentUnits = getCellUnitIdsFromSchedule(
          newSchedule,
          selectedDay,
          className,
          hour
        );

        if (!append) {
          removeSameTimeGroupsFromTarget(
            newSchedule,
            selectedDay,
            hour,
            currentUnits
          );
        }

        const baseUnits = append ? [...currentUnits] : [];

        for (const unit of unitsForClass) {
          if (!cellAlreadyHasTeacher(baseUnits, unit.teacherId)) {
            baseUnits.push(unit.id);
          }
        }

        setCellUnitIds(
          newSchedule,
          selectedDay,
          className,
          hour,
          baseUnits
        );
      }

      return newSchedule;
    });
  }

  function cellAlreadyHasTeacher(unitIds, teacherId) {
    return unitIds.some((unitId) => {
      const unit = getUnitById(unitId);
      return unit?.teacherId === teacherId;
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

  function mergeSimilarUnits() {
    setSchoolData((prev) => {
      const mergedMap = new Map();
      const result = [];

      for (const unit of prev.teachingUnits) {
        if (isUnitScheduled(unit.id)) {
          result.push(unit);
          continue;
        }

        const key = [
          unit.className,
          unit.teacherId,
          unit.subject || "רגיל",
          unit.constraintGroupId || "",
        ].join("|");

        if (mergedMap.has(key)) {
          const existingUnit = mergedMap.get(key);
          existingUnit.hours += unit.hours;
        } else {
          const copy = { ...unit };
          mergedMap.set(key, copy);
          result.push(copy);
        }
      }

      return {
        ...prev,
        teachingUnits: result,
      };
    });
  }

  function isUnitScheduled(unitId) {
    for (const day of days) {
      for (const className of classes) {
        for (const hour of hours) {
          if (getCellUnitIds(day, className, hour).includes(unitId)) {
            return true;
          }
        }
      }
    }

    return false;
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

  function isMeetingClass(className) {
    return meetings.some((meeting) => meeting.name === className);
  }

  function getMeetingByClassName(className) {
    return meetings.find((meeting) => meeting.name === className);
  }

  function getLegalMeetingDays(meeting) {
    const allowedDays =
      meeting.allowedDays?.length > 0 ? meeting.allowedDays : days;

    return allowedDays.filter((day) =>
      (meeting.teacherIds || []).every((teacherId) => {
        const teacher = getTeacherById(teacherId);
        return !teacher?.freeDays?.includes(day);
      })
    );
  }

  function shouldShowClassInSelectedDay(className) {
    const meeting = getMeetingByClassName(className);

    if (!meeting) return true;

    return getLegalMeetingDays(meeting).includes(selectedDay);
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

    if (active.id === over.id) {
      return;
    }

    const data = active.data.current;
    const overData = over.data.current;

    if (data?.source === "load" && !overData) {
      return;
    }

    // החזרה למחסן
    if (data?.source === "cell" && overData?.source === "loadCell") {
      if (data.fromClass !== overData.className) {
        alert("אפשר להחזיר מורה רק למחסן של אותה כיתה");
        return;
      }

      const beforePurpleHoles = getPurpleHolesForDayFromSchedule(
        schedule,
        selectedDay
      );

      requestPurpleHoleCheck();
      removeTeacherFromCell(data.fromClass, data.fromHour);

      return;
    }

    const [toClass, toHour] = over.id.split("-");

    if (isCellLocked(selectedDay, toClass, toHour)) {
      alert("לא ניתן לשבץ או להחליף תא נעול");
      return;
    }

    if (isBlockedCell(toClass, selectedDay, toHour)) {
      alert("לא ניתן לשבץ בשעה שאינה קיימת בכיתה זו ביום זה");
      return;
    }

    const beforePurpleHoles = getPurpleHolesForDayFromSchedule(
      schedule,
      selectedDay
    );

    // גרירה מתוך הטבלה
    if (data?.source === "cell") {
      const draggedUnitIds = singleDragUnitId
        ? [singleDragUnitId]
        : data.unitIds || [];

      const sameTimeUnit = draggedUnitIds
        .map(getUnitById)
        .find((unit) => unit && isSameTimeGroup(unit));


      if (sameTimeUnit) {
        requestPurpleHoleCheck();
        moveSameTimeGroup(
          data.fromHour,
          toHour,
          sameTimeUnit.constraintGroupId,
          shiftPressed,
          ctrlPressed
        );

        return;
      }

      requestPurpleHoleCheck();

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

    // גרירה מהמחסן
    if (data?.source === "load") {
      if (!overData || overData.source !== "cell") {
        return;
      }

      const unit = getUnitById(data.unitId);

      if (!unit) return;

      if (unit.className !== toClass) {
        alert("אפשר לשבץ רק בשורה של הכיתה שממנה נגררה השעה");
        return;
      }

      const unitsToPlace = getSameTimeGroupUnits(unit);

      const invalidUnits = unitsToPlace.filter((candidate) => {
        const alreadyInTarget = getCellUnitIds(
          selectedDay,
          candidate.className,
          toHour
        ).includes(candidate.id);

        return (
          !alreadyInTarget &&
          !canUnitFillCell(candidate, selectedDay, candidate.className, toHour)
        );
      });

      if (invalidUnits.length > 0) {
        const names = invalidUnits
          .map((candidate) => {
            const teacher = getTeacherById(candidate.teacherId);

            if (isTeacherBlockedHour(candidate.teacherId, selectedDay, toHour)) {
              return `${teacher?.name || candidate.teacherId
                } (${candidate.className}) — חסום/ה בשעה זו`;
            }

            if (isTeacherFreeDay(candidate.teacherId, selectedDay)) {
              return `${teacher?.name || candidate.teacherId
                } (${candidate.className}) — ביום חופשי`;
            }

            return `${teacher?.name || candidate.teacherId} (${candidate.className
              })`;
          })
          .join(", ");

        alert(`לא ניתן לשבץ: ${names}`);
        return;
      }

      requestPurpleHoleCheck();

      placeUnitsByClassAtHour(unitsToPlace, toHour, shiftPressed);



      return;
    }
  }

  function getPurpleHolesForAllDaysFromSchedule(scheduleObject) {
    const holes = [];

    for (const day of days) {
      holes.push(
        ...getPurpleHolesForDayFromSchedule(scheduleObject, day)
      );
    }

    return holes;
  }

  async function handleExcelUpload(event) {
    const file = event.target.files[0];

    if (!file) return;

    try {
      const result = await readExcelFile(file);
      let parsedData;

      try {
        parsedData = buildDataFromRawSadin(result);
      } catch (rawError) {
        console.error("Raw sadin import failed:", rawError);

        try {
          parsedData = buildDataFromTimetableSheet(result);
        } catch (processedError) {
          console.error("Processed timetable import failed:", processedError);
          throw new Error(
            `ייבוא הסדין נכשל. הגליונות שנמצאו בקובץ הם: ${result.sheetNames.join(", ")}`
          );
        }
      }
      //const parsedData = buildDataFromTimetableSheet(result);


      setImportedExcel(result);
      const normalizedData = ensureDailyHoursForClasses(parsedData);

      setSchoolData(normalizedData);
      localStorage.setItem("schoolData", JSON.stringify(normalizedData));
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

  const warnings = getWarnings();
  const visibleHours = getVisibleHoursForSelectedDay();

  return (

    <DndContext
      onDragStart={(event) => {
        const data = event.active.data.current;

        let unitId = null;
        let className = null;

        if (data?.source === "load") {
          unitId = data.unitId;
          const unit = getUnitById(unitId);
          className = unit?.className || null;
          setDragOriginCell(null);
        }

        if (data?.source === "cell") {
          setDragSource("cell");
          setDragOriginCell({
            className: data.fromClass,
            hour: String(data.fromHour),
          });
          className = data.fromClass || null;

          if (shiftPressed) {
            const target = event.activatorEvent?.target;
            const unitElement = target?.closest?.("[data-unit-id]");
            unitId = unitElement?.dataset?.unitId || null;
            setSingleDragUnitId(unitId || null);
          } else {
            setSingleDragUnitId(null);
            unitId = data.unitIds?.[0] || null;
          }
        }

        const unit = getUnitById(unitId);

        setDraggedTeacherId(unit?.teacherId || null);
        setDraggedClassName(className);
        setHighlightedGroupId(unit?.constraintGroupId || null);
        setActivePlacementUnitId(unitId || null);
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
        setDragSource(null);
        const data = event.active.data.current;

        setHoveredCell(null);
        handleDragEnd(event);
        setSingleDragUnitId(null);
        setDraggedTeacherId(null);
        setDraggedClassName(null);

        const overData = event.over?.data?.current;

        if (overData?.source === "cell") {
          setSelectedLoadUnitId(null);
          setActivePlacementUnitId(null);
        }
        setDragOriginCell(null);
      }}

      onDragCancel={() => {
        setDragSource(null);
        setHoveredCell(null);
        setSingleDragUnitId(null);
        setDraggedTeacherId(null);
        setDraggedClassName(null);
        setDragOriginCell(null);
      }}
    >


      <div
        className={isFocusMode ? "container focus-mode" : "container"}
        style={{
          "--row-height-offset": `${rowHeightOffset}px`,
        }}
      >
        {!isFocusMode && <h1>מערכת שעות - ממ"ד אריאל</h1>}
        {!isFocusMode && (
          <div className="view-tabs">
            <button
              className={activeView === "file" ? "active-tab" : ""}
              onClick={() => setActiveView("file")}
            >
              קובץ
            </button>
            <button
              className={activeView === "scheduler" ? "active-tab" : ""}
              onClick={() => setActiveView("scheduler")}
            >
              בונה מערכת
            </button>

            <button
              className={activeView === "shahaf" ? "active-tab" : ""}
              onClick={() => setActiveView("shahaf")}
            >
              תצוגת כיתות
            </button>
            <button
              className={activeView === "teacher" ? "active-tab" : ""}
              onClick={() => setActiveView("teacher")}
            >
              תצוגת מורה
            </button>
            <button
              className={activeView === "teachers" ? "active-tab" : ""}
              onClick={() => setActiveView("teachers")}
            >
              ניהול מורים
            </button>
            <button
              className={activeView === "classes" ? "active-tab" : ""}
              onClick={() => setActiveView("classes")}
            >
              ניהול כיתות
            </button>

            <button
              className={activeView === "dailyHours" ? "active-tab" : ""}
              onClick={() => setActiveView("dailyHours")}
            >
              שעות יומיות
            </button>

            <button
              className={activeView === "sadin" ? "active-tab" : ""}
              onClick={() => setActiveView("sadin")}
            >
              גליון סדין
            </button>

            <button
              className={activeView === "meetings" ? "active-tab" : ""}
              onClick={() => setActiveView("meetings")}
            >
              ישיבות צוות
            </button>
            {selectedCloudProjectId && (
              <span
                className={
                  hasUnsavedCloudChanges
                    ? "cloud-status-badge cloud-status-unsaved"
                    : "cloud-status-badge cloud-status-saved"
                }
              >
                {hasUnsavedCloudChanges
                  ? "☁ לא נשמר"
                  : `☁ שמור${lastCloudSavedAt ? ` ${lastCloudSavedAt}` : ""}`}
              </span>
            )}
          </div>
        )}
        {activeView === "scheduler" && (
          <>
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

              <div className="panels-menu-wrapper" ref={panelsMenuRef}>
                <button
                  className="action-button"
                  onClick={() => setShowPanelsMenu((prev) => !prev)}
                >
                  תצוגה ▾
                </button>

                {showPanelsMenu && (
                  <div className="panels-menu">
                    <label>
                      <input
                        type="checkbox"
                        checked={visiblePanels.groups}
                        onChange={() => togglePanel("groups")}
                      />
                      קבוצות שיבוץ
                    </label>

                    <label>
                      <input
                        type="checkbox"
                        checked={visiblePanels.warnings}
                        onChange={() => togglePanel("warnings")}
                      />
                      מרכז אזהרות
                    </label>

                    <label>
                      <input
                        type="checkbox"
                        checked={visiblePanels.highlights}
                        onChange={() => togglePanel("highlights")}
                      />
                      הדגשת מורים
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={visiblePanels.difficultyHints}
                        onChange={() => togglePanel("difficultyHints")}
                      />
                      הצג דרגות קושי
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={showFreeDayTeachers}
                        onChange={(e) => setShowFreeDayTeachers(e.target.checked)}
                      />
                      הצג מורים ביום חופשי
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={visiblePanels.purpleHoleAlerts}
                        onChange={() => togglePanel("purpleHoleAlerts")}
                      />
                      התראות חור סגול
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={visiblePanels.dailyBalance}
                        onChange={() => togglePanel("dailyBalance")}
                      />
                      יתרת יום
                    </label>
                    <div className="view-slider-control">
                      <label>
                        גובה שורות: {rowHeightOffset > 0 ? `+${rowHeightOffset}` : rowHeightOffset}px
                      </label>

                      <input
                        type="range"
                        min="-8"
                        max="20"
                        step="1"
                        value={rowHeightOffset}
                        onChange={(e) => setRowHeightOffset(Number(e.target.value))}
                      />
                    </div>
                    {selectedLoadUnitId && (
                      <button
                        className="mini-button"
                        onClick={() => setSelectedLoadUnitId(null)}
                      >
                        נקה מורה פעיל
                      </button>
                    )}
                  </div>
                )}

              </div>

              <button
                className="action-button focus-toggle-button"
                onClick={() => {
                  setIsFocusMode((prev) => {
                    const next = !prev;

                    if (next) {
                      setVisiblePanels({
                        groups: false,
                        warnings: false,
                        highlights: false,
                        dailyBalance: false,
                        purpleHoleAlerts: true,
                        groups: true,
                      });
                    }

                    return next;
                  });
                }}
              >
                {isFocusMode ? "צא ממסך שיבוץ מלא" : "מסך שיבוץ מלא"}
              </button>

            </div>

            {visiblePanels.groups && (
              <ConstraintGroupsPanel
                constraintGroups={constraintGroups}
                homeroomTeacherColor={schoolData.homeroomTeacherColor || "#c8e6c9"}
                onCreateGroup={() => {
                  setEditingConstraintGroup(null);
                  setShowConstraintGroupDialog(true);
                }}
                onEditGroup={(group) => {
                  setEditingConstraintGroup(group);
                  setShowConstraintGroupDialog(true);
                }}
                onDeleteGroup={deleteConstraintGroup}
                onHighlightGroup={setHighlightedGroupId}
              />
            )}

            {visiblePanels.warnings && (
              <WarningsPanel warnings={warnings} selectedDay={selectedDay} />
            )}

            {visiblePanels.highlights && (
              <TeacherHighlightPanel
                teacherHighlights={teacherHighlights}
                setTeacherHighlights={setTeacherHighlights}
              />
            )}

            <div
              className="table-scroll-wrapper"
              ref={tableScrollRef}
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>מחסן שעות</th>
                    {visiblePanels.dailyBalance && <th>יתרת יום</th>}
                    <th>כיתה</th>
                    {visibleHours.map((hour) => (<th
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
                  {classes
                    .filter((className) => shouldShowClassInSelectedDay(className))
                    .map((className) => (
                      <tr key={className}>

                        <LoadCell className={className}>
                          {teachingUnits
                            .filter((unit) => unit.className === className)
                            .map((unit) => {
                              const teacher = getTeacherById(unit.teacherId);
                              const remaining = getRemainingUnitHours(unit.id);
                              const isFreeDay = isTeacherFreeDay(unit.teacherId, selectedDay);

                              if (!showFreeDayTeachers && isFreeDay) return null;
                              //const group = getConstraintGroupById(unit.constraintGroupId);
                              const group = getUnitDisplayGroup(unit);
                              const teacherHighlight = getTeacherHighlight(teacher);
                              const availableForSelectedCell = isUnitAvailableForSelectedCell(unit);

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
                                  teacherHighlight={teacherHighlight}
                                  selectedLoadUnitId={selectedLoadUnitId}
                                  availableForSelectedCell={availableForSelectedCell}
                                  onSelectLoadUnit={(unitId) => {
                                    setSelectedLoadUnitId(unitId);
                                    setActivePlacementUnitId(unitId);
                                  }}
                                  onAssignGroup={(unit) => {
                                    setGroupDialogUnit(unit);
                                    setGroupDialogHours(String(unit.hours));
                                    setGroupDialogSubject(
                                      unit.subject && unit.subject !== "רגיל" ? unit.subject : ""
                                    );
                                  }}
                                  onHighlightGroup={setHighlightedGroupId}
                                  highlightedGroup={isHighlightedGroup(unit)}
                                />
                              );
                            })
                          }
                        </LoadCell>

                        {visiblePanels.dailyBalance && (() => {
                          const balanceColor = getDailyBalanceColor(className, selectedDay);

                          return (
                            <td
                              className="daily-balance-cell"
                              style={{
                                backgroundColor: balanceColor,
                                color: getBalanceTextColor(balanceColor),
                              }}
                            >
                              {getRemainingHoursForClassInDay(className, selectedDay)}
                            </td>
                          );
                        })()}

                        <td
                          className={
                            hoveredCell?.className === className
                              ? "class-name highlighted-header"
                              : "class-name"
                          }
                        >
                          {className}
                        </td>

                        {visibleHours.map((hour) => {
                          const unitIds = getCellUnitIds(selectedDay, className, hour);
                          const units = unitIds.map(getUnitById).filter(Boolean);
                          const availableScheduledUnitsForSelectedCell = new Set();

                          const teachersByUnit = {};
                          const groupsByUnit = {};
                          const teacherHighlightsByUnit = {};

                          for (const unit of units) {
                            const teacher = getTeacherById(unit.teacherId);
                            if (isScheduledUnitMovableToSelectedCell(unit, className, hour)) {
                              availableScheduledUnitsForSelectedCell.add(unit.id);
                            }
                            teachersByUnit[unit.id] = teacher;
                            groupsByUnit[unit.id] = getUnitDisplayGroup(unit);
                            teacherHighlightsByUnit[unit.id] = getTeacherHighlight(teacher);
                          }

                          const conflictingTeacherIds = units
                            .filter(
                              (unit) =>
                                hasTeacherConflict(className, hour, unit.teacherId) ||
                                hasNotSameDaySameClassConflict(className, hour, unit) ||
                                hasNotSameTimeConflict(className, hour, unit)
                            )
                            .map((unit) => unit.teacherId);

                          const selected =
                            selectedCell?.className === className &&
                            selectedCell?.hour === String(hour);

                          const highlighted =
                            hoveredCell?.className === className &&
                            hoveredCell?.hour === String(hour);

                          const highlightedUnitIds = new Set(
                            units
                              .filter(
                                (unit) =>
                                  highlightedGroupId &&
                                  unit.constraintGroupId === highlightedGroupId
                              )
                              .map((unit) => unit.id)
                          );

                          const blocked = isBlockedCell(className, selectedDay, hour);
                          const placementHint = getPlacementHint(className, selectedDay, hour);
                          const purpleHole = isPurpleHoleCell(selectedDay, className, hour);
                          const difficultyCount = visiblePanels.difficultyHints
                            ? getDifficultyCount(className, selectedDay, hour)
                            : null;
                          const activeTeacherHere = cellHasActiveTeacher(
                            className,
                            selectedDay,
                            hour
                          );
                          const locked = isCellLocked(selectedDay, className, hour);

                          return (
                            <DroppableCell
                              purpleHole={purpleHole}
                              locked={locked}
                              availableScheduledUnitsForSelectedCell={availableScheduledUnitsForSelectedCell}
                              onToggleLock={() => toggleCellLock(selectedDay, className, hour)}
                              key={hour}
                              className={className}
                              hour={hour}
                              units={units}
                              teachersByUnit={teachersByUnit}
                              groupsByUnit={groupsByUnit}
                              conflictingTeacherIds={conflictingTeacherIds}
                              highlightedUnitIds={highlightedUnitIds}
                              selected={selected}
                              blocked={blocked}
                              highlighted={highlighted}
                              displayMode={displayMode}
                              placementHint={placementHint}
                              activeTeacherHere={activeTeacherHere}
                              teacherHighlightsByUnit={teacherHighlightsByUnit}
                              difficultyCount={difficultyCount}
                              difficultyLevel={getDifficultyLevel(difficultyCount)}
                              onClick={() => {
                                setSelectedCell({
                                  className,
                                  hour: String(hour),
                                });

                                const firstUnit = units[0];

                                setHighlightedGroupId(firstUnit?.constraintGroupId || null);
                              }}
                            />
                          );
                        })}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}


        {activeView === "shahaf" && (
          <ShahafView
            classes={classes}
            days={days}
            hours={hours}
            selectedClassForShahaf={selectedClassForShahaf}
            setSelectedClassForShahaf={setSelectedClassForShahaf}
            getCellUnitIds={getCellUnitIds}
            getUnitById={getUnitById}
            getTeacherById={getTeacherById}
            dailyHoursByClass={dailyHoursByClass}
            getClassHoursForDay={getClassHoursForDay}
            isShahafCellChanged={isShahafCellChanged}

            checkpoints={checkpoints}
            comparisonCheckpointId={comparisonCheckpointId}
            setComparisonCheckpointId={setComparisonCheckpointId}
            comparisonCheckpoint={getComparisonCheckpoint()}
          />
        )}

        {activeView === "teacher" && (
          <TeacherView
            teachers={teachers}
            classes={classes}
            days={days}
            hours={hours}
            selectedTeacherForView={selectedTeacherForView}
            setSelectedTeacherForView={setSelectedTeacherForView}
            getCellUnitIds={getCellUnitIds}
            getUnitById={getUnitById}
            getClassHoursForDay={getClassHoursForDay}
            checkpoints={checkpoints}
            comparisonCheckpointId={comparisonCheckpointId}
            setComparisonCheckpointId={setComparisonCheckpointId}
            comparisonCheckpoint={getComparisonCheckpoint()}
            isTeacherCellChanged={isTeacherCellChanged}
            setSchoolData={setSchoolData}
            isTeacherFreeDay={isTeacherFreeDay}
            isTeacherBlockedHour={isTeacherBlockedHour}
            removeTeacherFromSpecificTime={removeTeacherFromSpecificTime}
            requestPurpleHoleCheck={requestPurpleHoleCheck}
          />
        )}

        {activeView === "teachers" && (
          <TeachersManager
            teachers={teachers}
            setSchoolData={setSchoolData}
            removeTeacherFromDay={removeTeacherFromDay}
            requestPurpleHoleCheck={requestPurpleHoleCheck}
          />
        )}

        {activeView === "classes" && (
          <ClassesManager
            classes={classes}
            teachers={teachers}
            homeroomTeacherColor={schoolData.homeroomTeacherColor || "#c8e6c9"}
            setSchoolData={setSchoolData}
          />
        )}

        {activeView === "meetings" && (
          <MeetingsManager
            teachers={teachers}
            meetings={meetings}
            setSchoolData={setSchoolData}
          />
        )}

        {activeView === "dailyHours" && (
          <DailyHoursManager
            classes={classes}
            days={days}
            dailyHoursByClass={dailyHoursByClass}
            setSchoolData={setSchoolData}
          />
        )}

        {activeView === "sadin" && (
          <SadinSheetEditor
            sheetRows={schoolData.sheetRows || []}
            teachers={teachers}
            classes={classes}
            onUpdateRows={updateSadinRows}
          />
        )}


        {activeView === "file" && (
          <FileManager
            saveProjectToFile={saveProjectToFile}
            loadProjectFromFile={loadProjectFromFile}
            handleExcelUpload={handleExcelUpload}
            clearProject={clearProject}
            user={user}
            setUser={setUser}
            cloudProjects={cloudProjects}
            selectedCloudProjectId={selectedCloudProjectId}
            setSelectedCloudProjectId={setSelectedCloudProjectId}
            loadCloudProjects={loadCloudProjects}
            saveProjectToCloud={saveProjectToCloud}
            updateSelectedCloudProject={updateSelectedCloudProject}
            handleCloudProjectSelection={handleCloudProjectSelection}
            deleteSelectedCloudProject={deleteSelectedCloudProject}
            checkpoints={checkpoints}
            currentCheckpointId={currentCheckpointId}
            createCheckpoint={createCheckpoint}
            deleteCheckpoint={deleteCheckpoint}
            restoreCheckpoint={restoreCheckpoint}
            hasUnsavedCloudChanges={hasUnsavedCloudChanges}
            lastCloudSavedAt={lastCloudSavedAt}
            setShowHelpDialog={setShowHelpDialog}
          />
        )}

        {showHelpDialog && (
          <div className="modal-backdrop" onClick={() => setShowHelpDialog(false)}>
            <div className="group-dialog" onClick={(e) => e.stopPropagation()}>
              <h3>עזרה וקיצורי מקלדת</h3>

              <ul className="help-list">
                <li><strong>Delete</strong> — מוחק תא מסומן.</li>
                <li>גרירה למחסן — מוחקת שיבוץ.</li>
                <li><strong>Ctrl + גרירה</strong> — החלפה בין תאים.</li>
                <li><strong>Shift + גרירה לתא תפוס</strong> — מוסיף מורה לתא.</li>
                <li>לחיצה על מורה במחסן ואז מספר — שיבוץ מהיר באותה שעה.</li>
                <li><strong>Ctrl+Z / Ctrl+ז</strong> — ביטול פעולה.</li>
                <li><strong>Ctrl+Y / Ctrl+ט</strong> — בצע שוב.</li>
                <li><strong>Alt+1–6</strong> — מעבר בין ימים א–ו.</li>
                <li><strong>Alt+C / Alt+ק</strong> — תצוגת קודים.</li>
                <li><strong>Alt+N / Alt+מ</strong> — תצוגת שמות.</li>
                <li><strong>Alt+F / Alt+כ</strong> — מסך שיבוץ מלא.</li>
                <li><strong>Alt+V / Alt+ת</strong> — פתיחה/סגירה של תפריט תצוגה.</li>
                <li><strong>Ctrl+D / Ctrl+ג</strong> — הצגה/הסתרה של פאנל הדגשת מורים.</li>
                <li><strong>Ctrl+1–4</strong> — מעבר לתיבת הדגשת מורה 1–4.</li>
                <li><strong>Alt+Q / Alt+/</strong> — ניקוי מורה פעיל לשיבוץ.</li>
              </ul>

              <button
                className="dialog-cancel"
                onClick={() => setShowHelpDialog(false)}
              >
                סגור
              </button>
            </div>
          </div>
        )}

        {groupDialogUnit && (
          <div className="modal-backdrop" onClick={() => setGroupDialogUnit(null)}>
            <div className="group-dialog" onClick={(e) => e.stopPropagation()}>
              <h3>פיצול ושיוך לקבוצת שיבוץ</h3>

              <p>
                יחידה:{" "}
                <strong>
                  {getTeacherById(groupDialogUnit.teacherId)?.name}
                  {groupDialogUnit.subject && groupDialogUnit.subject !== "רגיל"
                    ? ` / ${groupDialogUnit.subject}`
                    : ""}
                </strong>
              </p>

              <p>סה״כ שעות ביחידה: {groupDialogUnit.hours}</p>

              <label className="dialog-field">
                מספר שעות לשיוך:
                <input
                  type="number"
                  min="1"
                  max={groupDialogUnit.hours}
                  value={groupDialogHours}
                  onChange={(e) => setGroupDialogHours(e.target.value)}
                />
              </label>

              <label className="dialog-field">
                מקצוע / תיאור:
                <input
                  type="text"
                  placeholder="לדוגמה: אנגלית"
                  value={groupDialogSubject}
                  onChange={(e) => setGroupDialogSubject(e.target.value)}
                />
              </label>

              <button
                className="group-option no-group"
                onClick={() =>
                  splitUnitAndAssignGroup(
                    groupDialogUnit.id,
                    null,
                    groupDialogHours,
                    groupDialogSubject
                  )
                }
              >
                ללא קבוצה
              </button>

              {constraintGroups.map((group) => (
                <button
                  key={group.id}
                  className="group-option"
                  onClick={() =>
                    splitUnitAndAssignGroup(
                      groupDialogUnit.id,
                      group.id,
                      groupDialogHours,
                      groupDialogSubject
                    )
                  }
                >
                  <span
                    className="constraint-color"
                    style={{ backgroundColor: group.color }}
                  />
                  {group.name} —{" "}
                  {(group.rules || [group.type])
                    .map((rule) => {
                      if (rule === "sameTime") return "חייב באותו טור";
                      if (rule === "notSameTime") return "אסור באותו טור";
                      if (rule === "notSameDaySameClass") return "אסור באותה שורה";
                      return rule;
                    })
                    .join(" + ")}
                </button>
              ))}

              <button className="dialog-cancel" onClick={() => setGroupDialogUnit(null)}>
                ביטול
              </button>


            </div>
          </div>
        )}

        {showConstraintGroupDialog && (
          <ConstraintGroupDialog
            group={editingConstraintGroup}
            onSave={saveConstraintGroup}
            onCancel={() => {
              setEditingConstraintGroup(null);
              setShowConstraintGroupDialog(false);
            }}
          />
        )}
      </div>


    </DndContext >
  );
}