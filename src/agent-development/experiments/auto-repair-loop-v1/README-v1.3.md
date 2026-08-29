# Auto-Repair Loop v1.3

Changes after the first successful async run:

1. Known schedule schema is supplied explicitly to both model attempts:
   `schedule[day][className][hour] = [unitId, ...]` and
   `schoolData.teachingUnits` is the teaching-unit lookup source.
   This prevents exploratory Python runs over irrelevant alternative schemas.

2. Attempt 1 generated-file collection is resilient:
   - first use message file annotations;
   - if absent, use the Code Interpreter container ID and list container files;
   - find `repaired-candidate.json` by name and retrieve its contents directly.

3. Attempt 1 diagnostics are preserved even on file-collection failure:
   codeRuns, parsed structured output, container ID, annotations and output item
   types are returned to the UI instead of being discarded.

4. The UI always renders Attempt 1 and its Python runs when collection returns a
   diagnostic failure.

The async background/polling architecture from v1.2 remains unchanged.
