import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";
import { execute } from "../../../packages/adapters/codex-local/src/server/execute.ts";

const {
  mockRunChildProcess,
  mockEnsureAbsoluteDirectory,
  mockEnsureCommandResolvable,
  mockEnsurePathInEnv,
} = vi.hoisted(() => ({
  mockRunChildProcess: vi.fn(),
  mockEnsureAbsoluteDirectory: vi.fn(),
  mockEnsureCommandResolvable: vi.fn(),
  mockEnsurePathInEnv: vi.fn((env) => env),
}));

vi.mock("@paperclipai/adapter-utils/server-utils", async () => {
  const actual = await vi.importActual<typeof import("@paperclipai/adapter-utils/server-utils")>(
    "@paperclipai/adapter-utils/server-utils",
  );
  return {
    ...actual,
    ensureAbsoluteDirectory: mockEnsureAbsoluteDirectory,
    ensureCommandResolvable: mockEnsureCommandResolvable,
    ensurePathInEnv: mockEnsurePathInEnv,
    runChildProcess: mockRunChildProcess,
  };
});

vi.mock("node:fs/promises", () => ({
  default: {
    stat: vi.fn().mockRejectedValue(new Error("missing")),
    mkdir: vi.fn(),
    readdir: vi.fn().mockResolvedValue([]),
    lstat: vi.fn().mockRejectedValue(new Error("missing")),
    symlink: vi.fn(),
    readFile: vi.fn().mockRejectedValue(new Error("missing")),
  },
}));

function makeCtx(): AdapterExecutionContext {
  return {
    runId: "run-1",
    agent: {
      id: "agent-1",
      companyId: "company-1",
      name: "Chief of Staff",
      role: "manager",
      adapterType: "codex_local",
    } as AdapterExecutionContext["agent"],
    runtime: {
      sessionId: null,
      sessionParams: { sessionId: "thread-old", cwd: "/tmp/work" },
      sessionDisplayId: "thread-old",
    },
    config: {
      cwd: "/tmp/work",
      command: "codex",
      model: "gpt-5.3-codex",
      timeoutSec: 180,
      graceSec: 15,
      promptTemplate: "Continue your Paperclip work.",
    },
    context: {},
    onLog: vi.fn(async () => {}),
    onMeta: vi.fn(async () => {}),
    authToken: "jwt",
  };
}

describe("codex_local execute retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureAbsoluteDirectory.mockResolvedValue(undefined);
    mockEnsureCommandResolvable.mockResolvedValue(undefined);
  });

  it("retries with a fresh session when resume times out", async () => {
    mockRunChildProcess
      .mockResolvedValueOnce({
        exitCode: null,
        signal: "SIGTERM",
        timedOut: true,
        stdout: "",
        stderr: "",
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        signal: null,
        timedOut: false,
        stdout: [
          JSON.stringify({ type: "thread.started", thread_id: "thread-new" }),
          JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "done" } }),
          JSON.stringify({ type: "turn.completed", usage: { input_tokens: 1, output_tokens: 1 } }),
        ].join("\n"),
        stderr: "",
      });

    const ctx = makeCtx();
    const result = await execute(ctx);

    expect(mockRunChildProcess).toHaveBeenCalledTimes(2);
    expect(mockRunChildProcess.mock.calls[0]?.[2]).toContain("resume");
    expect(mockRunChildProcess.mock.calls[1]?.[2]).not.toContain("resume");
    expect(ctx.onLog).toHaveBeenCalledWith(
      "stderr",
      '[paperclip] Codex resume session "thread-old" timed out; retrying with a fresh session.\n',
    );
    expect(result.timedOut).toBe(false);
    expect(result.exitCode).toBe(0);
    expect(result.sessionId).toBe("thread-new");
    expect(result.clearSession).toBe(false);
  });
});
