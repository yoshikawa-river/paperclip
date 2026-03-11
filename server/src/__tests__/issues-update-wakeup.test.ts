import { describe, expect, it } from "vitest";
import { shouldWakeAssigneeOnIssueUpdate } from "../routes/issues-update-wakeup.js";

describe("shouldWakeAssigneeOnIssueUpdate", () => {
  it("wakes the assignee when another actor comments on an assigned open issue", () => {
    expect(
      shouldWakeAssigneeOnIssueUpdate({
        actorType: "board",
        actorAgentId: null,
        issueAssigneeId: "agent-1",
        existingStatus: "blocked",
        nextStatus: "todo",
        hasComment: true,
      }),
    ).toBe(true);
  });

  it("wakes the assignee when another actor reopens a blocked issue without a comment", () => {
    expect(
      shouldWakeAssigneeOnIssueUpdate({
        actorType: "board",
        actorAgentId: null,
        issueAssigneeId: "agent-1",
        existingStatus: "blocked",
        nextStatus: "todo",
        hasComment: false,
      }),
    ).toBe(true);
  });

  it("does not wake on self-updates from the assignee agent", () => {
    expect(
      shouldWakeAssigneeOnIssueUpdate({
        actorType: "agent",
        actorAgentId: "agent-1",
        issueAssigneeId: "agent-1",
        existingStatus: "in_progress",
        nextStatus: "done",
        hasComment: true,
      }),
    ).toBe(false);
  });

  it("does not wake when the updated issue remains closed", () => {
    expect(
      shouldWakeAssigneeOnIssueUpdate({
        actorType: "board",
        actorAgentId: null,
        issueAssigneeId: "agent-1",
        existingStatus: "done",
        nextStatus: "done",
        hasComment: true,
      }),
    ).toBe(false);
  });
});
