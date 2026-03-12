# Autonomous Ops Rebuild Plan

## Decision

Rebuild from `upstream/master` instead of continuing to grow the existing fork history.

Reason:

- the old fork contains a mix of valid platform hardening and tactical local incident patches
- continuing on top of that history will preserve accidental behavior
- the new design requires a cleaner foundation centered on process state and submissions

The current rebuild branch is:

- `codex/autonomous-ops-rebuild`

## Review of Existing Fork Delta

The previous fork contains two kinds of changes.

### Keep as concepts, not as direct cherry-picks

These are useful ideas but should be reimplemented cleanly on top of current upstream:

- safe wake loop suppression
- terminal issue wake suppression
- stale child idle-gap recovery
- manager-handoff response enforcement
- server-side watchdog recovery
- maintenance mode

Commits in this category:

- `c69dd00`
- `d955e73`
- `9f57324`
- `e945791`
- `cdb3bf4`
- `17430f4`
- `29a194b`
- `6b0f709`
- `c4b6bf9`
- `420baee`
- `f074963`
- `33fbf8a`
- `8607dc9`
- `702680e`

### Likely local-only or obsolete

These should not drive the rebuild unless a concrete requirement appears again:

- `5708d83` fork operations doc
- `005a403` codex-local resume fallback tweak
- `92c1332` issue comment write workaround tied to comment-centric flow

### Keep only as design docs

- `a9ba8fd`
- `46811b9`
- `b546598`

These are design artifacts and should be ported by copying the docs, not by replaying platform code.

## Upstream Reality Check

`origin/master` is no longer close to `upstream/master`.

At the time of this rebuild:

- `origin/master` is ahead of `upstream/master` by many custom commits
- `upstream/master` also contains newer upstream work that should not be discarded

This confirms that the correct move is a clean rebuild branch, not another round of patch layering on the old fork.

## Rebuild Scope

Only implement the minimum set required by the redesign spec:

1. `processStateJson`
2. explicit waiting states
3. typed submissions
4. watchdog supervision
5. specialist-minimal default topology support

Do not port comment-centric repair logic unless it is needed as a temporary compatibility bridge.

## Implementation Sequence

### Step 1. Port the design docs

Bring over:

- `docs/specs/autonomous-ops-redesign.md`

This is the decision document for the rebuild.

### Step 2. Add process-state support

- DB: `issues.process_state_json`
- shared types
- issue API support
- UI visibility can remain minimal at first

### Step 3. Add explicit waiting states

- `waiting_for_submission`
- `waiting_for_children`

Do not try to redesign every status path at once.

### Step 4. Add typed submissions

Start with:

- `general_research_brief_v1`
- `decision_packet_v1`

The goal is to replace comment-as-output for the default research-first operating model.

### Step 5. Add minimal watchdog

Watchdog predicates:

- stale `waiting_for_submission`
- stale `waiting_for_children`
- accepted submission missing after successful run

Repair actions:

- re-wake
- reset session
- blocked after budget exhaustion

### Step 6. Adapt prompts and runtime assumptions

Change default operating model to:

- `CEO -> Chief -> Research Worker`

Specialists remain opt-in and off by default.

### Step 7. Add compatibility bridge only if needed

If old comment-driven companies must keep working during migration, add a temporary compatibility path.

This should be time-boxed and explicitly marked legacy.

## What Not to Rebuild

- repeated comment similarity heuristics as a long-term solution
- role-specific wake thresholds unless proven necessary after state/submission rollout
- local-board synthetic progress behavior
- permanent multi-specialist swarm as default topology

## Acceptance Criteria

The rebuild is ready to replace the old fork only when:

1. a worker can complete an issue without reading long comment threads
2. a successful run without an accepted submission does not advance workflow
3. comment loops are no longer the main failure mode
4. a stale waiting issue is repaired or blocked without manual intervention
5. the default org can run with `CEO -> Chief -> Research Worker`

## Recommendation

Do not migrate old tactical patches blindly.

Reimplement only the primitives required by the redesign. Anything else should prove its value again under the new model before being added back.
