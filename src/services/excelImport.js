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