import type { Db } from "@paperclipai/db";
import { logger } from "../middleware/logger.js";
import { heartbeatService } from "./heartbeat.js";
import { issueService } from "./issues.js";

const MAX_REMEDIATION_ATTEMPTS = 2;
const HISTORY_LIMIT = 20;

type HeartbeatSvc = ReturnType<typeof heartbeatService>;
type IssueSvc = ReturnType<typeof issueService>;
type WakeupInput = NonNullable<Parameters<HeartbeatSvc["wakeup"]>[1]>;

function parseObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function parseNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function classifyWakeFailure(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("column") && message.includes("does not exist")) return "schema_mismatch";
  if (message.includes("not invokable")) return "agent_not_invokable";
  return "runtime_error";
}

function extractIssueId(wakeup: WakeupInput, explicitIssueId?: string | null): string | null {
  if (explicitIssueId) return explicitIssueId;
  const payload = parseObject(wakeup.payload);
  const context = parseObject(wakeup.contextSnapshot);
  return parseString(payload.issueId) ?? parseString(context.issueId) ?? null;
}

async function recordRemediation(
  issues: IssueSvc,
  issueId: string,
  agentId: string,
  patch: {
    outcome: string;
    action: string;
    error?: string | null;
  },
) {
  const issue = await issues.getById(issueId);
  if (!issue) return;

  const processState = parseObject(issue.processStateJson);
  const remediation = parseObject(processState.remediation);
  const wakeRepair = parseObject(remediation.wakeRepair);
  const byAgent = parseObject(wakeRepair[agentId]);
  const attempts = parseNumber(byAgent.attempts) + 1;
  const now = new Date().toISOString();
  const historyRaw = Array.isArray(remediation.history) ? remediation.history : [];
  const historyEntry = {
    at: now,
    issueId,
    agentId,
    action: patch.action,
    outcome: patch.outcome,
    error: patch.error ?? null,
  };
  const history = [...historyRaw, historyEntry].slice(-HISTORY_LIMIT);

  const nextProcessState = {
    ...processState,
    remediation: {
      ...remediation,
      wakeRepair: {
        ...wakeRepair,
        [agentId]: {
          attempts,
          lastAttemptAt: now,
          lastAction: patch.action,
          lastOutcome: patch.outcome,
          lastError: patch.error ?? null,
        },
      },
      history,
    },
  };

  await issues.update(issueId, { processStateJson: nextProcessState });
}

async function canAttemptRemediation(issues: IssueSvc, issueId: string, agentId: string): Promise<boolean> {
  const issue = await issues.getById(issueId);
  if (!issue) return false;
  const processState = parseObject(issue.processStateJson);
  const remediation = parseObject(processState.remediation);
  const wakeRepair = parseObject(remediation.wakeRepair);
  const byAgent = parseObject(wakeRepair[agentId]);
  const attempts = parseNumber(byAgent.attempts);
  return attempts < MAX_REMEDIATION_ATTEMPTS;
}

export async function safeWakeAgentForIssue(
  db: Db,
  agentId: string,
  wakeup: WakeupInput,
  opts?: { issueId?: string | null; enableDirectInvokeFallback?: boolean },
) {
  const heartbeat = heartbeatService(db);
  const issues = issueService(db);
  const issueId = extractIssueId(wakeup, opts?.issueId ?? null);

  try {
    return await heartbeat.wakeup(agentId, wakeup);
  } catch (err) {
    const failureClass = classifyWakeFailure(err);
    if (!issueId) {
      logger.warn({ err, agentId, failureClass }, "wakeup failed without issue context");
      throw err;
    }

    if (failureClass === "schema_mismatch" || failureClass === "agent_not_invokable") {
      await recordRemediation(issues, issueId, agentId, {
        outcome: "failed_fast",
        action: "wakeup_initial",
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    const allowed = await canAttemptRemediation(issues, issueId, agentId);
    if (!allowed) {
      await recordRemediation(issues, issueId, agentId, {
        outcome: "remediation_exhausted",
        action: "wakeup_initial",
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    const repaired = await issues.repairExecutionState(issueId);
    await heartbeat.resetRuntimeSession(agentId, { taskKey: issueId });
    await recordRemediation(issues, issueId, agentId, {
      outcome: repaired.repaired ? "state_repaired" : "state_checked",
      action: "repair_and_reset",
      error: repaired.reason,
    });

    try {
      const run = await heartbeat.wakeup(agentId, wakeup);
      await recordRemediation(issues, issueId, agentId, {
        outcome: "recovered",
        action: "wakeup_retry",
      });
      return run;
    } catch (retryErr) {
      if (opts?.enableDirectInvokeFallback !== true) {
        await recordRemediation(issues, issueId, agentId, {
          outcome: "retry_failed",
          action: "wakeup_retry",
          error: retryErr instanceof Error ? retryErr.message : String(retryErr),
        });
        throw retryErr;
      }

      try {
        const context = parseObject(wakeup.contextSnapshot);
        const run = await heartbeat.invoke(
          agentId,
          wakeup.source ?? "on_demand",
          {
            ...context,
            issueId,
            taskId: issueId,
            remediationFallback: true,
          },
          wakeup.triggerDetail ?? "system",
          {
            actorType: wakeup.requestedByActorType ?? "system",
            actorId: wakeup.requestedByActorId ?? null,
          },
        );
        await recordRemediation(issues, issueId, agentId, {
          outcome: "recovered_direct_invoke",
          action: "direct_invoke_fallback",
        });
        return run;
      } catch (fallbackErr) {
        await recordRemediation(issues, issueId, agentId, {
          outcome: "fallback_failed",
          action: "direct_invoke_fallback",
          error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
        });
        throw fallbackErr;
      }
    }
  }
}
