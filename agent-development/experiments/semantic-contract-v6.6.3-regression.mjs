import {
  repairFormalRuleSemanticContract,
  validateSemanticContract,
  preserveSafePartialFormalRule,
} from '../../src/scheduling/semanticContractValidator.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// 1) Missing day must not be invented: required_slots(day=A) -> exists without day.
{
  const originalText = 'יש לשבץ את המורה רהט אלירז (מורה מספר 44) בכיתה ג1 בשעה השישית';
  const compiled = {
    resolvedEntities: [
      {entityType:'teacher', id:'44'},
      {entityType:'class', id:'ג1'},
    ],
  };
  const formalRule = {version:4,severity:'known_constraint',expression:{type:'required_slots',requirements:[{day:'א',hour:6,className:'ג1',teacherId:'44',constraintGroupId:null}]}};
  const repaired = repairFormalRuleSemanticContract({originalText, compiled, formalRule});
  assert(repaired.formalRule.expression.type === 'exists', 'invented day should become exists');
  assert(!(repaired.formalRule.expression.filters || []).some(f => f.field === 'day'), 'exists repair must leave day free');
  assert(repaired.repairs.includes('invented_day_to_exists'), 'repair marker missing');
  assert(validateSemanticContract({originalText, compiled, formalRule: repaired.formalRule}).ok, 'repaired temporal rule should pass');
}

// 2) Coverage first-slot selector belongs in the measured population, not in numerator match.
{
  const originalText = 'יש עדיפות שמחנך יתחיל את היום בכיתתו';
  const compiled = {resolvedEntities: []};
  const formalRule = {version:4,severity:'recommended',expression:{type:'coverage',source:'placements',filters:[{field:'isHomeroomTeacher',op:'eq',value:true}],exclude:[],groupBy:['teacherId','day'],match:{type:'and',children:[{type:'condition',field:'isTeacherFirstTeachingSlot',op:'eq',value:true},{type:'condition',field:'isHomeroomForClass',op:'eq',value:true}]},metric:'ratio',assert:{op:'eq',value:1}}};
  const repaired = repairFormalRuleSemanticContract({originalText, compiled, formalRule});
  const expr = repaired.formalRule.expression;
  assert(expr.filters.some(f => f.field === 'isTeacherFirstTeachingSlot' && f.value === true), 'first slot must move to filters');
  assert(expr.match?.field === 'isHomeroomForClass', 'remaining match should test homeroom class');
  assert(repaired.repairs.includes('coverage_match_scope_to_population_filter'), 'population repair marker missing');
}

// 3) Safe partial formalization must survive a new clarification request about only the ambiguous remainder.
{
  const originalText = 'יש לנסות לשבץ את מורה 25 בכיתה ב3 בשעה 7 שעתיים בשבוע. בשאר הימים יש לנסות לשבץ את המורים 2,4,30';
  const previousRule = {
    status:'partially_formalized',
    formalRule:{version:4,severity:'recommended',expression:{type:'aggregate',source:'placements',filters:[{field:'teacherId',op:'eq',value:'25'},{field:'className',op:'eq',value:'ב3'},{field:'hour',op:'eq',value:7}],exclude:[],groupBy:['teacherId'],metric:{type:'count_distinct',field:'day'},assert:{op:'eq',value:2}}}
  };
  const compiled = {
    formalizationStatus:'needs_clarification',
    resolvedEntities:[{entityType:'teacher',id:'25'},{entityType:'class',id:'ב3'}],
    capabilityPlan:{selectedCapabilities:['placements','aggregate','metrics.count_distinct'],requirements:['שני ימים בשבוע','בשאר הימים עמום'],unsupportedRequirements:['החלק בשאר הימים עמום'],composition:'החלק הראשון מדיד באמצעות aggregate'},
    formalCoverage:{semanticOnly:'החלק השני דורש הבהרה'},
    explanation:'החלק הראשון ניתן למדידה, החלק השני דורש הבהרה',
  };
  const kept = preserveSafePartialFormalRule({originalText, compiled, previousRule, severity:'recommended'});
  assert(kept?.formalRule?.expression?.type === 'aggregate', 'safe partial formal rule should be preserved');
  assert(kept.repairs.includes('preserved_safe_partial_formalization'), 'partial preservation marker missing');
}

console.log('v6.6.3 semantic-contract regression: PASS');
