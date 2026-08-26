
import fs from "node:fs";
import { evaluateGenericRuleExpression } from "../src/scheduling/genericRuleEngine.js";

const projectPath = process.argv[2];
const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));

const expression = {
  "type":"and",
  "children":[
    {
      "type":"aggregate","source":"teacher_days",
      "filters":[{"field":"teacherId","op":"eq","value":"10"}],
      "exclude":[],"groupBy":["teacherId","day"],
      "metric":{"type":"gap_count","field":"gapCount"},
      "assert":{"op":"eq","value":0}
    },
    {
      "type":"and","children":[
        {
          "type":"aggregate","source":"teacher_days",
          "filters":[
            {"field":"teacherId","op":"eq","value":"10"},
            {"field":"day","op":"eq","value":"ב"},
            {"field":"count","op":"gt","value":0}
          ],
          "exclude":[],"groupBy":["teacherId","day"],
          "metric":{"type":"field_value","field":"count"},
          "assert":{"op":"eq","value":6}
        },
        {
          "type":"aggregate","source":"teacher_days",
          "filters":[
            {"field":"teacherId","op":"eq","value":"10"},
            {"field":"day","op":"eq","value":"ב"},
            {"field":"count","op":"gt","value":0}
          ],
          "exclude":[],"groupBy":["teacherId","day"],
          "metric":{"type":"field_value","field":"startHour"},
          "assert":{"op":"eq","value":1}
        }
      ]
    },
    {
      "type":"and","children":[
        {
          "type":"aggregate","source":"teacher_days",
          "filters":[
            {"field":"teacherId","op":"eq","value":"10"},
            {"field":"day","op":"in","value":["ג","ד","ה"]}
          ],
          "exclude":[],"groupBy":["teacherId"],
          "metric":{"type":"count_where","field":"count",
                    "where":{"field":"count","op":"eq","value":6}},
          "assert":{"op":"eq","value":1}
        },
        {
          "type":"aggregate","source":"teacher_days",
          "filters":[
            {"field":"teacherId","op":"eq","value":"10"},
            {"field":"day","op":"in","value":["ג","ד","ה"]}
          ],
          "exclude":[],"groupBy":["teacherId"],
          "metric":{"type":"count_where","field":"count",
                    "where":{"field":"count","op":"eq","value":5}},
          "assert":{"op":"eq","value":2}
        },
        {
          "type":"aggregate","source":"teacher_days",
          "filters":[
            {"field":"teacherId","op":"eq","value":"10"},
            {"field":"day","op":"in","value":["ג","ד","ה"]},
            {"field":"count","op":"gt","value":0}
          ],
          "exclude":[],"groupBy":["teacherId","day"],
          "metric":{"type":"field_value","field":"startHour"},
          "assert":{"op":"eq","value":1}
        }
      ]
    }
  ]
};

const result = evaluateGenericRuleExpression({
  rule:{id:"law-8-real"},
  expression,
  schedule:project.schedule,
  schoolData:project.schoolData
});

console.log(JSON.stringify(result,null,2));
if (!result.supported || !result.valid) process.exit(1);
