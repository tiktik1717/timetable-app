
import { evaluateGenericRuleExpression } from "../src/scheduling/genericRuleEngine.js";

const teacherId = "10";
const classes = ["א1","א2","א3"];

const teachingUnits = [];
const schedule = {};

function add(day, hour, cls, suffix) {
  const id = `u-${day}-${hour}-${suffix}`;
  teachingUnits.push({
    id,
    teacherId,
    className: cls,
    subject: "בדיקה",
    hours: 1,
    constraintGroupId: suffix.startsWith("dup") ? "group-test" : null,
  });
  schedule[day] ??= {};
  for (const c of classes) schedule[day][c] ??= {};
  schedule[day][cls][String(hour)] ??= [];
  schedule[day][cls][String(hour)].push(id);
}

// Monday: six distinct periods, but SEVEN placement records.
// Hour 1 has two structural placements.
for (let h=1; h<=6; h++) add("ב", h, "א1", `base-${h}`);
add("ב", 1, "א2", "dup-1");

// Tue: 6 consecutive hours.
for (let h=1; h<=6; h++) add("ג", h, "א1", `g-${h}`);
// Wed/Thu: 5 consecutive hours each.
for (let h=1; h<=5; h++) add("ד", h, "א1", `d-${h}`);
for (let h=1; h<=5; h++) add("ה", h, "א1", `h-${h}`);

const schoolData = {
  teachers: [{id: teacherId, name:"גימני ליאור"}],
  classes,
  teachingUnits,
  constraintGroups: [{id:"group-test",name:"קבוצת בדיקה"}],
};

const expression = {
  type:"and",
  children:[
    {
      type:"aggregate", source:"teacher_days",
      filters:[{field:"teacherId",op:"eq",value:"10"}],
      exclude:[], groupBy:["teacherId","day"],
      metric:{type:"gap_count",field:"gapCount"},
      assert:{op:"eq",value:0}
    },
    {
      type:"and", children:[
        {
          type:"aggregate", source:"teacher_days",
          filters:[
            {field:"teacherId",op:"eq",value:"10"},
            {field:"day",op:"eq",value:"ב"},
            {field:"count",op:"gt",value:0}
          ],
          exclude:[], groupBy:["teacherId","day"],
          metric:{type:"field_value",field:"count"},
          assert:{op:"eq",value:6}
        },
        {
          type:"aggregate", source:"teacher_days",
          filters:[
            {field:"teacherId",op:"eq",value:"10"},
            {field:"day",op:"eq",value:"ב"},
            {field:"count",op:"gt",value:0}
          ],
          exclude:[], groupBy:["teacherId","day"],
          metric:{type:"field_value",field:"startHour"},
          assert:{op:"eq",value:1}
        }
      ]
    },
    {
      type:"and", children:[
        {
          type:"aggregate", source:"teacher_days",
          filters:[
            {field:"teacherId",op:"eq",value:"10"},
            {field:"day",op:"in",value:["ג","ד","ה"]}
          ],
          exclude:[], groupBy:["teacherId"],
          metric:{
            type:"count_where",field:"count",
            where:{field:"count",op:"eq",value:6}
          },
          assert:{op:"eq",value:1}
        },
        {
          type:"aggregate", source:"teacher_days",
          filters:[
            {field:"teacherId",op:"eq",value:"10"},
            {field:"day",op:"in",value:["ג","ד","ה"]}
          ],
          exclude:[], groupBy:["teacherId"],
          metric:{
            type:"count_where",field:"count",
            where:{field:"count",op:"eq",value:5}
          },
          assert:{op:"eq",value:2}
        },
        {
          type:"aggregate", source:"teacher_days",
          filters:[
            {field:"teacherId",op:"eq",value:"10"},
            {field:"day",op:"in",value:["ג","ד","ה"]},
            {field:"count",op:"gt",value:0}
          ],
          exclude:[], groupBy:["teacherId","day"],
          metric:{type:"field_value",field:"startHour"},
          assert:{op:"eq",value:1}
        }
      ]
    }
  ]
};

const result = evaluateGenericRuleExpression({
  rule:{id:"law-8"},
  expression,
  schedule,
  schoolData
});
console.log(JSON.stringify(result,null,2));

if (!result.supported || !result.valid) process.exit(1);
