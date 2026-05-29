import * as XLSX from "xlsx";

export async function readExcelFile(file) {
    const arrayBuffer = await file.arrayBuffer();

    const workbook = XLSX.read(arrayBuffer, {
        type: "array",
    });

    const sheetNames = workbook.SheetNames;
    const sheets = {};

    for (const sheetName of sheetNames) {
        const worksheet = workbook.Sheets[sheetName];

        sheets[sheetName] = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: "",
        });
    }

    return {
        sheetNames,
        sheets,
    };
}

export function buildDataFromTimetableSheet(importedExcel) {
    const sheet = importedExcel.sheets["טבלת שיבוץ שעות"];

    if (!sheet) {
        throw new Error('לא נמצא גיליון בשם "טבלת שיבוץ שעות"');
    }

    const headerRow = sheet[0];

    const teacherNameCol = headerRow.indexOf("שם המורה");
    const teacherIdCol = headerRow.indexOf("מספר מורה");
    const educationClassCol = headerRow.indexOf("מחנכת כיתה");
    const freeDaysCol = headerRow.indexOf("ימים חופשיים");

    const firstClassCol = 4;

    const classes = headerRow
        .slice(firstClassCol)
        .filter((className) => String(className).trim() !== "")
        .map((className) => String(className).trim());

    const teachers = [];
    const teachingLoads = {};

    for (const className of classes) {
        teachingLoads[className] = {};
    }

    for (let rowIndex = 1; rowIndex < sheet.length; rowIndex++) {
        const row = sheet[rowIndex];

        const teacherName = String(row[teacherNameCol] || "").trim();
        const teacherId = String(row[teacherIdCol] || "").trim();

        if (!teacherName || !teacherId) continue;

        teachers.push({
            id: teacherId,
            name: teacherName,
            educationClass: String(row[educationClassCol] || "").trim(),
            freeDays: String(row[freeDaysCol] || "")
                .replaceAll("יום", "")
                .split(/[,،\s]+/)
                .map((day) => day.trim())
                .filter(Boolean),
        });

        classes.forEach((className, index) => {
            const value = Number(row[firstClassCol + index]);

            if (!Number.isNaN(value) && value > 0) {
                teachingLoads[className][teacherId] = value;
            }
        });
    }
    const teachingUnits = [];

    for (const className of classes) {
        for (const [teacherId, hours] of Object.entries(teachingLoads[className])) {
            teachingUnits.push({
                id: `${className}-${teacherId}-regular`,
                className,
                teacherId,
                subject: "רגיל",
                hours,
                constraintGroupId: null,
                color: null,
            });
        }
    }

    return {
        teachers,
        classes,
        hours: [1, 2, 3, 4, 5, 6],
        days: ["א", "ב", "ג", "ד", "ה", "ו"],
        teachingLoads,
        teachingUnits,
    };
}

function findColumn(headerRow, possibleNames) {
    return headerRow.findIndex((cell) =>
        possibleNames.includes(String(cell).trim())
    );
}

export function buildDataFromRawSadin(importedExcel) {
    const teachersSheet = importedExcel.sheets["רשימת מורים"];
    const classesSheet = importedExcel.sheets["רשימת כיתות"];
    console.log("רשימת כיתות:", classesSheet.slice(0, 20));
    const summarySheet = importedExcel.sheets["סיכום לפי מורה"];

    if (!teachersSheet || !classesSheet || !summarySheet) {
        throw new Error("לא נמצאו כל הגליונות הדרושים: רשימת מורים, רשימת כיתות, סיכום לפי מורה");
    }

    const teachers = parseTeachersSheet(teachersSheet);
    const classesData = parseClassesSheet(classesSheet, teachers);
    const sheetRows = parseSummaryByTeacherSheet(summarySheet, teachers, classesData.classes);

    const mergedRowsMap = new Map();

    for (const row of sheetRows) {
        const key = `${row.className}|${row.teacherId}`;

        if (!mergedRowsMap.has(key)) {
            mergedRowsMap.set(key, {
                className: row.className,
                teacherId: row.teacherId,
                teacherName: row.teacherName,
                subject: "רגיל",
                hours: 0,
            });
        }

        mergedRowsMap.get(key).hours += Number(row.hours) || 0;
    }

    const mergedRows = [...mergedRowsMap.values()];

    const teachingUnits = mergedRows.map((row, index) => ({
        id: `unit-${index + 1}`,
        className: row.className,
        teacherId: row.teacherId,
        subject: "רגיל",
        hours: row.hours,
        constraintGroupId: null,
    }));

    const teachingLoads = {};

    for (const className of classesData.classes) {
        teachingLoads[className] = {};
    }

    for (const unit of teachingUnits) {
        if (!teachingLoads[unit.className]) {
            teachingLoads[unit.className] = {};
        }

        teachingLoads[unit.className][unit.teacherId] =
            (teachingLoads[unit.className][unit.teacherId] || 0) + unit.hours;
    }

    const teachersWithEducators = teachers.map((teacher) => {
        const educationClass = classesData.educatorsByTeacherId[teacher.id] || "";

        return {
            ...teacher,
            educationClass,
        };
    });

    return {
        teachers: teachersWithEducators,
        classes: classesData.classes,
        hours: [1, 2, 3, 4, 5, 6],
        days: ["א", "ב", "ג", "ד", "ה", "ו"],
        teachingLoads,
        teachingUnits,
        sheetRows,
        rawSubjectRows: sheetRows,
        constraintGroups: [],
        meetings: [],
        homeroomTeacherColor: "#c8e6c9",
    };
}

function parseTeachersSheet(sheet) {
    const header = sheet[0];

    const nameCol = findColumn(header, ["שם מורה", "שם המורה", "מורה"]);
    const freeDaysCol = findColumn(header, ["ימים חופשיים", "יום חופשי", "חופשי"]);

    if (nameCol === -1) {
        throw new Error('בגליון "רשימת מורים" לא נמצאה עמודת שם מורה');
    }

    return sheet
        .slice(1)
        .map((row, index) => {
            const name = String(row[nameCol] || "").trim();

            if (!name) return null;

            return {
                id: String(index + 1),
                name,
                freeDays:
                    freeDaysCol === -1
                        ? []
                        : String(row[freeDaysCol] || "")
                            .replaceAll("יום", "")
                            .split(/[,،\s]+/)
                            .map((day) => day.trim())
                            .filter(Boolean),
                educationClass: "",
            };
        })
        .filter(Boolean);
}

function parseClassesSheet(sheet, teachers = []) {
    const header = sheet[0];

    const classCol = findColumn(header, [
        "כיתה",
        "שם כיתה",
        "רשימת כיתות",
    ]);

    const educatorCol = findColumn(header, [
        "מחנך",
        "מחנכת",
        "מחנך/ת",
        "מחנכ/ת",
    ]);

    if (classCol === -1) {
        throw new Error('בגליון "רשימת כיתות" לא נמצאה עמודת כיתה');
    }

    const classes = [];
    const educatorsByTeacherId = {};

    for (const row of sheet.slice(1)) {
        const className = String(row[classCol] || "").trim();

        if (!className) continue;

        classes.push(className);

        if (educatorCol !== -1) {
            const educatorName = String(row[educatorCol] || "").trim();

            if (educatorName) {
                const teacher = teachers.find(
                    (teacher) => teacher.name === educatorName
                );

                if (teacher) {
                    educatorsByTeacherId[teacher.id] = className;
                } else {
                    console.warn(
                        `מחנכ/ת "${educatorName}" בכיתה ${className} לא נמצא/ה ברשימת המורים`
                    );
                }
            }
        }
    }

    return {
        classes,
        educatorsByTeacherId,
    };
}

function parseSummaryByTeacherSheet(sheet, teachers, classes) {
    const rows = [];

    let currentTeacher = null;
    let headerCols = null;

    for (let rowIndex = 0; rowIndex < sheet.length; rowIndex++) {
        const row = sheet[rowIndex];

        const firstCell = String(row[0] || "").trim();

        // התחלת בלוק מורה חדש
        if (firstCell === "שם המורה") {
            const teacherName = String(row[1] || "").trim();

            currentTeacher = teachers.find((teacher) => teacher.name === teacherName);
            headerCols = null;

            continue;
        }

        // שורת כותרות בתוך בלוק מורה
        if (firstCell === "כיתה") {
            headerCols = {
                classCol: 0,
                subjectCol: row.findIndex(
                    (cell) => String(cell || "").trim() === "מקצוע"
                ),
                hoursCol: row.findIndex(
                    (cell) => String(cell || "").trim() === "שעות"
                ),
                notesCol: row.findIndex(
                    (cell) => String(cell || "").trim() === "הערות"
                ),
            };

            continue;
        }

        if (!currentTeacher || !headerCols) continue;

        const className = String(row[headerCols.classCol] || "").trim();
        const subject = String(row[headerCols.subjectCol] || "רגיל").trim();
        const hours = Number(row[headerCols.hoursCol]) || 0;
        const notes =
            headerCols.notesCol === -1
                ? ""
                : String(row[headerCols.notesCol] || "").trim();

        if (!className || !classes.includes(className) || hours <= 0) {
            continue;
        }

        rows.push({
            teacherId: currentTeacher.id,
            teacherName: currentTeacher.name,
            className,
            subject: subject || "רגיל",
            hours,
            notes,
        });
    }

    return rows;
}