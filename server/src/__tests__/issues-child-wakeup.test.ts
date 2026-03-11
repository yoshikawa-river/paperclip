import { describe, expect, it } from "vitest";
import {
  shouldWakeParentOnChildIssueComment,
  shouldWakeParentOnChildIssueUpdate,
} from "../routes/issues-child-wakeup.js";

describe("shouldWakeParentOnChildIssueUpdate", () => {
  it("wakes the parent when the assigned child agent changes status", () => {
    expect(
      shouldWakeParentOnChildIssueUpdate({
        actorType: "agent",
        actorAgentId: "child-agent",
        childAssigneeId: "child-agent",
        existingStatus: "in_progress",
        nextStatus: "done",
      }),
    ).toBe(true);
  });

  it("does not wake the parent for comment-only child updates", () => {
    expect(
      shouldWakeParentOnChildIssueUpdate({
        actorType: "agent",
        actorAgentId: "child-agent",
        childAssigneeId: "child-agent",
        existingStatus: "done",
        nextStatus: "done",
      }),
    ).toBe(false);
  });

  it("does not wake the parent for non-assignee actors", () => {
    expect(
      shouldWakeParentOnChildIssueUpdate({
        actorType: "board",
        actorAgentId: null,
        childAssigneeId: "child-agent",
        existingStatus: "todo",
        nextStatus: "in_progress",
      }),
    ).toBe(false);
  });
});

describe("shouldWakeParentOnChildIssueComment", () => {
  it("wakes the parent when the child is reopened via comment", () => {
    expect(
      shouldWakeParentOnChildIssueComment({
        actorType: "agent",
        actorAgentId: "child-agent",
        childAssigneeId: "child-agent",
        reopened: true,
      }),
    ).toBe(true);
  });

  it("does not wake the parent for routine child comments", () => {
    expect(
      shouldWakeParentOnChildIssueComment({
        actorType: "agent",
        actorAgentId: "child-agent",
        childAssigneeId: "child-agent",
        reopened: false,
      }),
    ).toBe(false);
  });
});
