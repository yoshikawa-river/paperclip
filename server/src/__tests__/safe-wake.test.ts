import { beforeEach, describe, expect, it, vi } from "vitest";
import { safeWakeAgentForIssue } from "../services/safe-wake.js";

const mockHeartbeat = vi.hoisted(() => ({
  wakeup: vi.fn(),
  resetRuntimeSession: vi.fn(),
  invoke: vi.fn(),
}));

const mockIssues = vi.hoisted(() => ({
  getById: vi.fn(),
  update: vi.fn(),
  repairExecutionState: vi.fn(),
}));

vi.mock("../services/heartbeat.js", () => ({
  heartbeatService: () => mockHeartbeat,
}));

vi.mock("../services/issues.js", () => ({
  issueService: () => mockIssues,
}));

describe("safeWakeAgentForIssue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIssues.repairExecutionState.mockResolvedValue({ repaired: true, reason: "execution_missing" });
    mockIssues.getById.mockResolvedValue({ id: "issue-1", processStateJson: {} });
    mockIssues.update.mockResolvedValue({});
    mockHeartbeat.resetRuntimeSession.mockResolvedValue({});
    mockHeartbeat.invoke.mockResolvedValue({ id: "run-fallback" });
  });

  it("returns wakeup run when first wake succeeds", async () => {
    mockHeartbeat.wakeup.mockResolvedValue({ id: "run-1" });
    const run = await safeWakeAgentForIssue({} as any, "agent-1", {
      source: "automation",
      triggerDetail: "system",
      reason: "issue_commented",
      payload: { issueId: "issue-1" },
      contextSnapshot: { issueId: "issue-1" },
    });
    expect(run).toEqual({ id: "run-1" });
    expect(mockIssues.repairExecutionState).not.toHaveBeenCalled();
    expect(mockHeartbeat.resetRuntimeSession).not.toHaveBeenCalled();
  });

  it("repairs state, resets session, then retries wakeup", async () => {
    mockHeartbeat.wakeup
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce({ id: "run-2" });
    const run = await safeWakeAgentForIssue({} as any, "agent-1", {
      source: "automation",
      triggerDetail: "system",
      reason: "issue_commented",
      payload: { issueId: "issue-1" },
      contextSnapshot: { issueId: "issue-1" },
    });
    expect(run).toEqual({ id: "run-2" });
    expect(mockIssues.repairExecutionState).toHaveBeenCalledWith("issue-1");
    expect(mockHeartbeat.resetRuntimeSession).toHaveBeenCalledWith("agent-1", { taskKey: "issue-1" });
  });

  it("stops when remediation attempts are exhausted", async () => {
    mockIssues.getById.mockResolvedValue({
      id: "issue-1",
      processStateJson: {
        remediation: {
          wakeRepair: {
            "agent-1": {
              attempts: 2,
            },
          },
        },
      },
    });
    mockHeartbeat.wakeup.mockRejectedValue(new Error("temporary failure"));
    await expect(
      safeWakeAgentForIssue({} as any, "agent-1", {
        source: "automation",
        triggerDetail: "system",
        reason: "issue_commented",
        payload: { issueId: "issue-1" },
        contextSnapshot: { issueId: "issue-1" },
      }),
    ).rejects.toThrow("temporary failure");
    expect(mockIssues.repairExecutionState).not.toHaveBeenCalled();
    expect(mockHeartbeat.resetRuntimeSession).not.toHaveBeenCalled();
  });

  it("fails fast on schema mismatch without remediation loop", async () => {
    mockHeartbeat.wakeup.mockRejectedValue(new Error("column \"execution_workspace_settings\" does not exist"));
    await expect(
      safeWakeAgentForIssue({} as any, "agent-1", {
        source: "automation",
        triggerDetail: "system",
        reason: "issue_commented",
        payload: { issueId: "issue-1" },
        contextSnapshot: { issueId: "issue-1" },
      }),
    ).rejects.toThrow("does not exist");
    expect(mockIssues.repairExecutionState).not.toHaveBeenCalled();
    expect(mockHeartbeat.resetRuntimeSession).not.toHaveBeenCalled();
  });
});
