# Rule Compiler v2.2 — Async timeout fix

## Problem
The synchronous `rule-compiler` Netlify function waited for the entire OpenAI Responses
request. With eight rules, local `netlify dev` repeatedly terminated the function at
30 seconds with `TimeoutError`.

## Architecture change
Rule compilation now uses two short Netlify functions:

1. `rule-compiler-async-start`
   - validates rules/schoolData;
   - starts an OpenAI Responses request with `background: true`;
   - immediately returns `responseId`.

2. `rule-compiler-async-collect`
   - retrieves that response by ID;
   - if still running, returns `{completed:false}` quickly;
   - once completed, parses the structured output, validates every `formalRuleJson`,
     and returns the compiled rules + token telemetry.

The browser polls collect every 3 seconds, for up to 3 minutes.

## Important
This is not repeated LLM execution. There is one OpenAI compilation request.
The repeated HTTP requests visible in the terminal are lightweight status polls only.

## Preserved functionality
- Rule Compiler v2 compound clauses
- deterministic Evaluators
- semantic grounding / homeroom mapping
- canonical day normalization
- stable human rule numbers
- user category override
- strengthened category inference
- import-file-into-current-project feature

## Expected test
Compile the existing 8 rules.
The UI should show:
`⏳ ממתין לתוצאת Rule Compiler... N`
and then the normal compilation result instead of a Netlify 30-second timeout.
