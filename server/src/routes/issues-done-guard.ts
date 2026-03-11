function extractDoneWhenSection(description: string | null | undefined) {
  if (!description) return null;
  const match = description.match(
    /(?:^|\n)Done when:\s*([\s\S]*?)(?=\n(?:Constraints|Inputs|Output format|Escalate if|Priority|Goal):|$)/i,
  );
  return match?.[1]?.trim() ?? null;
}

function hasNumericRequirement(text: string) {
  return /\d/.test(text);
}

function hasEvidenceLikeContent(comment: string) {
  const trimmed = comment.trim();
  if (trimmed.length < 24) return false;
  if (/^(投稿|更新|完了|done|comment).*(done|完了)/i.test(trimmed)) return false;
  if (/形式で1件投稿し.*done/i.test(trimmed)) return false;
  return true;
}

export function canAgentCloseIssueWithComment(input: {
  issueDescription: string | null | undefined;
  doneComment: string | null | undefined;
}) {
  const doneComment = input.doneComment?.trim() ?? "";
  if (!hasEvidenceLikeContent(doneComment)) return false;

  const doneWhen = extractDoneWhenSection(input.issueDescription);
  if (!doneWhen) return true;
  if (!hasNumericRequirement(doneWhen)) return true;
  return /\d/.test(doneComment);
}
