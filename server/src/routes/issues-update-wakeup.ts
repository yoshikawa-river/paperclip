type IssueStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "done"
  | "blocked"
  | "cancelled";

type IssueUpdateWakeInput = {
  actorType: "board" | "agent" | "none";
  actorAgentId: string | null;
  issueAssigneeId: string | null;
  existingStatus: IssueStatus;
  nextStatus: IssueStatus;
  hasComment: boolean;
};

const CLOSED_STATUSES = new Set<IssueStatus>(["done", "cancelled"]);

export function shouldWakeAssigneeOnIssueUpdate(input: IssueUpdateWakeInput): boolean {
  if (!input.issueAssigneeId) return false;

  const selfUpdate = input.actorType === "agent" && input.actorAgentId === input.issueAssigneeId;
  if (selfUpdate) return false;

  if (input.hasComment) {
    return input.nextStatus !== "backlog" && !CLOSED_STATUSES.has(input.nextStatus);
  }

  const reopenedForWork =
    input.existingStatus !== input.nextStatus &&
    input.nextStatus !== "backlog" &&
    !CLOSED_STATUSES.has(input.nextStatus) &&
    (input.existingStatus === "backlog" ||
      input.existingStatus === "blocked" ||
      CLOSED_STATUSES.has(input.existingStatus));

  return reopenedForWork;
}
