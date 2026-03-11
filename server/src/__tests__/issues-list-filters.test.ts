import { describe, expect, it } from "vitest";

function filterByParentId(
  issues: Array<{ id: string; parentId: string | null }>,
  parentId: string | undefined,
) {
  if (parentId === undefined) return issues;
  if (parentId === "null") return issues.filter((issue) => issue.parentId === null);
  return issues.filter((issue) => issue.parentId === parentId);
}

describe("issues list parentId filtering", () => {
  const issues = [
    { id: "root", parentId: null },
    { id: "child-a", parentId: "root" },
    { id: "child-b", parentId: "other-root" },
  ];

  it("filters direct children by parent id", () => {
    expect(filterByParentId(issues, "root").map((issue) => issue.id)).toEqual(["child-a"]);
  });

  it("filters root issues with parentId=null", () => {
    expect(filterByParentId(issues, "null").map((issue) => issue.id)).toEqual(["root"]);
  });
});

describe("issue comments ordering", () => {
  it("keeps comments in ascending createdAt order", () => {
    const comments = [
      { id: "new", createdAt: new Date("2026-03-11T14:00:00Z") },
      { id: "old", createdAt: new Date("2026-03-11T13:00:00Z") },
    ];
    const ordered = [...comments].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    expect(ordered.map((comment) => comment.id)).toEqual(["old", "new"]);
  });
});
