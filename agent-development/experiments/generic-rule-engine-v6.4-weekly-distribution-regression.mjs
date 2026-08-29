import { evaluateGenericRuleExpression } from '../../src/scheduling/genericRuleEngine.js';
function assert(c,m){if(!c)throw new Error(m)}
const schoolData={
 teachers:[{id:'1',name:'T'}], classes:['ד1','ה1','ו1'],
 constraintGroups:[
  {id:'eng-d',name:'אנגלית ד'},{id:'eng-h',name:'אנגלית ה'},{id:'eng-v',name:'אנגלית ו'}
 ],
 teachingUnits:[
  {id:'d',teacherId:'1',className:'ד1',constraintGroupId:'eng-d',subject:'אנגלית'},
  {id:'h',teacherId:'1',className:'ה1',constraintGroupId:'eng-h',subject:'אנגלית'},
  {id:'v',teacherId:'1',className:'ו1',constraintGroupId:'eng-v',subject:'אנגלית'}
 ]
};
// Each group: Sunday 2 consecutive, Monday 1, Tuesday 1.
const schedule={
 א:{ד1:{2:['d'],3:['d']},ה1:{2:['h'],3:['h']},ו1:{2:['v'],3:['v']}},
 ב:{ד1:{4:['d']},ה1:{4:['h']},ו1:{4:['v']}},
 ג:{ד1:{5:['d']},ה1:{5:['h']},ו1:{5:['v']}}
};
const expression={
 type:'aggregate_pipeline', source:'placements',
 filters:[
  {field:'constraintGroupId',op:'in',value:['eng-d','eng-h','eng-v']},
  {field:'isInstructionalPlacement',op:'eq',value:true}
 ], exclude:[],
 stages:[
  {groupBy:['constraintGroupId','day'],metrics:[
   {as:'hourCount',type:'count_distinct',field:'hour'},
   {as:'maxRun',type:'max_consecutive_hours',field:'hour'}
  ]},
  {groupBy:['constraintGroupId'],metrics:[
   {as:'daysWith2',type:'count_where',field:'hourCount',where:{field:'hourCount',op:'eq',value:2}},
   {as:'daysWith1',type:'count_where',field:'hourCount',where:{field:'hourCount',op:'eq',value:1}},
   {as:'daysRun2',type:'count_where',field:'maxRun',where:{field:'maxRun',op:'eq',value:2}},
   {as:'totalDays',type:'count'}
  ]}
 ],
 assertions:[
  {field:'daysWith2',op:'eq',value:1},{field:'daysWith1',op:'eq',value:2},
  {field:'daysRun2',op:'eq',value:1},{field:'totalDays',op:'eq',value:3}
 ]
};
const r=evaluateGenericRuleExpression({rule:{id:'weekly'},expression,schedule,schoolData});
assert(r.supported && r.valid,JSON.stringify(r));
console.log('PASS: existing aggregate_pipeline expresses weekly 2+1+1 distribution with consecutive double.');
