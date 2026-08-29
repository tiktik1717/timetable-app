
import {
  validateSemanticContract,
  repairFormalRuleSemanticContract,
  buildExistsRepairFromSemanticOnly,
} from "../../src/scheduling/semanticContractValidator.js";

function assert(c,m){ if(!c) throw new Error(m); }

// Case 21 family: stale LKG used subject even though current grounding resolved
// structural constraint groups. It must be repaired to constraintGroupId.
const compiled21={
  formalizationStatus:"semantic_only",
  resolvedEntities:[
    {entityType:"constraintGroup",id:"gD",name:"English D"},
    {entityType:"constraintGroup",id:"gH",name:"English H"},
    {entityType:"constraintGroup",id:"gV",name:"English V"},
  ]
};
const lkg21={
  version:4,severity:"recommended",
  expression:{
    type:"aggregate_pipeline",
    source:"placements",
    filters:[
      {field:"isInstructionalPlacement",op:"eq",value:true},
      {field:"subject",op:"eq",value:"English"},
    ],
    exclude:[],stages:[],assertions:[]
  }
};
const repaired21=repairFormalRuleSemanticContract({
  originalText:"Arrange English lessons across three grades",
  compiled:compiled21,
  formalRule:lkg21,
});
assert(repaired21.repaired,JSON.stringify(repaired21));
assert(repaired21.repairs.includes("grounding_subject_to_constraint_groups"),JSON.stringify(repaired21));
assert(
  repaired21.formalRule.expression.filters.some(
    f=>f.field==="constraintGroupId" && f.op==="in" && f.value.length===3
  ),
  JSON.stringify(repaired21)
);
assert(
  validateSemanticContract({
    originalText:"Arrange English lessons",
    compiled:compiled21,
    formalRule:repaired21.formalRule
  }).ok,
  "Repaired grounding should validate"
);

// Case 33 family: compiler says missing day + exists is available.
// Deterministic repair leaves day free.
const compiled33={
  formalizationStatus:"semantic_only",
  explanation:"required_slots needs day; בפועל ניתן לייצג עם exists",
  formalCoverage:{semanticOnly:"לא צוין יום"},
  capabilityPlan:{
    composition:"ניתן להשתמש ב-exists כדי להשאיר יום חופשי",
    unsupportedRequirements:["required_slots requires day; day unspecified"]
  },
  resolvedEntities:[
    {entityType:"teacher",id:"44",name:"T44"},
    {entityType:"class",id:"ג1",name:"ג1"},
  ]
};
const exists33=buildExistsRepairFromSemanticOnly({
  originalText:"יש לשבץ את המורה 44 בכיתה ג1 בשעה השישית",
  compiled:compiled33,
  severity:"known_constraint",
});
assert(exists33?.expression?.type==="exists",JSON.stringify(exists33));
assert(
  exists33.expression.filters.some(f=>f.field==="hour" && f.value===6),
  JSON.stringify(exists33)
);
assert(
  !exists33.expression.filters.some(f=>f.field==="day"),
  "Day must remain free"
);

// Case 39 family: required_slots alone is not enough for "only".
// Structural group identity allows deterministic exclusivity repair.
const compiled39={
  formalizationStatus:"formalized",
  resolvedEntities:[
    {entityType:"constraintGroup",id:"g39",name:"Target"}
  ]
};
const rule39={
  version:4,severity:"known_constraint",
  expression:{
    type:"required_slots",
    requirements:[
      {day:"ג",hour:6,className:null,teacherId:null,constraintGroupId:"g39"}
    ]
  }
};
const pre39=validateSemanticContract({
  originalText:"הקבוצה יכולה להתקיים רק ביום שלישי בשעה השישית",
  compiled:compiled39,
  formalRule:rule39,
});
assert(!pre39.ok,JSON.stringify(pre39));
const repaired39=repairFormalRuleSemanticContract({
  originalText:"הקבוצה יכולה להתקיים רק ביום שלישי בשעה השישית",
  compiled:compiled39,
  formalRule:rule39,
});
assert(repaired39.formalRule.expression.type==="and",JSON.stringify(repaired39));
assert(
  repaired39.formalRule.expression.children.some(c=>c.type==="every_placement"),
  JSON.stringify(repaired39)
);
assert(
  validateSemanticContract({
    originalText:"הקבוצה יכולה להתקיים רק ביום שלישי בשעה השישית",
    compiled:compiled39,
    formalRule:repaired39.formalRule,
  }).ok,
  "Exclusivity repair should validate"
);

console.log("PASS: stale LKG grounding is repaired to resolved constraint groups.");
console.log("PASS: semantic-only missing-day contradiction is repaired to exists.");
console.log("PASS: exclusive 'only' semantics becomes existence + every_placement.");
