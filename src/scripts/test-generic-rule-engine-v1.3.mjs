import { evaluateGenericRuleExpression } from '../src/scheduling/genericRuleEngine.js';

const schoolData = {
  classes:['ד1','ד2','ה1','ה2'],
  teachers:[
    {id:'1',educationClass:'ד1'},{id:'2',educationClass:'ד2'},
    {id:'3',educationClass:'ה1'},{id:'4',educationClass:'ה2'}
  ],
  teachingUnits:[]
};
const schedule={};
for (const day of ['ג','ד','ה']) {
  schedule[day]={};
  const end=day==='ה'?5:6;
  for (const cls of schoolData.classes) {
    schedule[day][cls]={};
    for(let h=1;h<=end;h++) schedule[day][cls][String(h)]=[];
  }
}
// Empty cells do not create placements, so use synthetic unit IDs to establish class end hours.
let n=0;
for (const [day,classes] of Object.entries(schedule)) for (const [cls,hours] of Object.entries(classes)) {
  for (const h of Object.keys(hours)) {
    const id=`u${++n}`; hours[h]=[id];
    schoolData.teachingUnits.push({id,className:cls,teacherId:'1'});
  }
}
const rule9={type:'aggregate_pipeline',source:'grade_days',filters:[
  {field:'grade',op:'in',value:['ד','ה']},{field:'day',op:'in',value:['ג','ד','ה']}
],exclude:[],stages:[
  {groupBy:['day'],metrics:[{as:'commonEndHour',type:'common_value',field:'endHour'}]},
  {groupBy:[],metrics:[
    {as:'daysAt6',type:'count_where',field:'commonEndHour',where:{field:'commonEndHour',op:'eq',value:6}},
    {as:'daysAt5',type:'count_where',field:'commonEndHour',where:{field:'commonEndHour',op:'eq',value:5}}
  ]}
],assertions:[{field:'daysAt6',op:'eq',value:2},{field:'daysAt5',op:'eq',value:1}]};
const r=evaluateGenericRuleExpression({rule:{id:'9'},expression:rule9,schedule,schoolData});
if(!r.supported || !r.valid) throw new Error('Rule 9 nested aggregate regression failed: '+JSON.stringify(r));
console.log('PASS generic v1.3 aggregate_pipeline / rule 9 shape');
