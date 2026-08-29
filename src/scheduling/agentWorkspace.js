import { simulateScheduleMove } from "./scheduleSimulation";

export function createAgentWorkspace(schedule) {
    if (!schedule) {
        throw new Error(
            "Cannot create agent workspace without schedule"
        );
    }

    return {
        originalSchedule: structuredClone(schedule),
        workingSchedule: structuredClone(schedule),
        attempts: [],
    };
}

export function tryWorkspaceMove({
    workspace,
    action,
}) {
    if (!workspace?.workingSchedule) {
        return {
            success: false,
            error: "Agent workspace is not initialized",
            workspace,
        };
    }

    const simulation = simulateScheduleMove({
        schedule: workspace.workingSchedule,
        action,
    });

    const attempt = {
        id: `attempt-${Date.now()}-${workspace.attempts.length + 1}`,
        action: structuredClone(action),
        success: simulation.success,
        error: simulation.error || null,
    };

    if (!simulation.success) {
        return {
            success: false,
            error: simulation.error,
            workspace: {
                ...workspace,
                attempts: [
                    ...workspace.attempts,
                    attempt,
                ],
            },
        };
    }

    return {
        success: true,
        error: null,

        workspace: {
            ...workspace,

            workingSchedule:
                simulation.candidateSchedule,

            attempts: [
                ...workspace.attempts,
                attempt,
            ],
        },
    };
}

export function resetAgentWorkspace(workspace) {
    if (!workspace?.originalSchedule) {
        return null;
    }

    return {
        originalSchedule: structuredClone(
            workspace.originalSchedule
        ),

        workingSchedule: structuredClone(
            workspace.originalSchedule
        ),

        attempts: [],
    };
}

export function createEmptyScheduleFromTemplate(schedule) {
    const emptySchedule = {};

    for (const [day, daySchedule] of Object.entries(schedule || {})) {
        emptySchedule[day] = {};
        for (const [className, classSchedule] of Object.entries(daySchedule || {})) {
            emptySchedule[day][className] = {};
            for (const hour of Object.keys(classSchedule || {})) {
                emptySchedule[day][className][hour] = null;
            }
        }
    }

    return emptySchedule;
}

export function createGenerationWorkspace(schedule) {
    if (!schedule) {
        throw new Error("Cannot create generation workspace without schedule template");
    }

    const emptySchedule = createEmptyScheduleFromTemplate(schedule);

    return {
        mode: "generation",
        createdAt: new Date().toISOString(),
        originalSchedule: structuredClone(schedule),
        baselineSchedule: structuredClone(schedule),
        workingSchedule: emptySchedule,
        attempts: [],
        candidateHistory: [],
        trace: [],
    };
}
