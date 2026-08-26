#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSchedule } from "../src/scheduling/scheduleValidator.js";
import { evaluateFormalRules } from "../src/scheduling/ruleEvaluator.js";

function usage() {
  console.error(
    "Usage: npm run validate:schedule -- <project.json> [report.json]",
  );
  process.exit(2);
}

const [, , inputArg, outputArg] = process.argv;
if (!inputArg) usage();

const inputPath = path.resolve(process.cwd(), inputArg);
const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));

const schoolData = raw.schoolData;
const schedule = raw.schedule;
const approvedExceptions =
  raw.schedulingAgentApprovedExceptions ||
  raw.approvedExceptions ||
  [];
const rules =
  raw.schedulingAgentRules ||
  raw.rules ||
  [];

if (!schoolData || !schedule) {
  throw new Error(
    "Input JSON must contain both schoolData and schedule.",
  );
}

const core = validateSchedule({
  schedule,
  schoolData,
  approvedExceptions,
});

const formalRules = evaluateFormalRules({
  rules,
  schedule,
  schoolData,
});

const report = {
  inputFile: inputPath,
  generatedAt: new Date().toISOString(),
  core,
  formalRules,
  summary: {
    coreValid: core.valid,
    coreErrors: core.errors?.length || 0,
    coreWarnings: core.warnings?.length || 0,
    formalRulesEvaluated: formalRules.length,
    formalRulesSupported: formalRules.filter((r) => r.supported).length,
    formalRuleViolations: formalRules.filter(
      (r) => r.supported && r.valid === false,
    ).length,
  },
};

const json = JSON.stringify(report, null, 2);

if (outputArg) {
  const outputPath = path.resolve(process.cwd(), outputArg);
  fs.writeFileSync(outputPath, json, "utf8");
  console.log(`Validation report written to ${outputPath}`);
} else {
  console.log(json);
}

if (!core.valid) {
  process.exitCode = 1;
}
