# Demo scenario 1 — clean copy tweak

A low-risk documentation/copy change. Expected Autogate flow:
Layer 1 gate (check-types · lint · build · CodeRabbit) goes all-green →
Layer 2 agents pass → orchestrator decides **auto-merge**.

This PR exists to exercise the live Layer 1 gate (ticket 14) and the
GitHub App VcsProvider (ticket 04): listCheckRuns / awaitAllChecks resolve
on the real gate.yml check runs.

<!-- re-trigger gate for live webhook test -->

<!-- green re-trigger 38723ce -->

<!-- live-capture trigger -->

<!-- ngrok live webhook trigger -->
