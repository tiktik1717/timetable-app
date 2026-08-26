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