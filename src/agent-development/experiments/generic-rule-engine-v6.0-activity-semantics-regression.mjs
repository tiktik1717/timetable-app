import { evaluateGenericRuleExpression } from "../../src/scheduling/genericRuleEngine.js";
function assert(c,m){ if(!c) throw new Error(m); }
const schoolData={teachers:[{id:"1",name:"Homeroom",educationClass:"א1"}],classes:["א1","צוות"],constraintGroups:[{id:"m1",name:"צוות",groupKind:"meeting"}],teachingUnits:[{id:"meet",teacherId:"1",className:"צוות",subject:"ישיבה",constraintGroupId:"m1",type:"teamMeeting"},{id:"lesson",teacherId:"1",className:"א1",subject:"מתמטיקה"}]};
const schedule={א:{צוות:{1:["meet"]},א1:{2:["lesson"]}}};
const rule={type:"every_placement",source:"placements",filters:[{field:"isHomeroomTeacher",op:"eq",value:true},{field:"isTeacherFirstTeachingSlot",op:"eq",value:true}],exclude:[],assertions:[{field:"isHomeroomForClass",op:"eq",value:true}],predicate:null};
const r=evaluateGenericRuleExpression({rule:{id:"homeroom"},expression:rule,schedule,schoolData}); assert(r.supported&&r.valid,JSON.stringify(r));
const ar={type:"every_placement",source:"placements",filters:[{field:"teacherId",op:"eq",value:"1"},{field:"isTeacherActivityFirstSlot",op:"eq",value:true}],exclude:[],assertions:[{field:"activityKind",op:"eq",value:"meeting"}],predicate:null};
const a=evaluateGenericRuleExpression({rule:{id:"activity"},expression:ar,schedule,schoolData}); assert(a.supported&&a.valid,JSON.stringify(a));
const mr={type:"every_placement",source:"placements",filters:[{field:"activityKind",op:"eq",value:"meeting"}],exclude:[],assertions:[{field:"isInstructionalPlacement",op:"eq",value:false}],predicate:null};
const m=evaluateGenericRuleExpression({rule:{id:"meeting-kind"},expression:mr,schedule,schoolData}); assert(m.supported&&m.valid,JSON.stringify(m));
console.log("PASS: meeting is activity but not teaching."); console.log("PASS: first teaching slot skips earlier meeting."); console.log("PASS: first activity slot still sees meeting.");
