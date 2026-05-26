export const teachers = [
  { id: "1", name: "אוחנה תהילה" },
  { id: "2", name: "כהן רחל" },
  { id: "3", name: "לוי מיכל" },
];

export const classes = ["א1", "א2", "ב1", "ב2"];

export const hours = [1, 2, 3, 4, 5, 6];

export const days = ["א", "ב", "ג", "ד", "ה", "ו"];

export const teachingLoads = {
  א1: {
    1: 3,
    2: 2,
  },

  א2: {
    2: 3,
    3: 2,
  },

  ב1: {
    1: 2,
    3: 3,
  },

  ב2: {
    1: 1,
    2: 2,
    3: 2,
  },
};

export const teachingUnits = [
  {
    id: "א1-1-regular",
    className: "א1",
    teacherId: "1",
    subject: "רגיל",
    hours: 3,
    constraintGroupId: null,
    color: null,
  },
  {
    id: "א1-2-regular",
    className: "א1",
    teacherId: "2",
    subject: "רגיל",
    hours: 2,
    constraintGroupId: null,
    color: null,
  },
  {
    id: "א2-2-regular",
    className: "א2",
    teacherId: "2",
    subject: "רגיל",
    hours: 3,
    constraintGroupId: null,
    color: null,
  },
  {
    id: "א2-3-regular",
    className: "א2",
    teacherId: "3",
    subject: "רגיל",
    hours: 2,
    constraintGroupId: null,
    color: null,
  },
];

export const constraintGroups = [
  {
    id: "english-a",
    name: "אנגלית שכבה א",
    color: "#ffd54f",
    type: "sameTime",
  },
  {
    id: "computer-room",
    name: "חדר מחשבים",
    color: "#64b5f6",
    type: "notSameTime",
  },
];