import { describe, expect, it } from "vitest";

function canInvokeTarget(params: {
  actorType: "board" | "agent";
  actorAgentId: string | null;
  targetAgentId: string;
  actorCompanyId: string;
  targetCompanyId: string;
  chainOfCommandIds: string[];
}) {
  if (params.actorType === "board") return true;
  if (!params.actorAgentId) return false;
  if (params.actorCompanyId !== params.targetCompanyId) return false;
  if (params.actorAgentId === params.targetAgentId) return true;
  return params.chainOfCommandIds.includes(params.actorAgentId);
}

describe("agent invoke permissions", () => {
  it("allows self invoke", () => {
    expect(
      canInvokeTarget({
        actorType: "agent",
        actorAgentId: "agent-1",
        targetAgentId: "agent-1",
        actorCompanyId: "company-1",
        targetCompanyId: "company-1",
        chainOfCommandIds: [],
      }),
    ).toBe(true);
  });

  it("allows ancestor manager invoke", () => {
    expect(
      canInvokeTarget({
        actorType: "agent",
        actorAgentId: "chief",
        targetAgentId: "worker",
        actorCompanyId: "company-1",
        targetCompanyId: "company-1",
        chainOfCommandIds: ["chief", "ceo"],
      }),
    ).toBe(true);
  });

  it("rejects unrelated agent invoke", () => {
    expect(
      canInvokeTarget({
        actorType: "agent",
        actorAgentId: "other-agent",
        targetAgentId: "worker",
        actorCompanyId: "company-1",
        targetCompanyId: "company-1",
        chainOfCommandIds: ["chief", "ceo"],
      }),
    ).toBe(false);
  });
});
