# Fork Operations

`paperclipai/paperclip` を fork して独自運用する時の最小ルール。

## Source Of Truth

- 正本は `origin` の fork
- 日常運用、意思決定、release は fork を基準に進める
- `upstream` は参照元であり、常に追従義務はない
- `upstream` の変更は「採用したいものだけ取り込む」

## Remote Policy

- `origin`
  - 自分の fork
- `upstream`
  - `paperclipai/paperclip`

## Branch Policy

- `master`
  - fork の安定線であり正本
  - 日常運用の基準線
- `codex/*`
  - 日常作業用
  - 例: `codex/fork-bootstrap`, `codex/runtime-reliability`, `codex/venture-studio-defaults`

直接 `master` で作業を続けない。変更は `codex/*` に積む。

## Upstream Intake

`upstream` を採用したい時だけ取り込む:

```bash
git fetch upstream
git switch master
git merge upstream/master
git push origin master
```

fork の `master` を日常基準にする時:

```bash
git fetch origin
git switch codex/<branch>
git rebase origin/master
```

`upstream/master` を `--ff-only` 前提で扱わない。fork 側の変更を優先する。

## Commit Split

この repo の現在差分は 2 本に分ける。

### 1. Platform Reliability

対象:

- `server/src/services/heartbeat.ts`
- `server/src/routes/issues.ts`
- `server/src/services/issues.ts`
- `server/src/routes/agents.ts`
- `server/src/__tests__/heartbeat-workspace-session.test.ts`
- `server/src/__tests__/agent-invoke-permissions.test.ts`
- `server/src/__tests__/issues-child-wakeup.test.ts`
- `server/src/__tests__/issues-done-guard.test.ts`
- `server/src/__tests__/issues-list-filters.test.ts`
- `server/src/__tests__/issues-update-wakeup.test.ts`
- `server/src/routes/issues-child-wakeup.ts`
- `server/src/routes/issues-done-guard.ts`
- `server/src/routes/issues-update-wakeup.ts`

意図:

- wakeup / retry / no-op / parent-child orchestration を安定化
- これは fork 固有というより platform 側の改善

### 2. Codex Adapter Runtime

対象:

- `packages/adapters/codex-local/src/server/execute.ts`
- `packages/adapters/codex-local/src/ui/build-config.ts`
- `pnpm-lock.yaml`

意図:

- timeout, resume retry, fresh session fallback の調整
- Codex adapter の安定化

## Commit Message Shape

例:

```bash
feat: harden issue wakeup and auto-requeue
fix: make codex-local resume fallback safer
docs: add fork operations guide
```

## Fork-Specific vs Upstream-Safe

fork 側へ寄せる変更:

- venture studio 向け control-plane defaults
- venture studio role defaults
- agent prompt defaults
- heartbeat default policy
- issue template defaults
- startup docs

upstream に寄せやすい変更:

- heartbeat reliability
- no-op retry handling
- wakeup / issue execution safety
- adapter timeout and resume stability
- list / comment API correctness

## Recommended Daily Flow

1. `git fetch origin`
2. `git switch master`
3. `git pull --ff-only origin master`
4. `git switch codex/<work>`
5. `git rebase origin/master`
6. 実装
7. テスト
8. `git push origin codex/<work>`

## Guardrails

- fork 専用の workflow 変更は docs と defaults に寄せる
- core schema を変える時は upstream 追従コストを先に考える
- `master` は壊さない
- 実験は必ず `codex/*` で行う
- 本家と fork の差分を減らすこと自体は目的にしない
