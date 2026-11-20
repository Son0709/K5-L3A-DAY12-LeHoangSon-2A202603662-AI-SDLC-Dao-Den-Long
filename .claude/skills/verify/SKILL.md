---
name: verify
description: Verify a change to the Đảo Đèn Lồng simulation or client with evidence (typecheck, tests, mutation check, proof, perf). Use after changing rules, maps, tuning or the headless CLI, and before tagging a phase.
---

# Verify a change

"The agent said it works" is not evidence. Produce evidence in this order and stop at the first failure.

1. `npm run typecheck`, then `npm test`. Both must be green.
2. **New or changed rule?** Write the test first from the spec (`docs/notes/phase2-spec.md`, acceptance criteria), watch it fail, then implement. Hand-derive the expected numbers from the ticket; never copy them from the program's output.
3. **Mutation check** (is the test strict?): temporarily change the rule's constant in `src/sim/tuning.ts`, `src/sim/maps.ts` or `game.contract.json` (for example `DRIFT_SPEED = 7` to `6`), run `npm test`, and confirm at least one test fails. Restore the file. A mutant that survives means the test is too loose: add a test that kills it. Never restore with `git checkout` on files that hold uncommitted work; save a copy of the file and write it back.
4. `npm run proof` regenerates `docs/proof/phase-3/` from the real CLI (`proof:phase1` and `proof:phase2` are frozen to their tags and refuse to run on the current contract). It must end `N/N checks passed`. Run it after committing code so `RESULTS.md` records a clean commit.
5. Performance: a full night headless must stay at or under 30 s (proof check E1). Client frame rate: `npm run fps` (needs Chrome), at least 30 FPS at 1280x720.
6. If a rule changes, update `AGENTS.md` (conventions) and the numbered assumptions in `docs/notes/phase2-spec.md`. If an old test becomes wrong because the ticket changed the rule, replace it and write the reason in `docs/notes/ai-log.md`; never silence it.

Guard rails
- `npm run proof:phase1` only works at the `phase-1` tag; it refuses to run on contract v1.1 so it cannot overwrite Phase 1 evidence.
- The `Stop` hook (`scripts/stop-gate.ts`) blocks finishing while typecheck or tests are red.
- Report failures as failures. A requirement not met is written "chưa đạt" with the reason.
