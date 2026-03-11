type IssueStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "done"
  | "blocked"
  | "cancelled";

type ChildIssueUpdateWakeInput = {
  actorType: "board" | "agent" | "none";
  actorAgentId: string | null;
  childAssigneeId: string | null;
  existingStatus: IssueStatus;
  nextStatus: IssueStatus;
};

type ChildIssueCommentWakeInput = {
  actorType: "board" | "agent" | "none";
  actorAgentId: string | null;
  childAssigneeId: string | null;
  reopened: boolean;
};

export function shouldWakeParentOnChildIssueUpdate(input: ChildIssueUpdateWakeInput): boolean {
  if (input.actorType !== "agent") return false;
  if (!input.actorAgentId || !input.childAssigneeId) return false;
  if (input.actorAgentId !== input.childAssigneeId) return false;
  return input.existingStatus !== input.nextStatus;
}

export function shouldWakeParentOnChildIssueComment(input: ChildIssueCommentWakeInput): boolean {
  if (!input.reopened) return false;
  if (input.actorType !== "agent") return false;
  if (!input.actorAgentId || !input.childAssigneeId) return false;
  return input.actorAgentId === input.childAssigneeId;
}
