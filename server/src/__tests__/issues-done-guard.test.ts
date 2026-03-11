import { describe, expect, it } from "vitest";
import { canAgentCloseIssueWithComment } from "../routes/issues-done-guard.js";

describe("canAgentCloseIssueWithComment", () => {
  it("rejects generic done comments", () => {
    expect(
      canAgentCloseIssueWithComment({
        issueDescription: "Done when: n=8 を満たす",
        doneComment: "Customer Voice Lead形式で1件投稿し、doneへ更新しました。",
      }),
    ).toBe(false);
  });

  it("requires numeric evidence when Done when contains numeric thresholds", () => {
    expect(
      canAgentCloseIssueWithComment({
        issueDescription: "Done when: n=8 で 1500円以上許容件数を返す",
        doneComment: "Result:\n- 1500円以上許容は 5/8\n- 主離脱理由は入力負荷 3件",
      }),
    ).toBe(true);
  });

  it("allows substantive comments when Done when has no numeric threshold", () => {
    expect(
      canAgentCloseIssueWithComment({
        issueDescription: "Done when: 親 issue に要約を返す",
        doneComment: "Result:\n- 親 issue 向けに要約を返却し、未解決事項はありません。",
      }),
    ).toBe(true);
  });
});
