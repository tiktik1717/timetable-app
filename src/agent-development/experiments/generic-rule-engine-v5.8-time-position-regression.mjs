import { evaluateGenericRuleExpression } from "../../src/scheduling/genericRuleEngine.js";
function assert(c,m){if(!c)throw new Error(m)}
const schoolData={teachers:[{id:"1",name:"Homeroom",educationClass:"א1"},{id:"2",name:"Other"}],classes:["א1","א2"],teachingUnits:[{id:"h1",teacherId:"1",className:"א1",subject:"Math"},{id:"h2",teacherId:"1",className:"א2",subject:"Science"},{id:"h3",teacherId:"1",className:"א1",subject:"English"}]};
const schedule={א:{א1:{3:["h1"],6:["h3"]},א2:{5:["h2"]}}};
const run=(id,filters,assertion)=>evaluateGenericRuleExpression({rule:{id},expression:{type:"every_placement",filters,assert:assertion},schedule,schoolData});
let r=run("first",[{field:"teacherId",op:"eq",value:"1"},{field:"isTeacherFirstTeachingSlot",op:"eq",value:true}],{field:"isHomeroomForClass",op:"eq",value:true}); assert(r.supported&&r.valid,JSON.stringify(r));
r=run("second",[{field:"teacherId",op:"eq",value:"1"},{field:"teacherTeachingSlotIndex",op:"eq",value:2}],{field:"subject",op:"eq",value:"Science"}); assert(r.supported&&r.valid,JSON.stringify(r));
r=run("last",[{field:"teacherId",op:"eq",value:"1"},{field:"isTeacherLastTeachingSlot",op:"eq",value:true}],{field:"hour",op:"eq",value:6}); assert(r.supported&&r.valid,JSON.stringify(r));
console.log("PASS: generic first/nth/last teacher time positions.");
