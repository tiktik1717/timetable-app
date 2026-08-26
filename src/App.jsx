import { useEffect, useRef, useState } from "react";

import { DndContext } from "@dnd-kit/core";
import {
  readExcelFile,
  buildDataFromTimetableSheet,
  buildDataFromRawSadin,
} from "./services/excelImport";

import "./App.css";
import {
  createAgentWorkspace,
  tryWorkspaceMove,
  resetAgentWorkspace,
} from "./scheduling/agentWorkspace";
import { simulateScheduleMove } from "./scheduling/scheduleSimulation";
import SchedulingAgentView from "./components/SchedulingAgentView";
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

import { createSchedulingAgentContext } from "./scheduling/agentContext";
import { validateSchedule } from "./scheduling/scheduleValidator";
import WarningsPanel from "./components/WarningsPanel";
import ConstraintGroupDialog from "./components/ConstraintGroupDialog";
import ShahafView from "./components/ShahafView";
import TeacherView from "./components/TeacherView";
import GroupConstraintsView from "./components/GroupConstraintsView";
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
import ReactMarkdown from "react-markdown";
import { HELP_TEXT } from "./helpText";
import FreeDaysView from "./components/FreeDaysView";
import SchedulingProgressPanel from "./components/SchedulingProgressPanel";

const SCHEDULING_AGENT_STORAGE_KEY = "scheduling-agent-workspace-v1";

function normalizeTeacherHighlights(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return createDefaultTeacherHighlights();
  }

  return value.map((highlight, index) => ({
    query: typeof highlight?.query === "string" ? highlight.query : "",
    color:
      typeof highlight?.color === "string" && highlight.color
        ? highlight.color
        : createDefaultTeacherHighlights()[index]?.color || "#1976d2",
  }));
}

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

  useEffect(() => {
    if (!schoolData?.teachingUnits?.length) {
      return;
    }

    debugValidateCurrentSchedule();
  }, []);

  const panelsMenuRef = useRef(null);
  const [dragSource, setDragSource] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [ctrlPressed, setCtrlPressed] = useState(false);
  const [shiftPressed, setShiftPressed] = useState(false);
  const [displayMode, setDisplayMode] = useState("names");
  const [showFreeDayTeachers, setShowFreeDayTeachers] = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [importedExcel, setImportedExcel] = useState(null);
  const [groupDialogUnit, setGroupDialogUnit] = useState(null);
  const [groupDialogHours, setGroupDialogHours] = useState("");
  const [groupSearchText, setGroupSearchText] = useState("");
  const [singleDragUnitId, setSingleDragUnitId] = useState(null);
  const [highlightedGroupId, setHighlightedGroupId] = useState(null);
  const [showConstraintGroupDialog, setShowConstraintGroupDialog] =
    useState(false);
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
  const [columnSwapMode, setColumnSwapMode] = useState(false);
  const [columnSwapFirstHour, setColumnSwapFirstHour] = useState(null);
  const pendingPurpleHoleCheckRef = useRef(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [rowHeightOffset, setRowHeightOffset] = useState(() => {
    return Number(localStorage.getItem("rowHeightOffset")) || 0;
  });
  const [visiblePanels, setVisiblePanels] = useState({
    groups: false,
    warnings: false,
    highlights: true,
    dailyBalance: true,
    purpleHoleAlerts: true,
    difficultyHints: true,
    progress: false,
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

  const [schedulingAgentRules, setSchedulingAgentRules] = useState(() => {
    try {
      const saved = localStorage.getItem(SCHEDULING_AGENT_STORAGE_KEY);

      if (!saved) {
        return [];
      }

      const parsed = JSON.parse(saved);

      return Array.isArray(parsed.rules) ? parsed.rules : [];
    } catch (error) {
      console.error("Failed to load scheduling agent rules:", error);

      return [];
    }
  });

  const [
    schedulingAgentApprovedExceptions,
    setSchedulingAgentApprovedExceptions,
  ] = useState(() => {
    try {
      const saved = localStorage.getItem(SCHEDULING_AGENT_STORAGE_KEY);

      if (!saved) {
        return [];
      }

      const parsed = JSON.parse(saved);

      return Array.isArray(parsed.approvedExceptions)
        ? parsed.approvedExceptions
        : [];
    } catch (error) {
      console.error("Failed to load scheduling agent exceptions:", error);

      return [];
    }
  });

  const [schedulingAgentMessages, setSchedulingAgentMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(SCHEDULING_AGENT_STORAGE_KEY);

      if (!saved) {
        return [
          {
            id: "welcome",
            role: "agent",
            type: "message",
            text: "שלום, אני סוכן השיבוץ. כרגע אני מחובר לנתוני המערכת במצב קריאה בלבד.",
            createdAt: new Date().toISOString(),
            actions: [],
          },
        ];
      }

      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
        return parsed.messages;
      }

      return [
        {
          id: "welcome",
          role: "agent",
          type: "message",
          text: "שלום, אני סוכן השיבוץ. כרגע אני מחובר לנתוני המערכת במצב קריאה בלבד.",
          createdAt: new Date().toISOString(),
          actions: [],
        },
      ];
    } catch (error) {
      console.error("Failed to load scheduling agent messages:", error);

      return [];
    }
  });

  const [
    schedulingAgentWorkspace,
    setSchedulingAgentWorkspace,
  ] = useState(null);

  // Incremented whenever project-level agent data is restored. Using this as
  // a React key forces SchedulingAgentView to remount, so no stale internal UI
  // state can hide freshly loaded rules.
  const [schedulingAgentProjectRevision, setSchedulingAgentProjectRevision] =
    useState(0);
  const schedulingAgentRestoreTokenRef = useRef(0);

  function startSchedulingAgentWorkspace() {
    const workspace =
      createAgentWorkspace(schedule);

    setSchedulingAgentWorkspace(workspace);

    console.log(
      "AGENT WORKSPACE STARTED WITH:",
      workspace
    );

    return workspace;
  }

  function clearSchedulingAgentWorkspace() {
    setSchedulingAgentWorkspace(null);
  }

  useEffect(() => {
    try {
      const workspace = {
        version: 1,

        rules: schedulingAgentRules,

        approvedExceptions: schedulingAgentApprovedExceptions,

        messages: schedulingAgentMessages,

        updatedAt: new Date().toISOString(),
      };

      localStorage.setItem(
        SCHEDULING_AGENT_STORAGE_KEY,
        JSON.stringify(workspace),
      );
    } catch (error) {
      console.error("Failed to save scheduling agent workspace:", error);
    }
  }, [
    schedulingAgentRules,
    schedulingAgentApprovedExceptions,
    schedulingAgentMessages,
  ]);

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("טעינת session נכשלה:", error);
          return;
        }

        if (mounted) {
          setUser(data.session?.user || null);
        }
      } finally {
        if (mounted) {
          setAuthInitialized(true);
        }
      }
    }

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Supabase auth event:", event);

      if (!mounted) {
        return;
      }

      if (event === "SIGNED_OUT") {
        setUser(null);
        return;
      }

      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        const nextUser = session?.user || null;

        setUser((currentUser) => {
          // אם זה אותו משתמש שכבר מחובר,
          // לא יוצרים אובייקט user חדש ולא מפעילים effects מחדש.
          if (currentUser?.id === nextUser?.id) {
            return currentUser;
          }

          return nextUser;
        });
      }

      // מתעלמים לצורך state של המשתמש מ:
      // INITIAL_SESSION
      // TOKEN_REFRESHED
      // PASSWORD_RECOVERY
      // MFA_CHALLENGE_VERIFIED
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
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
    if (selectedCloudProjectId) {
      localStorage.setItem("selectedCloudProjectId", selectedCloudProjectId);
    }
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
        return normalizeTeacherHighlights(JSON.parse(saved));
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
    localStorage.setItem(
      "comparisonCheckpointId",
      comparisonCheckpointId || "",
    );
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
      dailyHoursByClass: createDefaultDailyHours(mockClasses, mockDays, 6),
    };

    const savedSchoolData = localStorage.getItem("schoolData");

    if (savedSchoolData) {
      return ensureDailyHoursForClasses({
        ...defaultData,
        ...JSON.parse(savedSchoolData),
      });
    }

    return defaultData;
  });

  useEffect(() => {
    if (isLoadingCloudProjectRef.current) {
      return;
    }

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
    schedulingAgentRules,
    schedulingAgentApprovedExceptions,
    selectedCloudProjectId,
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

  function getAllHourNumbers(scheduleObject = schedule) {
    const hourNumbers = new Set();

    for (const hour of hours || []) {
      const numericHour = Number(hour);
      if (Number.isFinite(numericHour) && numericHour > 0) {
        hourNumbers.add(numericHour);
      }
    }

    for (const classDays of Object.values(dailyHoursByClass || {})) {
      for (const configuredHours of Object.values(classDays || {})) {
        const maxHour = Number(configuredHours) || 0;
        for (let hour = 1; hour <= maxHour; hour++) {
          hourNumbers.add(hour);
        }
      }
    }

    for (const daySchedule of Object.values(scheduleObject || {})) {
      for (const classSchedule of Object.values(daySchedule || {})) {
        for (const hour of Object.keys(classSchedule || {})) {
          const numericHour = Number(hour);
          if (Number.isFinite(numericHour) && numericHour > 0) {
            hourNumbers.add(numericHour);
          }
        }
      }
    }

    return [...hourNumbers].sort((a, b) => a - b);
  }

  const [selectedClassForShahaf, setSelectedClassForShahaf] = useState(
    classes[0] || "",
  );
  const [selectedTeacherForView, setSelectedTeacherForView] = useState(
    teachers[0]?.id || "",
  );

  const schedulingAgentValidationReport = validateSchedule({
    schedule,
    schoolData,
    approvedExceptions: schedulingAgentApprovedExceptions,
  });

  const schedulingAgentContext = createSchedulingAgentContext({
    schoolData,
    schedule,
    approvedExceptions: schedulingAgentApprovedExceptions,
    rules: schedulingAgentRules,
  });

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
  const isLoadingCloudProjectRef = useRef(false);
  const cloudInitializedForUserRef = useRef(null);
  const loadedCloudProjectIdRef = useRef(null);

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
      JSON.stringify(teacherHighlights),
    );
  }, [teacherHighlights]);

  useEffect(() => {
    async function initializeCloudProjects() {
      // עדיין מחכים ל-Supabase שיבדוק את ה-session.
      // אסור בשלב הזה לנקות את הפרויקט האחרון.
      if (!authInitialized) {
        return;
      }

      const userId = user?.id;

      if (!userId) {
        setCloudProjects([]);
        setSelectedCloudProjectId("");
        cloudInitializedForUserRef.current = null;
        loadedCloudProjectIdRef.current = null;
        return;
      }

      // אותו משתמש כבר אותחל בסשן הנוכחי.
      if (cloudInitializedForUserRef.current === userId) {
        return;
      }

      try {
        await loadCloudProjects();

        const savedProjectId = localStorage.getItem("selectedCloudProjectId");

        if (savedProjectId) {
          const loadedSuccessfully = await loadCloudProjectById(
            savedProjectId,
            {
              showAlert: false,
            },
          );

          if (!loadedSuccessfully) {
            console.warn(
              "לא ניתן היה לטעון את פרויקט הענן האחרון:",
              savedProjectId,
            );
          }
        }

        // מסמנים כמאותחל רק אחרי שתהליך האתחול הסתיים.
        cloudInitializedForUserRef.current = userId;
      } catch (error) {
        console.error("אתחול פרויקטי הענן נכשל:", error);

        // מאפשר ניסיון נוסף אם האתחול נכשל.
        cloudInitializedForUserRef.current = null;
      }
    }

    initializeCloudProjects();
  }, [authInitialized, user?.id]);

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
    schedulingAgentRules,
    schedulingAgentApprovedExceptions,
  ]);

  useEffect(() => {
    const pending = pendingPurpleHoleCheckRef.current;

    if (!pending) return;

    pendingPurpleHoleCheckRef.current = null;

    const afterHoles = getPurpleHolesForAllDaysFromSchedule(schedule);

    alertNewPurpleHoles(pending.beforeHoles, afterHoles);
  }, [schedule, schoolData]);

  function getSchedulingAgentProjectData() {
    return {
      version: 1,
      rules: schedulingAgentRules,
      approvedExceptions: schedulingAgentApprovedExceptions,
    };
  }

  function restoreSchedulingAgentProjectData(projectData) {
    const agentData = projectData?.schedulingAgent || {};

    // Clone the project data before putting it in React state. This keeps the
    // loaded project object and the live editor state fully independent.
    const nextRules = Array.isArray(agentData.rules)
      ? structuredClone(agentData.rules)
      : [];
    const nextApprovedExceptions = Array.isArray(agentData.approvedExceptions)
      ? structuredClone(agentData.approvedExceptions)
      : [];

    const restoreToken = ++schedulingAgentRestoreTokenRef.current;

    const applyAgentProjectData = () => {
      // Ignore a delayed restore if a newer project has already been loaded.
      if (restoreToken !== schedulingAgentRestoreTokenRef.current) return;

      setSchedulingAgentRules(nextRules);
      setSchedulingAgentApprovedExceptions(nextApprovedExceptions);
    };

    applyAgentProjectData();
    setSchedulingAgentProjectRevision((value) => value + 1);

    // Persist immediately as well as through the normal React effect.
    // Preserve chat messages because they intentionally do not belong to a
    // project file.
    try {
      const savedWorkspace = JSON.parse(
        localStorage.getItem(SCHEDULING_AGENT_STORAGE_KEY) || "{}",
      );
      localStorage.setItem(
        SCHEDULING_AGENT_STORAGE_KEY,
        JSON.stringify({
          ...savedWorkspace,
          version: 1,
          rules: nextRules,
          approvedExceptions: nextApprovedExceptions,
          updatedAt: new Date().toISOString(),
        }),
      );
    } catch (error) {
      console.error("Failed to restore scheduling agent project data:", error);
    }

    // Re-assert once after the rest of the project load has committed. This
    // protects against schedule/cloud effects that may run during the same
    // load cycle and previously could leave the UI with an empty rule list.
    setTimeout(applyAgentProjectData, 0);

    console.log("SCHEDULING AGENT PROJECT DATA RESTORED", {
      rules: nextRules.length,
      approvedExceptions: nextApprovedExceptions.length,
      restoreToken,
    });

    return {
      rules: nextRules.length,
      approvedExceptions: nextApprovedExceptions.length,
    };
  }

  function buildProjectData() {
    return {
      version: 2,
      savedAt: new Date().toISOString(),
      schoolData,
      schedule,
      teacherHighlights,
      checkpoints,
      currentCheckpointId,
      comparisonCheckpointId,
      schedulingAgent: getSchedulingAgentProjectData(),
    };
  }

  useEffect(() => {
    setSchedulingAgentRules((prev) => {
      let changed = false;

      const next = prev.map((rule) => {
        if (
          !rule.checkStatus ||
          rule.checkStatus === "stale"
        ) {
          return rule;
        }

        changed = true;

        return {
          ...rule,
          checkStatus: "stale",
        };
      });

      return changed ? next : prev;
    });
  }, [schedule]);

  /***************
  FUNCTIONS
  ***************/
  async function loadCloudProjectById(projectId, options = {}) {
    console.trace("loadCloudProjectById");
    const { showAlert = true, forceReload = false } = options;

    if (!forceReload && loadedCloudProjectIdRef.current === projectId) {
      console.log("הפרויקט כבר טעון — דילוג על טעינה חוזרת");
      return true;
    }

    if (!user) {
      alert("יש להתחבר לפני טעינה מהענן");
      return false;
    }

    if (!projectId) return false;

    isLoadingCloudProjectRef.current = true;

    try {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, data")
        .eq("id", projectId)
        .single();

      if (error) {
        alert("טעינת הפרויקט נכשלה: " + error.message);
        return false;
      }

      const projectData = data.data || {};

      const normalizedSchoolData = ensureDailyHoursForClasses(
        projectData.schoolData,
      );

      const nextCheckpoints = Array.isArray(projectData.checkpoints)
        ? projectData.checkpoints
        : [];

      const nextCurrentCheckpointId = nextCheckpoints.some(
        (checkpoint) => checkpoint.id === projectData.currentCheckpointId,
      )
        ? projectData.currentCheckpointId
        : "";

      const nextComparisonCheckpointId = nextCheckpoints.some(
        (checkpoint) => checkpoint.id === projectData.comparisonCheckpointId,
      )
        ? projectData.comparisonCheckpointId
        : "";

      setSchoolData(normalizedSchoolData);
      setSchedule(projectData.schedule || {});
      setTeacherHighlights(
        normalizeTeacherHighlights(projectData.teacherHighlights),
      );
      restoreSchedulingAgentProjectData(projectData);

      // רשימת נקודות שמירה חדשה ונפרדת לפרויקט שנטען
      setCheckpoints([...nextCheckpoints]);
      setCurrentCheckpointId(nextCurrentCheckpointId);
      setComparisonCheckpointId(nextComparisonCheckpointId);

      setHistory([]);
      setFuture([]);

      setSelectedCloudProjectId(projectId);
      loadedCloudProjectIdRef.current = projectId;
      setHasUnsavedCloudChanges(false);
      setLastCloudSavedAt(new Date().toLocaleTimeString("he-IL"));

      localStorage.setItem("schoolData", JSON.stringify(normalizedSchoolData));
      localStorage.setItem(
        "schoolSchedule",
        JSON.stringify(projectData.schedule || {}),
      );
      localStorage.setItem(
        "teacherHighlights",
        JSON.stringify(
          normalizeTeacherHighlights(projectData.teacherHighlights),
        ),
      );
      localStorage.setItem("checkpoints", JSON.stringify(nextCheckpoints));
      localStorage.setItem("currentCheckpointId", nextCurrentCheckpointId);
      localStorage.setItem(
        "comparisonCheckpointId",
        nextComparisonCheckpointId,
      );
      localStorage.setItem("selectedCloudProjectId", projectId);

      if (showAlert) {
        const restoredRulesCount = Array.isArray(
          projectData?.schedulingAgent?.rules,
        )
          ? projectData.schedulingAgent.rules.length
          : 0;

        alert(
          `הפרויקט "${data.name}" נטען מהענן. חוקי־על ששוחזרו: ${restoredRulesCount}`,
        );
      }
      return true;
    } finally {
      // מאפשר ל־React לסיים את עדכוני ה־state לפני שמחזירים
      // את המערכת למצב שבו שינויים מסומנים כלא שמורים.
      setTimeout(() => {
        isLoadingCloudProjectRef.current = false;
        setHasUnsavedCloudChanges(false);
      }, 0);
    }
  }

  async function handleCloudProjectSelection(projectId) {
    if (!projectId) {
      setSelectedCloudProjectId("");
      return;
    }

    if (hasUnsavedCloudChanges && selectedCloudProjectId) {
      const shouldSaveFirst = confirm(
        "יש שינויים שלא נשמרו בענן.\n\nלחץ אישור כדי לשמור את הפרויקט הנוכחי ואז לטעון את הפרויקט שנבחר.\nלחץ ביטול כדי לטעון בלי לשמור.",
      );

      if (shouldSaveFirst) {
        await updateSelectedCloudProject();
      }
    }

    await loadCloudProjectById(projectId);
  }

  async function copyConstraintGroupsFromCloudProject(
    sourceProjectId
  ) {
    const sourceProject = cloudProjects.find(
      (project) => project.id === sourceProjectId
    );

    if (!sourceProject) {
      alert("פרויקט המקור לא נמצא.");
      return false;
    }

    const { data, error } = await supabase
      .from("projects")
      .select("data")
      .eq("id", sourceProjectId)
      .single();

    if (error) {
      console.error(
        "Failed to load source project:",
        error
      );

      alert("לא הצלחתי לטעון את פרויקט המקור.");
      return false;
    }

    console.log("SOURCE PROJECT DATA:", data);

    const sourceGroups =
      data?.data?.schoolData?.constraintGroups;

    if (!Array.isArray(sourceGroups)) {
      console.error(
        "No constraintGroups found in source project:",
        data
      );

      alert(
        "לא נמצאה רשימת קבוצות שיבוץ בפרויקט המקור."
      );

      return false;
    }

    const copiedGroups =
      structuredClone(sourceGroups);

    setSchoolData((prev) => ({
      ...prev,
      constraintGroups: copiedGroups,
    }));

    setHasUnsavedCloudChanges(true);

    alert(
      `הועתקו ${copiedGroups.length} קבוצות שיבוץ מהפרויקט "${sourceProject.name}".`
    );

    return true;
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

    // The cloud payload is produced by buildProjectData(), so it includes the
    // Scheduling Agent rules and approved exceptions as part of the project.
    setSelectedCloudProjectId(data.id);
    loadedCloudProjectIdRef.current = data.id;
    localStorage.setItem("selectedCloudProjectId", data.id);
    setHasUnsavedCloudChanges(false);
    setLastCloudSavedAt(new Date().toLocaleTimeString("he-IL"));

    alert(
      `הפרויקט נשמר בענן. חוקי־על שנשמרו: ${schedulingAgentRules.length}`,
    );
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

    alert(
      `הפרויקט עודכן בענן. חוקי־על שנשמרו: ${schedulingAgentRules.length}`,
    );
    setHasUnsavedCloudChanges(false);
    setLastCloudSavedAt(new Date().toLocaleTimeString("he-IL"));
    await loadCloudProjects();
  }

  /*
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
      normalizeTeacherHighlights(projectData.teacherHighlights)
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
      JSON.stringify(normalizeTeacherHighlights(projectData.teacherHighlights))
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
  */

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

    return unitIds.some((unitId) => isUnitLocked(day, className, hour, unitId));
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
      isUnitLocked(day, className, hour, unitId),
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
            unit.constraintGroupId,
          );

          for (const groupUnit of groupUnits) {
            const key = getLockKey(
              day,
              groupUnit.className,
              hour,
              groupUnit.id,
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

  function violatesConstraintRulesInSchedule(
    unit,
    scheduleObject,
    day,
    className,
    hour,
    options = {},
  ) {
    const ignoredUnitIds = new Set(options.ignoredUnitIds || []);

    if (!unit?.constraintGroupId) return false;

    const group = getConstraintGroupById(unit.constraintGroupId);

    if (!group) return false;

    if (isConstraintGroupBlockedAt(unit.constraintGroupId, day, hour)) {
      return true;
    }

    if (hasRule(group, "notSameDaySameClass")) {
      const classHours = getClassHoursForDay(className, day);

      for (let currentHour = 1; currentHour <= classHours; currentHour++) {
        const unitIds = getCellUnitIdsFromSchedule(
          scheduleObject,
          day,
          className,
          currentHour,
        );

        for (const unitId of unitIds) {
          if (ignoredUnitIds.has(unitId)) continue;

          const scheduledUnit = getUnitById(unitId);

          if (scheduledUnit?.constraintGroupId === unit.constraintGroupId) {
            return true;
          }
        }
      }
    }

    if (hasRule(group, "notSameTime")) {
      for (const currentClassName of classes) {
        const unitIds = getCellUnitIdsFromSchedule(
          scheduleObject,
          day,
          currentClassName,
          hour,
        );

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

      const groupTimeBlocked = isUnitConstraintGroupBlockedAt(unit, day, hour);

      if (groupTimeBlocked) {
        if (isActiveUnit) {
          return "groupBlocked";
        }

        hasGroupProblem = true;
        continue;
      }

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

      for (const hour of getAllHourNumbers()) {
        const groupsToRemove = new Set();
        const singleUnitIdsToRemove = new Set();

        // שלב א: מזהים מה צריך להסיר בשעה הזו
        for (const className of classes) {
          const unitIds = getCellUnitIdsFromSchedule(
            newSchedule,
            day,
            className,
            hour,
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
            hour,
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
              hour,
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
    const projectData = buildProjectData();

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

  function tryAgentWorkspaceMovePure({
    workspace,
    action,
  }) {
    const beforeValidationReport =
      validateSchedule({
        schedule:
          workspace.workingSchedule,

        schoolData,

        approvedExceptions:
          schedulingAgentApprovedExceptions,
      });

    const result =
      tryWorkspaceMove({
        workspace,
        action,
      });

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        workspace:
          result.workspace,
        validationReport:
          beforeValidationReport,
        validationComparison: null,
      };
    }

    const afterValidationReport =
      validateSchedule({
        schedule:
          result.workspace
            .workingSchedule,

        schoolData,

        approvedExceptions:
          schedulingAgentApprovedExceptions,
      });

    const beforeErrorCount =
      beforeValidationReport
        ?.statistics
        ?.errorCount ??
      beforeValidationReport
        ?.errors?.length ??
      0;

    const afterErrorCount =
      afterValidationReport
        ?.statistics
        ?.errorCount ??
      afterValidationReport
        ?.errors?.length ??
      0;

    const beforeWarningCount =
      beforeValidationReport
        ?.statistics
        ?.warningCount ??
      beforeValidationReport
        ?.warnings?.length ??
      0;

    const afterWarningCount =
      afterValidationReport
        ?.statistics
        ?.warningCount ??
      afterValidationReport
        ?.warnings?.length ??
      0;

    return {
      success: true,
      error: null,

      workspace:
        result.workspace,

      validationReport:
        afterValidationReport,

      validationComparison: {
        beforeErrorCount,
        afterErrorCount,
        errorDelta:
          afterErrorCount -
          beforeErrorCount,

        beforeWarningCount,
        afterWarningCount,
        warningDelta:
          afterWarningCount -
          beforeWarningCount,
      },
    };
  }

  function simulateAgentScheduleMove(action) {
    const simulation =
      simulateScheduleMove({
        schedule,
        action,
      });

    if (!simulation.success) {
      return {
        ...simulation,
        validationReport: null,
      };
    }

    const validationReport =
      validateSchedule({
        schedule:
          simulation.candidateSchedule,

        schoolData,

        approvedExceptions:
          schedulingAgentApprovedExceptions,
      });

    return {
      ...simulation,
      validationReport,
    };
  }

  function tryAgentWorkspaceMove(action) {
    // אם עדיין אין Workspace פעיל,
    // נפתח אותו אוטומטית מהמערכת האמיתית הנוכחית.
    const currentWorkspace =
      schedulingAgentWorkspace ||
      createAgentWorkspace(schedule);

    const beforeValidationReport =
      validateSchedule({
        schedule:
          currentWorkspace.workingSchedule,
        schoolData,
        approvedExceptions:
          schedulingAgentApprovedExceptions,
      });

    const result = tryWorkspaceMove({
      workspace: currentWorkspace,
      action,
    });

    // גם ניסיון שנכשל נרשם ב-attempts
    if (!result.success) {
      setSchedulingAgentWorkspace(
        result.workspace
      );

      return {
        success: false,
        error: result.error,
        workspace: result.workspace,
        validationReport:
          beforeValidationReport,
        validationComparison: null,
      };
    }

    const afterValidationReport =
      validateSchedule({
        schedule:
          result.workspace.workingSchedule,
        schoolData,
        approvedExceptions:
          schedulingAgentApprovedExceptions,
      });

    const beforeErrorCount =
      beforeValidationReport?.statistics
        ?.errorCount ??
      beforeValidationReport?.errors
        ?.length ??
      0;

    const afterErrorCount =
      afterValidationReport?.statistics
        ?.errorCount ??
      afterValidationReport?.errors
        ?.length ??
      0;

    const beforeWarningCount =
      beforeValidationReport?.statistics
        ?.warningCount ??
      beforeValidationReport?.warnings
        ?.length ??
      0;

    const afterWarningCount =
      afterValidationReport?.statistics
        ?.warningCount ??
      afterValidationReport?.warnings
        ?.length ??
      0;

    const validationComparison = {
      beforeErrorCount,
      afterErrorCount,
      errorDelta:
        afterErrorCount -
        beforeErrorCount,

      beforeWarningCount,
      afterWarningCount,
      warningDelta:
        afterWarningCount -
        beforeWarningCount,
    };

    // נוסיף את תוצאת ה-validator
    // לניסיון האחרון ביומן.
    const enrichedAttempts =
      result.workspace.attempts.map(
        (attempt, index) => {
          if (
            index !==
            result.workspace.attempts
              .length -
            1
          ) {
            return attempt;
          }

          return {
            ...attempt,
            validationComparison,
          };
        }
      );

    const enrichedWorkspace = {
      ...result.workspace,
      attempts: enrichedAttempts,
    };

    setSchedulingAgentWorkspace(
      enrichedWorkspace
    );

    console.log(
      "AGENT WORKSPACE ATTEMPT:",
      enrichedAttempts[
      enrichedAttempts.length - 1
      ]
    );

    return {
      success: true,
      error: null,
      workspace: enrichedWorkspace,
      validationReport:
        afterValidationReport,
      validationComparison,
    };
  }

  function buildEmptyScheduleTemplate() {
    const emptySchedule = {};

    for (const day of days) {
      emptySchedule[day] = {};

      for (const className of classes) {
        const configuredHours =
          Number(dailyHoursByClass?.[className]?.[day]) || 0;

        const existingHourNumbers = Object.keys(
          schedule?.[day]?.[className] || {},
        )
          .map((hour) => Number(hour))
          .filter((hour) => Number.isFinite(hour) && hour > 0);

        const maxExistingHour =
          existingHourNumbers.length > 0 ? Math.max(...existingHourNumbers) : 0;

        const maxHour = Math.max(configuredHours, maxExistingHour);

        emptySchedule[day][className] = {};

        for (let hour = 1; hour <= maxHour; hour++) {
          emptySchedule[day][className][hour] = [];
        }
      }
    }

    return emptySchedule;
  }

  function saveSchedulingMetadataToFile() {
    const metadataData = {
      version: 1,
      savedAt: new Date().toISOString(),
      exportType: "scheduling-metadata-only",
      exportNotes: {
        containsExistingSchedule: false,
        scheduleCellFormat:
          "Each schedule cell is an array of teachingUnit ids.",
        purpose:
          "Metadata-only export for creating a new timetable without exposing the existing solution.",
      },
      schoolData,
      schedule: buildEmptyScheduleTemplate(),
      teacherHighlights: normalizeTeacherHighlights(teacherHighlights),
      checkpoints: [],
      currentCheckpointId: "",
      comparisonCheckpointId: "",
      schedulingAgent: getSchedulingAgentProjectData(),
    };

    const json = JSON.stringify(metadataData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `school-timetable-metadata-${new Date()
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

  function getSelectedCellTeacherIds() {
    if (!selectedCell) return new Set();

    const unitIds = getCellUnitIds(
      selectedDay,
      selectedCell.className,
      selectedCell.hour,
    );

    return new Set(
      unitIds
        .map(getUnitById)
        .filter(Boolean)
        .map((unit) => unit.teacherId),
    );
  }

  function cellHasActiveTeacher(className, day, hour) {
    const activeTeacherId = getActivePlacementTeacherId();
    const teacherIdsToHighlight = activeTeacherId
      ? new Set([activeTeacherId])
      : getSelectedCellTeacherIds();

    if (teacherIdsToHighlight.size === 0) return false;

    const unitIds = getCellUnitIds(day, className, hour);

    return unitIds.some((unitId) => {
      const unit = getUnitById(unitId);
      return unit && teacherIdsToHighlight.has(unit.teacherId);
    });
  }

  function getComparisonCheckpoint() {
    return checkpoints.find(
      (checkpoint) => checkpoint.id === comparisonCheckpointId,
    );
  }

  function getCellUnitIdsFromAnySchedule(scheduleObject, day, className, hour) {
    const value = scheduleObject?.[day]?.[className]?.[hour];

    if (!value) return [];

    return Array.isArray(value) ? value : [value];
  }

  function getTeacherNamesForScheduleCell(
    scheduleObject,
    day,
    className,
    hour,
  ) {
    const unitIds = getCellUnitIdsFromAnySchedule(
      scheduleObject,
      day,
      className,
      hour,
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
      hour,
    );

    const checkpointValue = getTeacherNamesForScheduleCell(
      checkpoint.schedule || {},
      day,
      className,
      hour,
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

    const brightness = (r * 299 + g * 587 + b * 114) / 1000;

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
    setComparisonCheckpointId(
      getPreviousCheckpointId(newCheckpoint.id, [
        newCheckpoint,
        ...checkpoints,
      ]),
    );
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
          hour,
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
          hour,
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
            hour,
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
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );

    const index = sorted.findIndex(
      (checkpoint) => checkpoint.id === checkpointId,
    );

    if (index === -1 || index === sorted.length - 1) return "";

    return sorted[index + 1].id;
  }

  function deleteCheckpoint(checkpointId) {
    if (!confirm("למחוק את נקודת השמירה?")) return;

    setCheckpoints((prev) =>
      prev.filter((checkpoint) => checkpoint.id !== checkpointId),
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

  function isConstraintGroupBlockedAt(groupId, day, hour) {
    if (!groupId) return false;

    const group = getConstraintGroupById(groupId);
    if (!group) return false;

    const blockedHoursForDay = group.blockedSlots?.[normalizeDay(day)] || [];
    return blockedHoursForDay.includes(Number(hour));
  }

  function isUnitConstraintGroupBlockedAt(unit, day, hour) {
    return isConstraintGroupBlockedAt(unit?.constraintGroupId, day, hour);
  }

  function restoreCheckpoint(checkpointId) {
    const checkpoint = checkpoints.find((item) => item.id === checkpointId);

    if (!checkpoint) return;

    if (
      !confirm(
        "לשחזר את המערכת לנקודת השמירה הזו? הפעולה תחליף את המצב הנוכחי.",
      )
    ) {
      return;
    }

    const normalizedSchoolData = ensureDailyHoursForClasses(
      checkpoint.schoolData,
    );

    setSchoolData(normalizedSchoolData);
    setSchedule(checkpoint.schedule || {});
    setHistory([]);
    setFuture([]);

    localStorage.setItem("schoolData", JSON.stringify(normalizedSchoolData));
    localStorage.setItem(
      "schoolSchedule",
      JSON.stringify(checkpoint.schedule || {}),
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

    if (isUnitConstraintGroupBlockedAt(unit, selectedDay, hour)) {
      alert("לא ניתן לשבץ את קבוצת השיבוץ ביום ובשעה שנחסמו עבורה");
      return;
    }

    if (isTeacherFreeDay(unit.teacherId, selectedDay)) {
      alert("לא ניתן לשבץ מורה ביום החופשי שלו");
      return;
    }

    if (isTeacherBlockedHour(unit.teacherId, selectedDay, hour)) {
      alert("לא ניתן לשבץ את המורה בשעה זו: המורה חסום ביום ובשעה שנבחרו");
      return;
    }

    const unitsToPlace = getSameTimeGroupUnits(unit);

    const invalidUnits = unitsToPlace.filter((candidate) => {
      const alreadyInTarget = getCellUnitIds(
        selectedDay,
        candidate.className,
        hour,
      ).includes(candidate.id);

      if (alreadyInTarget) return false;

      if (isBlockedCell(candidate.className, selectedDay, hour)) {
        return true;
      }

      if (isCellLocked(selectedDay, candidate.className, hour)) {
        return true;
      }

      if (isUnitConstraintGroupBlockedAt(candidate, selectedDay, hour)) {
        return true;
      }

      if (!canTeacherWorkAt(candidate.teacherId, selectedDay, hour)) {
        return true;
      }

      return false;
    });

    if (invalidUnits.length > 0) {
      alert("לא ניתן לשבץ את כל יחידות הקבוצה בשעה שנבחרה");
      return;
    }

    requestPurpleHoleCheck();
    placeUnitsByClassAtHour(unitsToPlace, String(hour), false);
  }

  function autoPlaceUniqueCandidateInSelectedCell() {
    if (!selectedCell) {
      alert("יש לבחור תחילה משבצת בטבלת השיבוץ");
      return;
    }

    const { className, hour } = selectedCell;

    if (isBlockedCell(className, selectedDay, hour)) {
      alert("לא ניתן לשבץ בשעה שאינה קיימת בכיתה זו ביום זה");
      return;
    }

    if (isCellLocked(selectedDay, className, hour)) {
      alert("לא ניתן לשבץ בתא נעול");
      return;
    }

    if (getCellUnitIds(selectedDay, className, hour).length > 0) {
      alert("שיבוץ אוטומטי באמצעות Alt+A מיועד למשבצת ריקה");
      return;
    }

    const candidates = teachingUnits.filter((unit) => {
      if (!canUnitFillCell(unit, selectedDay, className, hour)) {
        return false;
      }

      const unitsToPlace = getSameTimeGroupUnits(unit);

      return unitsToPlace.every((candidate) =>
        canUnitFillCell(candidate, selectedDay, candidate.className, hour),
      );
    });

    if (candidates.length === 0) {
      alert("לא נמצא מורה שניתן לשבץ במשבצת שנבחרה");
      return;
    }

    if (candidates.length > 1) {
      alert(
        `נמצאו ${candidates.length} אפשרויות שיבוץ. השיבוץ האוטומטי פועל רק כאשר יש אפשרות יחידה.`,
      );
      return;
    }

    const unit = candidates[0];
    const unitsToPlace = getSameTimeGroupUnits(unit);

    const invalidUnits = unitsToPlace.filter((candidate) => {
      if (isBlockedCell(candidate.className, selectedDay, hour)) return true;
      if (isCellLocked(selectedDay, candidate.className, hour)) return true;
      if (isUnitConstraintGroupBlockedAt(candidate, selectedDay, hour))
        return true;
      if (!canTeacherWorkAt(candidate.teacherId, selectedDay, hour))
        return true;

      return false;
    });

    if (invalidUnits.length > 0) {
      alert("לא ניתן לשבץ את כל יחידות הקבוצה בשעה שנבחרה");
      return;
    }

    requestPurpleHoleCheck();
    placeUnitsByClassAtHour(unitsToPlace, String(hour), false);
  }

  function classHasShahafChanges(className) {
    if (!comparisonCheckpointId) return false;

    for (const day of days) {
      const classHours = getClassHoursForDay(className, day);

      for (let hour = 1; hour <= classHours; hour++) {
        if (isShahafCellChanged(day, className, hour)) {
          return true;
        }
      }
    }

    return false;
  }

  function teacherHasViewChanges(teacherId) {
    if (!comparisonCheckpointId) return false;

    const maxHoursForAllClasses = Math.max(
      0,
      ...days.map((day) =>
        Math.max(
          0,
          ...classes.map((className) => getClassHoursForDay(className, day)),
        ),
      ),
    );

    for (const day of days) {
      for (let hour = 1; hour <= maxHoursForAllClasses; hour++) {
        if (isTeacherCellChanged(teacherId, day, hour)) {
          return true;
        }
      }
    }

    return false;
  }

  function hasRule(group, ruleName) {
    return group?.rules?.includes(ruleName) || group?.type === ruleName;
  }

  function violatesConstraintRules(unit, day, className, hour, options = {}) {
    const ignoredUnitIds = new Set(options.ignoredUnitIds || []);

    if (!unit?.constraintGroupId) return false;

    const group = getConstraintGroupById(unit.constraintGroupId);

    if (!group) return false;

    if (isConstraintGroupBlockedAt(unit.constraintGroupId, day, hour)) {
      return true;
    }

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

  function getSelectedCellUnitHint(
    unit,
    {
      allowAlreadyScheduledUnit = false,
      sourceClassName = null,
      sourceHour = null,
    } = {},
  ) {
    if (!selectedCell || !unit) return null;

    if (unit.className !== selectedCell.className) return null;

    if (
      sourceClassName &&
      String(sourceHour) === String(selectedCell.hour) &&
      sourceClassName === selectedCell.className
    ) {
      return null;
    }

    if (
      sourceClassName &&
      isCellLocked(selectedDay, sourceClassName, sourceHour)
    ) {
      return null;
    }

    const isExhausted =
      getRemainingUnitHours(unit.id) <= 0 && !allowAlreadyScheduledUnit;

    if (
      isBlockedCell(selectedCell.className, selectedDay, selectedCell.hour) ||
      isCellLocked(selectedDay, selectedCell.className, selectedCell.hour) ||
      !canTeacherWorkAt(unit.teacherId, selectedDay, selectedCell.hour) ||
      isUnitConstraintGroupBlockedAt(unit, selectedDay, selectedCell.hour)
    ) {
      return null;
    }

    if (isTeacherBusyAt(unit.teacherId, selectedDay, selectedCell.hour)) {
      return null;
    }

    if (
      hasNotSameDaySameClassConflict(
        selectedCell.className,
        selectedCell.hour,
        unit,
        selectedDay,
      )
    ) {
      return null;
    }

    if (
      hasNotSameTimeConflict(
        selectedCell.className,
        selectedCell.hour,
        unit,
        selectedDay,
      )
    ) {
      return "notSameTimeConflict";
    }

    return isExhausted ? "availableExhausted" : "available";
  }

  function isUnitAvailableForSelectedCell(unit) {
    return getSelectedCellUnitHint(unit) === "available";
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
        projectData.schoolData,
      );

      // A file loaded from disk is a standalone project. Do not keep it tied
      // to a previously selected cloud project, because an automatic cloud
      // load/save can otherwise overwrite the freshly restored agent rules.
      setSelectedCloudProjectId("");
      loadedCloudProjectIdRef.current = null;
      localStorage.removeItem("selectedCloudProjectId");
      setHasUnsavedCloudChanges(false);

      setSchoolData(normalizedSchoolData);
      setSchedule(projectData.schedule || {});
      setTeacherHighlights(
        normalizeTeacherHighlights(projectData.teacherHighlights),
      );
      const restoredAgent = restoreSchedulingAgentProjectData(projectData);

      setCheckpoints(projectData.checkpoints || []);
      setCurrentCheckpointId(
        projectData.currentCheckpointId || projectData.activeCheckpointId || "",
      );

      setComparisonCheckpointId(projectData.comparisonCheckpointId || "");

      setHistory([]);
      setFuture([]);

      localStorage.setItem("schoolData", JSON.stringify(normalizedSchoolData));
      localStorage.setItem(
        "schoolSchedule",
        JSON.stringify(projectData.schedule || {}),
      );
      localStorage.setItem(
        "teacherHighlights",
        JSON.stringify(
          normalizeTeacherHighlights(projectData.teacherHighlights),
        ),
      );

      localStorage.setItem(
        "checkpoints",
        JSON.stringify(projectData.checkpoints || []),
      );

      localStorage.setItem(
        "currentCheckpointId",
        projectData.currentCheckpointId || projectData.activeCheckpointId || "",
      );

      localStorage.setItem(
        "comparisonCheckpointId",
        projectData.comparisonCheckpointId || "",
      );

      alert(
        `הפרויקט נטען בהצלחה. חוקי־על ששוחזרו: ${restoredAgent.rules}`,
      );
    } catch (error) {
      console.error(error);
      alert("טעינת הפרויקט נכשלה: " + error.message);
    } finally {
      event.target.value = "";
    }
  }

  async function addProjectFileToCurrentProject(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const projectData = JSON.parse(text);

      if (!projectData.schoolData || !projectData.schedule) {
        throw new Error("קובץ הפרויקט אינו תקין");
      }

      const normalizedSchoolData = ensureDailyHoursForClasses(
        projectData.schoolData,
      );
      const normalizedHighlights = normalizeTeacherHighlights(
        projectData.teacherHighlights,
      );

      // חשוב: אנחנו מייבאים רק את מצב המערכת מהקובץ.
      // נקודות שמירה ומזהי נקודות שמירה מהקובץ המיובא נזרקים במכוון.
      // נקודות השמירה של הפרויקט הנוכחי נשארות ללא שינוי.
      setSchoolData(normalizedSchoolData);
      setSchedule(projectData.schedule || {});
      setTeacherHighlights(normalizedHighlights);
      restoreSchedulingAgentProjectData(projectData);

      // המצב החדש אינו נקודת שמירה קיימת בפרויקט הנוכחי.
      setCurrentCheckpointId("");

      setHistory([]);
      setFuture([]);

      localStorage.setItem(
        "schoolData",
        JSON.stringify(normalizedSchoolData),
      );
      localStorage.setItem(
        "schoolSchedule",
        JSON.stringify(projectData.schedule || {}),
      );
      localStorage.setItem(
        "teacherHighlights",
        JSON.stringify(normalizedHighlights),
      );
      localStorage.setItem("currentCheckpointId", "");

      // אין לגעת ב-checkpoints או comparisonCheckpointId:
      // הם שייכים לפרויקט הנוכחי, לא לקובץ המיובא.

      setHasUnsavedCloudChanges(true);

      alert(
        "מצב המערכת מהקובץ נוסף לפרויקט הנוכחי. " +
          "נקודות השמירה שבקובץ לא יובאו, ונקודות השמירה הקיימות בפרויקט נשמרו."
      );
    } catch (error) {
      console.error(error);
      alert("הוספת הקובץ לפרויקט נכשלה: " + error.message);
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
          : 0,
      ),
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

  function buildTeachingUnitsFromSheetRows(sheetRows, existingUnits = []) {
    const desiredHoursByKey = new Map();

    for (const row of sheetRows) {
      const hours = Number(row.hours) || 0;

      if (!row.teacherId || !row.className || hours <= 0) {
        continue;
      }

      const key = `${row.className}|${row.teacherId}`;
      desiredHoursByKey.set(key, (desiredHoursByKey.get(key) || 0) + hours);
    }

    const existingUnitsByKey = new Map();
    const usedIds = new Set(existingUnits.map((unit) => unit.id));

    for (const unit of existingUnits) {
      if (unit.type === "teamMeeting") continue;

      const key = `${unit.className}|${unit.teacherId}`;

      if (!existingUnitsByKey.has(key)) {
        existingUnitsByKey.set(key, []);
      }

      existingUnitsByKey.get(key).push(unit);
    }

    const createUniqueBaseId = (className, teacherId) => {
      const baseId = `base-${className}-${teacherId}`;

      if (!usedIds.has(baseId)) {
        usedIds.add(baseId);
        return baseId;
      }

      let index = 2;
      let candidate = `${baseId}-${index}`;

      while (usedIds.has(candidate)) {
        index += 1;
        candidate = `${baseId}-${index}`;
      }

      usedIds.add(candidate);
      return candidate;
    };

    const rebuiltUnits = [];

    for (const [key, desiredHours] of desiredHoursByKey.entries()) {
      const [className, teacherId] = key.split("|");
      const currentUnits = (existingUnitsByKey.get(key) || []).map((unit) => ({
        ...unit,
      }));

      if (currentUnits.length === 0) {
        rebuiltUnits.push({
          id: createUniqueBaseId(className, teacherId),
          className,
          teacherId,
          subject: "רגיל",
          hours: desiredHours,
          constraintGroupId: null,
        });
        continue;
      }

      const currentTotal = currentUnits.reduce(
        (sum, unit) => sum + (Number(unit.hours) || 0),
        0,
      );

      if (desiredHours > currentTotal) {
        const extraHours = desiredHours - currentTotal;
        const freeUnit = currentUnits.find((unit) => !unit.constraintGroupId);

        if (freeUnit) {
          freeUnit.hours = (Number(freeUnit.hours) || 0) + extraHours;
        } else {
          currentUnits.push({
            id: createUniqueBaseId(className, teacherId),
            className,
            teacherId,
            subject: "רגיל",
            hours: extraHours,
            constraintGroupId: null,
          });
        }
      } else if (desiredHours < currentTotal) {
        let hoursToRemove = currentTotal - desiredHours;

        // מפחיתים קודם מהיחידה החופשית ורק אחר כך מיחידות משויכות.
        // כך שינוי רגיל בסדין אינו מאחד או מעביר שעות בין קבוצות שיבוץ.
        const reductionOrder = [
          ...currentUnits.filter((unit) => !unit.constraintGroupId),
          ...currentUnits.filter((unit) => unit.constraintGroupId),
        ];

        for (const unit of reductionOrder) {
          if (hoursToRemove <= 0) break;

          const removable = Math.min(Number(unit.hours) || 0, hoursToRemove);

          unit.hours = (Number(unit.hours) || 0) - removable;
          hoursToRemove -= removable;
        }
      }

      rebuiltUnits.push(
        ...currentUnits
          .filter((unit) => (Number(unit.hours) || 0) > 0)
          .map((unit) => ({
            ...unit,
            className,
            teacherId,
          })),
      );
    }

    return mergeSimilarUnitsInList(rebuiltUnits);
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
        for (const hour of getAllHourNumbers(scheduleObject)) {
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
    const validUnitIds = new Set(nextUnits.map((unit) => unit.id));
    const hoursByUnitId = new Map(
      nextUnits.map((unit) => [unit.id, Number(unit.hours) || 0]),
    );

    let removedCount = 0;

    setSchedule((prevSchedule) => {
      const nextSchedule = structuredClone(prevSchedule);
      const keptCounts = new Map();

      for (const day of days) {
        for (const className of classes) {
          for (const hour of getAllHourNumbers(nextSchedule)) {
            const currentUnitIds = getCellUnitIdsFromSchedule(
              nextSchedule,
              day,
              className,
              hour,
            );

            const nextUnitIds = [];

            for (const unitId of currentUnitIds) {
              if (!validUnitIds.has(unitId)) {
                removedCount++;
                continue;
              }

              const alreadyKept = keptCounts.get(unitId) || 0;
              const allowedHours = hoursByUnitId.get(unitId) || 0;

              if (alreadyKept >= allowedHours) {
                removedCount++;
                continue;
              }

              nextUnitIds.push(unitId);
              keptCounts.set(unitId, alreadyKept + 1);
            }

            if (nextUnitIds.length !== currentUnitIds.length) {
              setCellUnitIds(nextSchedule, day, className, hour, nextUnitIds);
            }
          }
        }
      }

      return nextSchedule;
    });

    if (removedCount > 0) {
      alert(
        `בעקבות שינוי השעות הוסרו ${removedCount} שיבוצים שאינם תקפים עוד.`,
      );
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
        if (
          isPurpleHoleCellInSchedule(
            scheduleObject,
            dayToCheck,
            className,
            hour,
          )
        ) {
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
      hour,
    );

    if (unitIds.length > 0) return false;

    if (isTeamMeetingFullyScheduledInSchedule(scheduleObject, className)) {
      return false;
    }

    return !teachingUnits.some((unit) =>
      canUnitFillCellInSchedule(unit, scheduleObject, day, className, hour),
    );
  }

  function isTeamMeetingFullyScheduledInSchedule(scheduleObject, className) {
    if (!isTeamMeetingRow(className)) return false;

    const meetingUnits = teachingUnits.filter(
      (unit) => unit.className === className && unit.type === "teamMeeting",
    );

    if (meetingUnits.length === 0) return false;

    return meetingUnits.every(
      (unit) => getRemainingUnitHours(unit.id, scheduleObject) <= 0,
    );
  }

  function isPurpleHoleCell(day, className, hour) {
    if (isBlockedCell(className, day, hour)) return false;

    const unitIds = getCellUnitIds(day, className, hour);

    if (unitIds.length > 0) return false;

    if (isTeamMeetingFullyScheduledInSchedule(schedule, className)) {
      return false;
    }

    return !teachingUnits.some((unit) =>
      canUnitFillCell(unit, day, className, hour),
    );
  }

  function canUnitFillCellInSchedule(
    unit,
    scheduleObject,
    day,
    className,
    hour,
  ) {
    if (!unit) return false;

    if (unit.className !== className) return false;

    if (getRemainingUnitHours(unit.id, scheduleObject) <= 0) return false;

    if (!canTeacherWorkAt(unit.teacherId, day, hour)) return false;

    if (isTeacherBusyAtInSchedule(unit.teacherId, day, hour, scheduleObject)) {
      return false;
    }

    if (
      violatesConstraintRulesInSchedule(
        unit,
        scheduleObject,
        day,
        className,
        hour,
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
        hour,
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

    const regularUnits = buildTeachingUnitsFromSheetRows(
      nextRows,
      teachingUnits,
    );

    const meetingUnits = teachingUnits.filter(
      (unit) => unit.type === "teamMeeting",
    );

    const nextUnits = [...regularUnits, ...meetingUnits];

    const nextTeachingLoads = buildTeachingLoadsFromUnits(
      regularUnits,
      classes,
    );

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

  function isTeamMeetingRow(className) {
    return teachingUnits.some(
      (unit) => unit.className === className && unit.type === "teamMeeting",
    );
  }

  function isBlockedCell(className, day, hour) {
    if (isTeamMeetingRow(className)) {
      return false;
    }

    return hour > getClassHoursForDay(className, day);
  }

  function splitUnitAndAssignGroup(unitId, groupId, hoursToAssign) {
    setSchoolData((prev) => {
      const originalUnit = prev.teachingUnits.find(
        (unit) => unit.id === unitId,
      );

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
      const selectedGroup = groupId
        ? (prev.constraintGroups || []).find((group) => group.id === groupId)
        : null;
      const cleanSubject = isRemovingGroup
        ? "רגיל"
        : selectedGroup?.name || originalUnit.subject || "רגיל";

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
  }

  function getWarnings() {
    const warnings = [];

    for (const day of days) {
      for (const className of classes) {
        for (const hour of getAllHourNumbers()) {
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

  function getScheduledUnitsForConstraintGroupAt(groupId, day, hour) {
    const scheduled = [];

    for (const className of classes) {
      const unitIds = getCellUnitIds(day, className, hour);

      for (const unitId of unitIds) {
        const unit = getUnitById(unitId);
        if (unit?.constraintGroupId === groupId) {
          scheduled.push({ unit, className });
        }
      }
    }

    return scheduled;
  }

  function removeConstraintGroupFromSpecificTime(groupId, day, hour) {
    let removedCount = 0;

    updateScheduleWithHistory((prev) => {
      const nextSchedule = structuredClone(prev);

      for (const className of classes) {
        const currentIds = getCellUnitIdsFromSchedule(
          nextSchedule,
          day,
          className,
          hour,
        );

        const nextIds = currentIds.filter((unitId) => {
          const unit = getUnitById(unitId);
          const shouldRemove = unit?.constraintGroupId === groupId;
          if (shouldRemove) removedCount += 1;
          return !shouldRemove;
        });

        setCellUnitIds(nextSchedule, day, className, hour, nextIds);
      }

      return nextSchedule;
    });

    return removedCount;
  }

  function toggleConstraintGroupBlockedSlot(groupId, day, hour) {
    const normalizedDay = normalizeDay(day);
    const hourNumber = Number(hour);
    const wasBlocked = isConstraintGroupBlockedAt(
      groupId,
      normalizedDay,
      hourNumber,
    );

    if (!wasBlocked) {
      const scheduledUnits = getScheduledUnitsForConstraintGroupAt(
        groupId,
        normalizedDay,
        hourNumber,
      );

      if (scheduledUnits.length > 0) {
        const shouldContinue = confirm(
          `בזמן זה קיימים ${scheduledUnits.length} שיבוצים מהקבוצה. חסימת הזמן תסיר אותם מהמערכת. להמשיך?`,
        );

        if (!shouldContinue) return;

        requestPurpleHoleCheck();
        removeConstraintGroupFromSpecificTime(
          groupId,
          normalizedDay,
          hourNumber,
        );
      }
    }

    setSchoolData((prev) => ({
      ...prev,
      constraintGroups: (prev.constraintGroups || []).map((group) => {
        if (group.id !== groupId) return group;

        const blockedSlots = { ...(group.blockedSlots || {}) };
        const dayHours = blockedSlots[normalizedDay] || [];

        blockedSlots[normalizedDay] = wasBlocked
          ? dayHours.filter((item) => Number(item) !== hourNumber)
          : [...new Set([...dayHours.map(Number), hourNumber])].sort(
            (a, b) => a - b,
          );

        return { ...group, blockedSlots };
      }),
    }));
  }

  function setAllConstraintGroupSlotsBlocked(groupId, shouldBlock) {
    const group = getConstraintGroupById(groupId);
    if (!group) return;

    if (shouldBlock) {
      let scheduledCount = 0;

      for (const day of days) {
        for (const hour of getAllHourNumbers()) {
          scheduledCount += getScheduledUnitsForConstraintGroupAt(
            groupId,
            day,
            hour,
          ).length;
        }
      }

      if (scheduledCount > 0) {
        const shouldContinue = confirm(
          `בקבוצה קיימים ${scheduledCount} שיבוצים. חסימת כל הזמנים תסיר אותם מהמערכת. להמשיך?`,
        );

        if (!shouldContinue) return;

        requestPurpleHoleCheck();

        updateScheduleWithHistory((prev) => {
          const nextSchedule = structuredClone(prev);

          for (const day of days) {
            for (const className of classes) {
              for (const hour of getAllHourNumbers()) {
                const currentIds = getCellUnitIdsFromSchedule(
                  nextSchedule,
                  day,
                  className,
                  hour,
                );

                const nextIds = currentIds.filter((unitId) => {
                  const unit = getUnitById(unitId);
                  return unit?.constraintGroupId !== groupId;
                });

                if (nextIds.length !== currentIds.length) {
                  setCellUnitIds(nextSchedule, day, className, hour, nextIds);
                }
              }
            }
          }

          return nextSchedule;
        });
      }
    }

    const blockedSlots = shouldBlock
      ? Object.fromEntries(
        days.map((day) => [normalizeDay(day), getAllHourNumbers()]),
      )
      : {};

    setSchoolData((prev) => ({
      ...prev,
      constraintGroups: (prev.constraintGroups || []).map((item) =>
        item.id === groupId ? { ...item, blockedSlots } : item,
      ),
    }));
  }

  function saveConstraintGroup(groupToSave) {
    setSchoolData((prev) => {
      const exists = prev.constraintGroups.some(
        (group) => group.id === groupToSave.id,
      );

      const constraintGroups = exists
        ? prev.constraintGroups.map((group) =>
          group.id === groupToSave.id ? groupToSave : group,
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
  function isTeacherCellChanged(teacherId, day, hour) {
    const checkpoint = getComparisonCheckpoint();

    if (!checkpoint) return false;

    const currentClasses = getTeacherClassesForCell(
      schedule,
      teacherId,
      day,
      hour,
    );

    const checkpointClasses = getTeacherClassesForCell(
      checkpoint.schedule || {},
      teacherId,
      day,
      hour,
    );

    return currentClasses !== checkpointClasses;
  }

  function getTeacherClassesForCell(scheduleObject, teacherId, day, hour) {
    const result = [];

    for (const className of classes) {
      const unitIds = scheduleObject?.[day]?.[className]?.[hour] || [];

      const units = unitIds.map(getUnitById).filter(Boolean);

      if (units.some((unit) => unit.teacherId === teacherId)) {
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
        (group) => group.id !== groupId,
      ),
      teachingUnits: prev.teachingUnits.map((unit) =>
        unit.constraintGroupId === groupId
          ? { ...unit, constraintGroupId: null }
          : unit,
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
    localStorage.setItem("schoolData", JSON.stringify(schoolData));
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

        if (key === "a" || key === "ש") {
          event.preventDefault();
          autoPlaceUniqueCandidateInSelectedCell();
          return;
        }

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

      if (
        event.ctrlKey &&
        (event.key.toLowerCase() === "d" || event.key === "ג")
      ) {
        event.preventDefault();
        setVisiblePanels((prev) => ({
          ...prev,
          highlights: !prev.highlights,
        }));
        return;
      }

      if (event.ctrlKey && ["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault();
        setVisiblePanels((prev) => ({
          ...prev,
          highlights: true,
        }));

        setTimeout(() => {
          const input = document.querySelector(
            `[data-highlight-index="${Number(event.key) - 1}"]`,
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

  function removeSameTimeGroupsFromTarget(
    newSchedule,
    day,
    hour,
    targetUnitIds,
  ) {
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
          hour,
        );

        setCellUnitIds(
          newSchedule,
          day,
          unit.className,
          hour,
          currentUnits.filter((id) => id !== unit.id),
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

    for (const daySchedule of Object.values(scheduleObject || {})) {
      for (const classSchedule of Object.values(daySchedule || {})) {
        for (const cellValue of Object.values(classSchedule || {})) {
          const unitIds = Array.isArray(cellValue)
            ? cellValue
            : cellValue
              ? [cellValue]
              : [];

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

  function getUnitPlacements(unitId, scheduleObject = schedule) {
    const placements = [];

    for (const [day, daySchedule] of Object.entries(scheduleObject || {})) {
      for (const [className, classSchedule] of Object.entries(
        daySchedule || {},
      )) {
        for (const [hour, cellValue] of Object.entries(classSchedule || {})) {
          const unitIds = Array.isArray(cellValue)
            ? cellValue
            : cellValue
              ? [cellValue]
              : [];

          if (unitIds.includes(unitId)) {
            placements.push(`${day}-${hour}`);
          }
        }
      }
    }

    return placements;
  }

  function hasTeacherConflict(
    currentClass,
    hour,
    teacherId,
    day = selectedDay,
  ) {
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

  function hasNotSameDaySameClassConflict(
    currentClass,
    currentHour,
    unit,
    day = selectedDay,
  ) {
    const group = getConstraintGroupById(unit.constraintGroupId);

    if (!groupHasRule(group, "notSameDaySameClass")) {
      return false;
    }

    for (const hour of getAllHourNumbers()) {
      if (String(hour) === String(currentHour)) continue;

      const unitIds = getCellUnitIds(day, currentClass, hour);

      const hasSameGroup = unitIds.some((unitId) => {
        const otherUnit = getUnitById(unitId);

        return (
          otherUnit && otherUnit.constraintGroupId === unit.constraintGroupId
        );
      });

      if (hasSameGroup) {
        return true;
      }
    }

    return false;
  }

  function hasNotSameTimeConflict(
    currentClass,
    currentHour,
    unit,
    day = selectedDay,
  ) {
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
          otherUnit && otherUnit.constraintGroupId === unit.constraintGroupId
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
      (freeDay) => normalizeDay(freeDay) === currentDay,
    );
  }

  function canUnitFillCell(unit, day, className, hour, options = {}) {
    if (!unit) return false;

    if (unit.className !== className) return false;

    if (
      getRemainingUnitHours(unit.id) <= 0 &&
      !options.allowAlreadyScheduledUnit
    ) {
      return false;
    }

    if (!canTeacherWorkAt(unit.teacherId, day, hour)) return false;

    if (isTeacherBusyAt(unit.teacherId, day, hour)) return false;

    if (violatesConstraintRules(unit, day, className, hour, options)) {
      return false;
    }

    return true;
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
    if (!visiblePanels.purpleHoleAlerts) return;

    const beforeKeys = new Set(beforeHoles.map(getPurpleHoleKey));

    const newHoles = afterHoles.filter(
      (hole) => !beforeKeys.has(getPurpleHoleKey(hole)),
    );

    if (newHoles.length === 0) return;

    const text = newHoles
      .map(
        (hole) => `יום ${hole.day}, כיתה ${hole.className}, שעה ${hole.hour}`,
      )
      .join("\n");

    alert(`נוצרו חורים סגולים חדשים:\n\n${text}`);
  }

  function isScheduledUnitMovableToSelectedCell(
    unit,
    sourceClassName,
    sourceHour,
  ) {
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

  function getPlacementProblemForUnitInSchedule(unit, scheduleObject, day, className, hour) {
    if (!unit) return "יחידת השיבוץ אינה קיימת";
    if (unit.className !== className) return "ניתן להזיז שיעור רק בתוך אותה כיתה";
    if (isBlockedCell(className, day, hour)) return "השעה אינה קיימת בכיתה זו ביום זה";
    if (isCellLocked(day, className, hour)) return "תא היעד נעול";
    if (isTeacherFreeDay(unit.teacherId, day)) return "המורה נמצא ביום חופשי";
    if (isTeacherBlockedHour(unit.teacherId, day, hour)) return "המורה חסום ביום ובשעה שנבחרו";
    if (isUnitConstraintGroupBlockedAt(unit, day, hour)) return "קבוצת השיבוץ חסומה ביום ובשעה שנבחרו";
    if (violatesConstraintRulesInSchedule(unit, scheduleObject, day, className, hour))
      return "השיבוץ מפר את חוקי קבוצת השיבוץ";
    return null;
  }

  function tryPlaceBundleInSchedule(scheduleObject, records) {
    const trial = structuredClone(scheduleObject);
    for (const record of records) {
      const unit = getUnitById(record.unitId);
      const problem = getPlacementProblemForUnitInSchedule(
        unit, trial, selectedDay, record.className, record.hour,
      );
      if (problem) return { ok: false, problem };
      const current = getCellUnitIdsFromSchedule(
        trial, selectedDay, record.className, record.hour,
      );
      setCellUnitIds(trial, selectedDay, record.className, record.hour, [
        ...current, record.unitId,
      ]);
    }
    return { ok: true, schedule: trial };
  }

  function validateMoveOrSwap(fromClass, fromHour, toClass, toHour, movingUnitIds, swapUnitIds = []) {
    const base = structuredClone(schedule);
    const allMovingIds = new Set([...(movingUnitIds || []), ...(swapUnitIds || [])]);

    for (const className of classes) {
      for (const hour of [fromHour, toHour]) {
        const ids = getCellUnitIdsFromSchedule(base, selectedDay, className, hour);
        const filtered = ids.filter((id) => !allMovingIds.has(id));
        if (filtered.length !== ids.length) {
          setCellUnitIds(base, selectedDay, className, hour, filtered);
        }
      }
    }

    let result = tryPlaceBundleInSchedule(
      base,
      (movingUnitIds || []).map((unitId) => ({ unitId, className: toClass, hour: String(toHour) })),
    );
    if (!result.ok) return result;

    if (swapUnitIds?.length) {
      result = tryPlaceBundleInSchedule(
        result.schedule,
        swapUnitIds.map((unitId) => ({ unitId, className: fromClass, hour: String(fromHour) })),
      );
      if (!result.ok) return result;
    }
    return { ok: true };
  }

  function swapScheduleColumns(firstHour, secondHour) {
    const fromHour = String(firstHour);
    const toHour = String(secondHour);
    if (fromHour === toHour) return;

    const hasLocked = classes.some(
      (className) =>
        isCellLocked(selectedDay, className, fromHour) ||
        isCellLocked(selectedDay, className, toHour),
    );
    if (hasLocked) {
      alert("לא ניתן להחליף טורים כאשר אחד התאים בשני הטורים נעול");
      return;
    }

    const next = structuredClone(schedule);
    const movingRecords = [];

    for (const className of classes) {
      const fromIds = getCellUnitIdsFromSchedule(schedule, selectedDay, className, fromHour);
      const toIds = getCellUnitIdsFromSchedule(schedule, selectedDay, className, toHour);
      setCellUnitIds(next, selectedDay, className, fromHour, []);
      setCellUnitIds(next, selectedDay, className, toHour, []);
      for (const unitId of fromIds) movingRecords.push({ unitId, className, hour: toHour });
      for (const unitId of toIds) movingRecords.push({ unitId, className, hour: fromHour });
    }

    const bundles = new Map();
    for (const record of movingRecords) {
      const unit = getUnitById(record.unitId);
      const key =
        unit && isSameTimeGroup(unit)
          ? `group:${unit.constraintGroupId}:${record.hour}`
          : `unit:${record.unitId}`;
      if (!bundles.has(key)) bundles.set(key, []);
      bundles.get(key).push(record);
    }

    let working = next;
    let returnedUnits = 0;
    let movedUnits = 0;

    for (const records of bundles.values()) {
      const result = tryPlaceBundleInSchedule(working, records);
      if (result.ok) {
        working = result.schedule;
        movedUnits += records.length;
      } else {
        returnedUnits += records.length;
      }
    }

    requestPurpleHoleCheck();
    updateScheduleWithHistory(() => working);
    setSelectedCell(null);
    setColumnSwapFirstHour(null);

    const suffix = returnedUnits > 0
      ? `\n${returnedUnits} יחידות שלא יכלו לעבור באופן חוקי הוחזרו למחסן השעות.`
      : "";
    alert(`הוחלפו הטורים שעה ${firstHour} ושעה ${secondHour}.\n${movedUnits} יחידות הועברו בהצלחה.${suffix}`);
  }

  function handleColumnHeaderClick(hour) {
    if (!columnSwapMode) return;
    if (columnSwapFirstHour == null) {
      setColumnSwapFirstHour(Number(hour));
      return;
    }
    const first = columnSwapFirstHour;
    setColumnSwapMode(false);
    setColumnSwapFirstHour(null);
    swapScheduleColumns(first, Number(hour));
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
      removeSameTimeGroupAt(selectedDay, hour, sameTimeUnit.constraintGroupId);
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
        hour,
      );

      const unit = getUnitById(unitId);

      if (
        append &&
        unit &&
        cellAlreadyHasTeacher(currentUnits, unit.teacherId)
      ) {
        return newSchedule;
      }

      const nextUnits = append ? [...currentUnits, unitId] : [unitId];

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
    return highlightedGroupId && unit?.constraintGroupId === highlightedGroupId;
  }

  function moveSameTimeGroup(
    fromHour,
    toHour,
    groupId,
    append = false,
    swap = false,
  ) {
    if (fromHour === toHour) return;

    const groupUnits = getScheduledSameTimeGroupUnitsAt(
      selectedDay,
      fromHour,
      groupId,
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
          fromHour,
        );

        const toUnits = getCellUnitIdsFromSchedule(
          newSchedule,
          selectedDay,
          className,
          toHour,
        );

        const cleanedFromUnits = fromUnits.filter(
          (id) => !unitIdsForClass.includes(id),
        );

        if (swap && toUnits.length > 0) {
          setCellUnitIds(newSchedule, selectedDay, className, fromHour, [
            ...cleanedFromUnits,
            ...toUnits,
          ]);

          setCellUnitIds(
            newSchedule,
            selectedDay,
            className,
            toHour,
            unitIdsForClass,
          );
        } else {
          setCellUnitIds(
            newSchedule,
            selectedDay,
            className,
            fromHour,
            cleanedFromUnits,
          );

          const nextToUnits = append
            ? [
              ...toUnits,
              ...unitIdsForClass.filter((id) => !toUnits.includes(id)),
            ]
            : unitIdsForClass;

          setCellUnitIds(
            newSchedule,
            selectedDay,
            className,
            toHour,
            nextToUnits,
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
      (candidate) => candidate.constraintGroupId === unit.constraintGroupId,
    );
  }

  function canPlaceUnitAt(unit, day, hour) {
    return (
      !isUnitConstraintGroupBlockedAt(unit, day, hour) &&
      canTeacherWorkAt(unit.teacherId, day, hour)
    );
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
          hour,
        );

        if (!append) {
          removeSameTimeGroupsFromTarget(
            newSchedule,
            selectedDay,
            hour,
            currentUnits,
          );
        }

        const baseUnits = append ? [...currentUnits] : [];

        for (const unit of unitsForClass) {
          if (!cellAlreadyHasTeacher(baseUnits, unit.teacherId)) {
            baseUnits.push(unit.id);
          }
        }

        setCellUnitIds(newSchedule, selectedDay, className, hour, baseUnits);
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
          hour,
        );

        const nextUnits = currentUnits.filter((id) => id !== unit.id);

        setCellUnitIds(newSchedule, day, unit.className, hour, nextUnits);
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
        for (const hour of getAllHourNumbers()) {
          if (getCellUnitIds(day, className, hour).includes(unitId)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  function moveSingleUnitWithinRow(
    fromClass,
    fromHour,
    toClass,
    toHour,
    unitId,
  ) {
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
        fromHour,
      );

      const targetUnits = getCellUnitIdsFromSchedule(
        newSchedule,
        selectedDay,
        toClass,
        toHour,
      );

      const remainingFromUnits = fromUnits.filter((id) => id !== unitId);

      if (ctrlPressed && targetUnits.length > 0) {
        const newTargetUnits = targetUnits.filter((id) => id !== unitId);

        setCellUnitIds(newSchedule, selectedDay, fromClass, fromHour, [
          ...remainingFromUnits,
          ...targetUnits,
        ]);

        setCellUnitIds(newSchedule, selectedDay, toClass, toHour, [
          ...newTargetUnits,
          unitId,
        ]);
      } else if (shiftPressed) {
        setCellUnitIds(
          newSchedule,
          selectedDay,
          fromClass,
          fromHour,
          remainingFromUnits,
        );

        setCellUnitIds(newSchedule, selectedDay, toClass, toHour, [
          ...targetUnits,
          unitId,
        ]);
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
      }),
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
        fromHour,
      );

      const targetUnits = getCellUnitIdsFromSchedule(
        newSchedule,
        selectedDay,
        toClass,
        toHour,
      );

      if (ctrlPressed && targetUnits.length > 0) {
        setCellUnitIds(
          newSchedule,
          selectedDay,
          fromClass,
          fromHour,
          targetUnits,
        );

        setCellUnitIds(newSchedule, selectedDay, toClass, toHour, fromUnits);
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
        selectedDay,
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

    const draggedUnitIdsForGroupTimeCheck =
      data?.source === "load"
        ? [data.unitId]
        : singleDragUnitId
          ? [singleDragUnitId]
          : data?.unitIds || [];

    const blockedGroupUnit = draggedUnitIdsForGroupTimeCheck
      .map(getUnitById)
      .find((unit) =>
        isUnitConstraintGroupBlockedAt(unit, selectedDay, toHour),
      );

    if (blockedGroupUnit) {
      const group = getConstraintGroupById(blockedGroupUnit.constraintGroupId);
      alert(`לא ניתן לשבץ בזמן זה: קבוצת ${group?.name || "השיבוץ"} חסומה.`);
      return;
    }

    const beforePurpleHoles = getPurpleHolesForDayFromSchedule(
      schedule,
      selectedDay,
    );

    // גרירה מתוך הטבלה
    if (data?.source === "cell") {
      const draggedUnitIds = singleDragUnitId
        ? [singleDragUnitId]
        : data.unitIds || [];

      const sameTimeUnit = draggedUnitIds
        .map(getUnitById)
        .find((unit) => unit && isSameTimeGroup(unit));

      const targetUnitIds = getCellUnitIds(selectedDay, toClass, toHour);

      if (!sameTimeUnit) {
        const validation = validateMoveOrSwap(
          data.fromClass,
          data.fromHour,
          toClass,
          toHour,
          draggedUnitIds,
          ctrlPressed ? targetUnitIds : [],
        );
        if (!validation.ok) {
          alert(`לא ניתן לבצע את ההעברה: ${validation.problem}`);
          return;
        }
      } else {
        const groupUnits = getScheduledSameTimeGroupUnitsAt(
          selectedDay,
          data.fromHour,
          sameTimeUnit.constraintGroupId,
        );
        const base = structuredClone(schedule);
        const groupIds = new Set(groupUnits.map((u) => u.id));

        for (const className of classes) {
          const ids = getCellUnitIdsFromSchedule(
            base,
            selectedDay,
            className,
            data.fromHour,
          );
          const filtered = ids.filter((id) => !groupIds.has(id));
          if (filtered.length !== ids.length) {
            setCellUnitIds(
              base,
              selectedDay,
              className,
              data.fromHour,
              filtered,
            );
          }
        }

        const validation = tryPlaceBundleInSchedule(
          base,
          groupUnits.map((u) => ({
            unitId: u.id,
            className: u.className,
            hour: String(toHour),
          })),
        );
        if (!validation.ok) {
          alert(`לא ניתן להזיז את קבוצת השיבוץ: ${validation.problem}`);
          return;
        }
      }

      if (sameTimeUnit) {
        requestPurpleHoleCheck();
        moveSameTimeGroup(
          data.fromHour,
          toHour,
          sameTimeUnit.constraintGroupId,
          shiftPressed,
          ctrlPressed,
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
          singleDragUnitId,
        );
      } else {
        moveUnitsWithinRow(
          data.fromClass,
          data.fromHour,
          toClass,
          toHour,
          data.unitIds || [],
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
          toHour,
        ).includes(candidate.id);

        if (alreadyInTarget) return false;

        if (isBlockedCell(candidate.className, selectedDay, toHour)) {
          return true;
        }

        if (isCellLocked(selectedDay, candidate.className, toHour)) {
          return true;
        }

        if (isUnitConstraintGroupBlockedAt(candidate, selectedDay, toHour)) {
          return true;
        }

        if (!canTeacherWorkAt(candidate.teacherId, selectedDay, toHour)) {
          return true;
        }

        return false;
      });

      if (invalidUnits.length > 0) {
        const names = invalidUnits
          .map((candidate) => {
            const teacher = getTeacherById(candidate.teacherId);
            const teacherName = teacher?.name || candidate.teacherId;

            if (isBlockedCell(candidate.className, selectedDay, toHour)) {
              return `${teacherName} (${candidate.className}) — השעה אינה קיימת בכיתה זו`;
            }

            if (isCellLocked(selectedDay, candidate.className, toHour)) {
              return `${teacherName} (${candidate.className}) — התא נעול`;
            }

            if (
              isUnitConstraintGroupBlockedAt(candidate, selectedDay, toHour)
            ) {
              const group = getConstraintGroupById(candidate.constraintGroupId);
              return `${teacherName} (${candidate.className}) — קבוצת ${group?.name || "השיבוץ"} חסומה בזמן זה`;
            }

            if (
              isTeacherBlockedHour(candidate.teacherId, selectedDay, toHour)
            ) {
              return `${teacherName} (${candidate.className}) — חסום/ה בשעה זו`;
            }

            if (isTeacherFreeDay(candidate.teacherId, selectedDay)) {
              return `${teacherName} (${candidate.className}) — ביום חופשי`;
            }

            return `${teacherName} (${candidate.className})`;
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
      holes.push(...getPurpleHolesForDayFromSchedule(scheduleObject, day));
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
            `ייבוא הסדין נכשל. הגליונות שנמצאו בקובץ הם: ${result.sheetNames.join(", ")}`,
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
        `הייבוא הצליח!\nנטענו ${parsedData.teachers.length} מורים ו-${parsedData.classes.length} כיתות.`,
      );
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  }

  const warnings = getWarnings();
  const visibleHours = getVisibleHoursForSelectedDay();

  const schedulingProgress = (() => {
    let totalHours = 0;
    let placedHours = 0;
    let incompleteUnits = 0;

    for (const unit of teachingUnits) {
      const requiredHours = Math.max(0, Number(unit.hours) || 0);

      if (requiredHours <= 0) continue;

      const scheduledHours = Math.min(
        requiredHours,
        countScheduledUnitHours(unit.id, schedule),
      );

      totalHours += requiredHours;
      placedHours += scheduledHours;

      if (scheduledHours < requiredHours) {
        incompleteUnits += 1;
      }
    }

    const remainingHours = Math.max(0, totalHours - placedHours);
    const percentage =
      totalHours === 0
        ? 0
        : Math.min(100, Math.round((placedHours / totalHours) * 100));

    return {
      totalHours,
      placedHours,
      remainingHours,
      incompleteUnits,
      percentage,
    };
  })();

  function debugValidateCurrentSchedule() {
    const report = validateSchedule({
      schedule,
      schoolData,
      approvedExceptions:
        schedulingAgentApprovedExceptions,
    });

    const agentContext = createSchedulingAgentContext({
      schoolData,
      schedule,
      approvedExceptions: schedulingAgentApprovedExceptions,
      rules: [],
    });

    console.log("Scheduling agent context:", agentContext);

    console.group("Scheduling validator report");

    console.log("Valid:", report.valid);
    console.log("Statistics:", report.statistics);
    console.log("Missing units:", report.missingUnits);
    if (report.errors.length > 0) {
      console.group("Errors");
      report.errors.forEach((error, index) => {
        console.log(index + 1, error);
      });
      console.groupEnd();
    }

    if (report.warnings.length > 0) {
      console.group("Warnings");
      report.warnings.forEach((warning, index) => {
        console.log(index + 1, warning);
      });
      console.groupEnd();
    }

    console.groupEnd();

    return report;
  }

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
              className={activeView === "freeDays" ? "active-tab" : ""}
              onClick={() => setActiveView("freeDays")}
            >
              ימים חופשיים
            </button>
            <button
              className={activeView === "groupConstraints" ? "active-tab" : ""}
              onClick={() => setActiveView("groupConstraints")}
            >
              אילוצי קבוצות
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
            <button
              className={activeView === "schedulingAgent" ? "active-tab" : ""}
              onClick={() => setActiveView("schedulingAgent")}
            >
              סוכן שיבוץ AI
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

              <button
                className={`action-button ${columnSwapMode ? "column-swap-active" : ""}`}
                onClick={() => {
                  setColumnSwapMode((prev) => !prev);
                  setColumnSwapFirstHour(null);
                }}
                title="לחץ ואז בחר שתי כותרות של שעות כדי להחליף את שני הטורים"
              >
                {columnSwapMode
                  ? columnSwapFirstHour == null
                    ? "בחר טור ראשון"
                    : `שעה ${columnSwapFirstHour} נבחרה — בחר טור שני`
                  : "החלפת טורים"}
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
                        checked={visiblePanels.progress}
                        onChange={() => togglePanel("progress")}
                      />
                      מד התקדמות
                    </label>

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
                        onChange={(e) =>
                          setShowFreeDayTeachers(e.target.checked)
                        }
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
                        גובה שורות:{" "}
                        {rowHeightOffset > 0
                          ? `+${rowHeightOffset}`
                          : rowHeightOffset}
                        px
                      </label>

                      <input
                        type="range"
                        min="-8"
                        max="20"
                        step="1"
                        value={rowHeightOffset}
                        onChange={(e) =>
                          setRowHeightOffset(Number(e.target.value))
                        }
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
                  setIsFocusMode((prev) => !prev);
                }}
              >
                {isFocusMode ? "צא ממסך שיבוץ מלא" : "מסך שיבוץ מלא"}
              </button>
            </div>

            {visiblePanels.progress && (
              <SchedulingProgressPanel progress={schedulingProgress} />
            )}

            {visiblePanels.groups && (
              <ConstraintGroupsPanel
                constraintGroups={constraintGroups}
                homeroomTeacherColor={
                  schoolData.homeroomTeacherColor || "#c8e6c9"
                }
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
                    {visibleHours.map((hour) => (
                      <th
                        key={hour}
                        onClick={() => handleColumnHeaderClick(hour)}
                        className={[
                          hoveredCell?.hour === String(hour) ? "highlighted-header" : "",
                          columnSwapMode ? "column-swap-header" : "",
                          columnSwapFirstHour === Number(hour) ? "column-swap-selected-header" : "",
                        ].join(" ")}
                        title={columnSwapMode ? "בחר טור להחלפה" : undefined}
                      >
                        שעה {hour}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {classes
                    .filter((className) =>
                      shouldShowClassInSelectedDay(className),
                    )
                    .map((className) => (
                      <tr key={className}>
                        <LoadCell className={className}>
                          {teachingUnits
                            .filter((unit) => unit.className === className)
                            .map((unit) => {
                              const teacher = getTeacherById(unit.teacherId);
                              const remaining = getRemainingUnitHours(unit.id);
                              const isFreeDay = isTeacherFreeDay(
                                unit.teacherId,
                                selectedDay,
                              );

                              if (!showFreeDayTeachers && isFreeDay)
                                return null;
                              //const group = getConstraintGroupById(unit.constraintGroupId);
                              const group = getUnitDisplayGroup(unit);
                              const teacherHighlight =
                                getTeacherHighlight(teacher);
                              const selectedCellHint =
                                getSelectedCellUnitHint(unit);

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
                                  selectedCellHint={selectedCellHint}
                                  onSelectLoadUnit={(unitId) => {
                                    setSelectedLoadUnitId(unitId);
                                    setActivePlacementUnitId(unitId);
                                  }}
                                  onAssignGroup={(unit) => {
                                    setGroupDialogUnit(unit);
                                    setGroupSearchText("");
                                    setGroupDialogHours(String(unit.hours));
                                  }}
                                  onHighlightGroup={setHighlightedGroupId}
                                  highlightedGroup={isHighlightedGroup(unit)}
                                />
                              );
                            })}
                        </LoadCell>

                        {visiblePanels.dailyBalance &&
                          (() => {
                            const balanceColor = getDailyBalanceColor(
                              className,
                              selectedDay,
                            );

                            return (
                              <td
                                className="daily-balance-cell"
                                style={{
                                  backgroundColor: balanceColor,
                                  color: getBalanceTextColor(balanceColor),
                                }}
                              >
                                {getRemainingHoursForClassInDay(
                                  className,
                                  selectedDay,
                                )}
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
                          const unitIds = getCellUnitIds(
                            selectedDay,
                            className,
                            hour,
                          );
                          const units = unitIds
                            .map(getUnitById)
                            .filter(Boolean);
                          const selectedCellHintsByUnit = {};

                          const teachersByUnit = {};
                          const groupsByUnit = {};
                          const teacherHighlightsByUnit = {};

                          for (const unit of units) {
                            const teacher = getTeacherById(unit.teacherId);
                            const selectedCellHint = getSelectedCellUnitHint(
                              unit,
                              {
                                allowAlreadyScheduledUnit: true,
                                sourceClassName: className,
                                sourceHour: hour,
                              },
                            );

                            if (selectedCellHint) {
                              selectedCellHintsByUnit[unit.id] =
                                selectedCellHint;
                            }
                            teachersByUnit[unit.id] = teacher;
                            groupsByUnit[unit.id] = getUnitDisplayGroup(unit);
                            teacherHighlightsByUnit[unit.id] =
                              getTeacherHighlight(teacher);
                          }

                          const conflictingTeacherIds = units
                            .filter(
                              (unit) =>
                                hasTeacherConflict(
                                  className,
                                  hour,
                                  unit.teacherId,
                                ) ||
                                hasNotSameDaySameClassConflict(
                                  className,
                                  hour,
                                  unit,
                                ) ||
                                hasNotSameTimeConflict(className, hour, unit),
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
                                  unit.constraintGroupId === highlightedGroupId,
                              )
                              .map((unit) => unit.id),
                          );

                          const blocked = isBlockedCell(
                            className,
                            selectedDay,
                            hour,
                          );
                          const placementHint = getPlacementHint(
                            className,
                            selectedDay,
                            hour,
                          );
                          const purpleHole = isPurpleHoleCell(
                            selectedDay,
                            className,
                            hour,
                          );
                          const difficultyCount = visiblePanels.difficultyHints
                            ? getDifficultyCount(className, selectedDay, hour)
                            : null;
                          const activeTeacherHere = cellHasActiveTeacher(
                            className,
                            selectedDay,
                            hour,
                          );
                          const locked = isCellLocked(
                            selectedDay,
                            className,
                            hour,
                          );

                          return (
                            <DroppableCell
                              purpleHole={purpleHole}
                              locked={locked}
                              selectedCellHintsByUnit={selectedCellHintsByUnit}
                              onToggleLock={() =>
                                toggleCellLock(selectedDay, className, hour)
                              }
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
                              difficultyLevel={getDifficultyLevel(
                                difficultyCount,
                              )}
                              onClick={() => {
                                setSelectedCell({
                                  className,
                                  hour: String(hour),
                                });
                                setSelectedLoadUnitId(null);
                                setActivePlacementUnitId(null);
                                setDraggedTeacherId(null);

                                const firstUnit = units[0];

                                setHighlightedGroupId(
                                  firstUnit?.constraintGroupId || null,
                                );
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
            hours={getAllHourNumbers()}
            selectedClassForShahaf={selectedClassForShahaf}
            setSelectedClassForShahaf={setSelectedClassForShahaf}
            getCellUnitIds={getCellUnitIds}
            getUnitById={getUnitById}
            getTeacherById={getTeacherById}
            dailyHoursByClass={dailyHoursByClass}
            getClassHoursForDay={getClassHoursForDay}
            isShahafCellChanged={isShahafCellChanged}
            classHasShahafChanges={classHasShahafChanges}
            checkpoints={checkpoints}
            comparisonCheckpointId={comparisonCheckpointId}
            setComparisonCheckpointId={setComparisonCheckpointId}
            comparisonCheckpoint={getComparisonCheckpoint()}
            teachingUnits={teachingUnits}
            countScheduledUnitHours={countScheduledUnitHours}
          />
        )}

        {activeView === "teacher" && (
          <TeacherView
            teachers={teachers}
            classes={classes}
            days={days}
            hours={getAllHourNumbers()}
            teacherHasViewChanges={teacherHasViewChanges}
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
            teachingUnits={teachingUnits}
            countScheduledUnitHours={countScheduledUnitHours}
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

        {activeView === "freeDays" && (
          <FreeDaysView teachers={teachers} classes={classes} days={days} />
        )}

        {activeView === "groupConstraints" && (
          <GroupConstraintsView
            constraintGroups={constraintGroups}
            days={days}
            hours={getAllHourNumbers()}
            isGroupBlockedAt={isConstraintGroupBlockedAt}
            onToggleSlot={toggleConstraintGroupBlockedSlot}
            onSetAllSlots={setAllConstraintGroupSlotsBlocked}
          />
        )}

        {activeView === "schedulingAgent" && (
          <SchedulingAgentView
            key={`scheduling-agent-${schedulingAgentProjectRevision}`}
            agentContext={schedulingAgentContext}
            validationReport={schedulingAgentValidationReport}
            rules={schedulingAgentRules}
            onRulesChange={setSchedulingAgentRules}
            approvedExceptions={schedulingAgentApprovedExceptions}
            onApprovedExceptionsChange={setSchedulingAgentApprovedExceptions}
            messages={schedulingAgentMessages}
            onMessagesChange={setSchedulingAgentMessages}
            onSimulateScheduleMove={
              simulateAgentScheduleMove
            }
            workspace={schedulingAgentWorkspace}
            onStartWorkspace={startSchedulingAgentWorkspace}
            onClearWorkspace={clearSchedulingAgentWorkspace}
            onTryWorkspaceMove={
              tryAgentWorkspaceMove
            }
            onTryWorkspaceMovePure={
              tryAgentWorkspaceMovePure
            }
          />
        )}

        {activeView === "file" && (
          <FileManager
            saveProjectToFile={saveProjectToFile}
            saveSchedulingMetadataToFile={saveSchedulingMetadataToFile}
            loadProjectFromFile={loadProjectFromFile}
            addProjectFileToCurrentProject={addProjectFileToCurrentProject}
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
            copyConstraintGroupsFromCloudProject={
              copyConstraintGroupsFromCloudProject
            }
          />
        )}

        {showHelpDialog && (
          <div
            className="modal-backdrop"
            onClick={() => setShowHelpDialog(false)}
          >
            <div className="help-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="help-header">
                <h2>עזרה</h2>

                <button
                  type="button"
                  className="mini-button"
                  onClick={() => setShowHelpDialog(false)}
                >
                  סגור
                </button>
              </div>

              <div className="help-content">
                <ReactMarkdown>{HELP_TEXT}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
        {showHelpDialog && (
          <div
            className="dialog-overlay"
            onClick={() => setShowHelpDialog(false)}
          >
            <div className="help-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="help-header">
                <h2>עזרה</h2>

                <button onClick={() => setShowHelpDialog(false)}>✖</button>
              </div>

              <div className="help-content">
                <ReactMarkdown>{HELP_TEXT}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
        {groupDialogUnit && (
          <div
            className="modal-backdrop"
            onClick={() => {
              setGroupDialogUnit(null);
              setGroupSearchText("");
            }}
          >
            <div
              className="group-dialog assignment-group-dialog"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="assignment-group-dialog-header">
                <h3>פיצול ושיוך לקבוצת שיבוץ</h3>

                <p>
                  יחידה:{" "}
                  <strong>
                    {getTeacherById(groupDialogUnit.teacherId)?.name}
                    {groupDialogUnit.subject &&
                      groupDialogUnit.subject !== "רגיל"
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

                {groupDialogUnit.constraintGroupId && (
                  <p className="current-assignment-group">
                    קבוצה נוכחית:{" "}
                    <strong>
                      {
                        getConstraintGroupById(
                          groupDialogUnit.constraintGroupId,
                        )?.name
                      }
                    </strong>
                  </p>
                )}

                <input
                  type="search"
                  className="constraint-group-search"
                  value={groupSearchText}
                  onChange={(e) => setGroupSearchText(e.target.value)}
                  placeholder="חיפוש קבוצה לפי שם..."
                  autoFocus
                />
              </div>

              <div className="constraint-group-list">
                <button
                  className="group-option no-group"
                  onClick={() =>
                    splitUnitAndAssignGroup(
                      groupDialogUnit.id,
                      null,
                      groupDialogHours,
                    )
                  }
                >
                  ללא קבוצה
                </button>

                {constraintGroups
                  .filter((group) =>
                    (group.name || "")
                      .toLocaleLowerCase("he")
                      .includes(groupSearchText.trim().toLocaleLowerCase("he")),
                  )
                  .map((group) => (
                    <button
                      key={group.id}
                      className="group-option"
                      onClick={() =>
                        splitUnitAndAssignGroup(
                          groupDialogUnit.id,
                          group.id,
                          groupDialogHours,
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
                          if (rule === "notSameDaySameClass")
                            return "אסור באותה שורה";
                          return rule;
                        })
                        .join(" + ")}
                    </button>
                  ))}

                {constraintGroups.length > 0 &&
                  constraintGroups.filter((group) =>
                    (group.name || "")
                      .toLocaleLowerCase("he")
                      .includes(groupSearchText.trim().toLocaleLowerCase("he")),
                  ).length === 0 && (
                    <p className="empty-group-search">
                      לא נמצאו קבוצות מתאימות
                    </p>
                  )}
              </div>

              <div className="assignment-group-dialog-footer">
                <button
                  className="dialog-cancel"
                  onClick={() => {
                    setGroupDialogUnit(null);
                    setGroupSearchText("");
                  }}
                >
                  ביטול
                </button>
              </div>
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
    </DndContext>
  );
}
