import { describe, expect, it } from "vitest";
import { resolveDefaultAgentWorkspaceDir } from "../home-paths.js";
import {
  decideIssueAutoRequeue,
  pickTimerIssueIdForAgentOpenIssues,
  resolveRuntimeSessionParamsForWorkspace,
  shouldAlwaysResetTaskSessionForAgent,
  shouldResetTaskSessionForWake,
  shouldResetTaskSessionForRecentRunStatuses,
  taskSessionTimeoutResetThreshold,
  type ResolvedWorkspaceForRun,
} from "../services/heartbeat.ts";

function buildResolvedWorkspace(overrides: Partial<ResolvedWorkspaceForRun> = {}): ResolvedWorkspaceForRun {
  return {
    cwd: "/tmp/project",
    source: "project_primary",
    projectId: "project-1",
    workspaceId: "workspace-1",
    repoUrl: null,
    repoRef: null,
    workspaceHints: [],
    warnings: [],
    ...overrides,
  };
}

describe("resolveRuntimeSessionParamsForWorkspace", () => {
  it("migrates fallback workspace sessions to project workspace when project cwd becomes available", () => {
    const agentId = "agent-123";
    const fallbackCwd = resolveDefaultAgentWorkspaceDir(agentId);

    const result = resolveRuntimeSessionParamsForWorkspace({
      agentId,
      previousSessionParams: {
        sessionId: "session-1",
        cwd: fallbackCwd,
        workspaceId: "workspace-1",
      },
      resolvedWorkspace: buildResolvedWorkspace({ cwd: "/tmp/new-project-cwd" }),
    });

    expect(result.sessionParams).toMatchObject({
      sessionId: "session-1",
      cwd: "/tmp/new-project-cwd",
      workspaceId: "workspace-1",
    });
    expect(result.warning).toContain("Attempting to resume session");
  });

  it("does not migrate when previous session cwd is not the fallback workspace", () => {
    const result = resolveRuntimeSessionParamsForWorkspace({
      agentId: "agent-123",
      previousSessionParams: {
        sessionId: "session-1",
        cwd: "/tmp/some-other-cwd",
        workspaceId: "workspace-1",
      },
      resolvedWorkspace: buildResolvedWorkspace({ cwd: "/tmp/new-project-cwd" }),
    });

    expect(result.sessionParams).toEqual({
      sessionId: "session-1",
      cwd: "/tmp/some-other-cwd",
      workspaceId: "workspace-1",
    });
    expect(result.warning).toBeNull();
  });

  it("does not migrate when resolved workspace id differs from previous session workspace id", () => {
    const agentId = "agent-123";
    const fallbackCwd = resolveDefaultAgentWorkspaceDir(agentId);

    const result = resolveRuntimeSessionParamsForWorkspace({
      agentId,
      previousSessionParams: {
        sessionId: "session-1",
        cwd: fallbackCwd,
        workspaceId: "workspace-1",
      },
      resolvedWorkspace: buildResolvedWorkspace({
        cwd: "/tmp/new-project-cwd",
        workspaceId: "workspace-2",
      }),
    });

    expect(result.sessionParams).toEqual({
      sessionId: "session-1",
      cwd: fallbackCwd,
      workspaceId: "workspace-1",
    });
    expect(result.warning).toBeNull();
  });
});

describe("shouldResetTaskSessionForWake", () => {
  it("resets session context on assignment wake", () => {
    expect(shouldResetTaskSessionForWake({ wakeReason: "issue_assigned" })).toBe(true);
  });

  it("resets session context on checkout wake", () => {
    expect(shouldResetTaskSessionForWake({ wakeReason: "issue_checked_out" })).toBe(true);
  });

  it("resets session context on timer heartbeats", () => {
    expect(shouldResetTaskSessionForWake({ wakeSource: "timer" })).toBe(true);
  });

  it("resets session context on manual on-demand invokes", () => {
    expect(
      shouldResetTaskSessionForWake({
        wakeSource: "on_demand",
        wakeTriggerDetail: "manual",
      }),
    ).toBe(true);
  });

  it("does not reset session context on mention wake comment", () => {
    expect(
      shouldResetTaskSessionForWake({
        wakeReason: "issue_comment_mentioned",
        wakeCommentId: "comment-1",
      }),
    ).toBe(false);
  });

  it("does not reset session context when commentId is present", () => {
    expect(
      shouldResetTaskSessionForWake({
        wakeReason: "issue_commented",
        commentId: "comment-2",
      }),
    ).toBe(false);
  });

  it("does not reset for comment wakes", () => {
    expect(shouldResetTaskSessionForWake({ wakeReason: "issue_commented" })).toBe(false);
  });

  it("does not reset when wake reason is missing", () => {
    expect(shouldResetTaskSessionForWake({})).toBe(false);
  });

  it("does not reset session context on callback on-demand invokes", () => {
    expect(
      shouldResetTaskSessionForWake({
        wakeSource: "on_demand",
        wakeTriggerDetail: "callback",
      }),
    ).toBe(false);
  });
});

describe("task session timeout reset policy", () => {
  it("always resets session context for manager-style heartbeat agents", () => {
    expect(shouldAlwaysResetTaskSessionForAgent({ role: "pm", name: "Chief of Staff" })).toBe(true);
    expect(shouldAlwaysResetTaskSessionForAgent({ role: "ceo", name: "CEO / Board" })).toBe(true);
    expect(shouldAlwaysResetTaskSessionForAgent({ role: "worker", name: "Strategy Lead" })).toBe(false);
  });

  it("uses a lower timeout threshold for manager-style agents", () => {
    expect(taskSessionTimeoutResetThreshold({ role: "manager", name: "Chief of Staff" })).toBe(1);
    expect(taskSessionTimeoutResetThreshold({ role: "worker", name: "Builder" })).toBe(2);
  });

  it("resets after one timeout for manager-style agents", () => {
    expect(shouldResetTaskSessionForRecentRunStatuses(["timed_out"], 1)).toBe(true);
  });

  it("requires two consecutive timeouts for non-manager agents", () => {
    expect(shouldResetTaskSessionForRecentRunStatuses(["timed_out"], 2)).toBe(false);
    expect(shouldResetTaskSessionForRecentRunStatuses(["timed_out", "timed_out"], 2)).toBe(true);
    expect(shouldResetTaskSessionForRecentRunStatuses(["timed_out", "failed"], 2)).toBe(false);
  });
});

describe("issue auto requeue policy", () => {
  it("auto requeues process_lost for still-open assigned issues", () => {
    expect(
      decideIssueAutoRequeue({
        outcome: "failed",
        runErrorCode: "process_lost",
        retryCount: 0,
        issueStatus: "in_progress",
        issueAssigneeId: "agent-1",
        agentId: "agent-1",
        materialActionCount: 0,
      }),
    ).toBe("process_lost");
  });

  it("auto requeues no-op succeeded runs when the issue did not move", () => {
    expect(
      decideIssueAutoRequeue({
        outcome: "succeeded",
        runErrorCode: null,
        retryCount: 0,
        issueStatus: "todo",
        issueAssigneeId: "agent-1",
        agentId: "agent-1",
        materialActionCount: 0,
      }),
    ).toBe("no_op_success");
  });

  it("does not auto requeue succeeded runs that produced material actions", () => {
    expect(
      decideIssueAutoRequeue({
        outcome: "succeeded",
        runErrorCode: null,
        retryCount: 0,
        issueStatus: "todo",
        issueAssigneeId: "agent-1",
        agentId: "agent-1",
        materialActionCount: 1,
      }),
    ).toBeNull();
  });

  it("does not auto requeue when retry budget is exhausted or issue is closed", () => {
    expect(
      decideIssueAutoRequeue({
        outcome: "failed",
        runErrorCode: "process_lost",
        retryCount: 2,
        issueStatus: "in_progress",
        issueAssigneeId: "agent-1",
        agentId: "agent-1",
        materialActionCount: 0,
      }),
    ).toBeNull();
    expect(
      decideIssueAutoRequeue({
        outcome: "failed",
        runErrorCode: "process_lost",
        retryCount: 0,
        issueStatus: "done",
        issueAssigneeId: "agent-1",
        agentId: "agent-1",
        materialActionCount: 0,
      }),
    ).toBeNull();
  });
});

describe("timer issue selection", () => {
  it("prefers the root issue for the freshest open chain", () => {
    expect(
      pickTimerIssueIdForAgentOpenIssues([
        {
          id: "parent-1",
          parentId: null,
          priority: "medium",
          updatedAt: new Date("2026-03-11T13:51:43Z"),
        },
        {
          id: "child-1",
          parentId: "parent-1",
          priority: "high",
          updatedAt: new Date("2026-03-11T13:59:05Z"),
        },
      ]),
    ).toBe("parent-1");
  });

  it("prefers higher-priority unrelated roots", () => {
    expect(
      pickTimerIssueIdForAgentOpenIssues([
        {
          id: "root-medium",
          parentId: null,
          priority: "medium",
          updatedAt: new Date("2026-03-11T13:59:05Z"),
        },
        {
          id: "root-high",
          parentId: null,
          priority: "high",
          updatedAt: new Date("2026-03-11T13:40:00Z"),
        },
      ]),
    ).toBe("root-high");
  });
});
