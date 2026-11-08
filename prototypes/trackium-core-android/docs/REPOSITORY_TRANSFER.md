# Standalone repository transfer

The target `themightydanik/trackium-core-android` could not be resolved with the available GitHub integration on 2026-11-08. It may not exist or may be inaccessible. No repository was created; no source from PR #12 was deleted or merged. The stage-2 project is self-contained at the local `/workspace/trackium-core-android` and mirrored for review/Actions in the original Trackium repository's separate stage-2 branch.

## Verified extraction already performed

The initial local standalone `main` commit was made from the **tracked** PR #12 tree, without caches, keys, wallet data or build output:

```sh
# Run in a clean checkout of themightydanik/trackium with PR #12 available.
SOURCE_COMMIT=13406d23f5ce5bcc1dcd662e0bd622f286ce974e
PROJECT_PATH=prototypes/trackium-core-android
DESTINATION=/absolute/path/to/new/trackium-core-android
mkdir "$DESTINATION"  # must be new; do not overwrite an existing checkout
git archive "$SOURCE_COMMIT:$PROJECT_PATH" | tar -x -C "$DESTINATION"
git -C "$DESTINATION" init -b main
git -C "$DESTINATION" add .
git -C "$DESTINATION" commit -m "chore: extract Trackium Core from trackium PR 12 at $SOURCE_COMMIT"
test "$(git rev-parse "$SOURCE_COMMIT:$PROJECT_PATH")" = "$(git -C "$DESTINATION" rev-parse 'HEAD^{tree}')"
```

The exact extracted tree was `9186657ce49ca0476119f1c5c7836c33e37e0fca`. This equality includes executable bits, binary JAR/wrapper/icons, LICENSE, NOTICE, original source pins, all tests and architecture docs. Git subtree is not installed in this environment; `git archive`/tree verification provides the tested portable alternative. The source reference remains in extraction commit message and source pins, rather than claiming that the entire unrelated backend history was imported.

## Move the completed stage-2 tree after the owner provides an accessible empty repository

These commands do **not** create a repository. The owner must first create/provide the intended repository and grant appropriate access. Do not force-push an existing nonempty repository.

Option A, in the prepared standalone checkout (preserves extraction main and separate stage-2 review branch):

```sh
cd /workspace/trackium-core-android
git status --short  # must be clean
git remote -v     # origin is the intended target, not the parent Trackium repo
gh repo view themightydanik/trackium-core-android
git ls-remote origin  # inspect; target must be empty for this initial main push
git push -u origin main
git push -u origin feat/stage2-phone-readiness
gh pr create --repo themightydanik/trackium-core-android --base main --head feat/stage2-phone-readiness --title 'feat: prepare Trackium Core for phone acceptance' --body-file docs/STAGE2_PR.md
```

No auto-merge command is part of this procedure. Do not use --force. A nonempty target requires inspecting its existing history and preparing a normal branch/PR; stop before pushing main over it.

Option B, if only the temporary parent stage-2 branch is available: use its reviewed final commit instead of SOURCE_COMMIT above and archive the same PROJECT_PATH into a **new** local repository. This exports the complete stage-2 source directly at root; keep that parent commit hash in the initial commit message. Add the target remote only after checking its identity/access. Push a review branch according to the target's existing main/branch policy.

## Verification before retiring the temporary copy

1. Compare the target root tree against the exact staged project subtree (or diff tracked archives), including `.github/workflows/trackium-core-debug.yml` and notices. Do not copy the parent root's Gateway/Android workflows/backend.
2. Clone target into a fresh directory; run scripts/ci-debug.sh with the documented SDK/JDK. Confirm engine/source/legal pins, 327 JVM/Robolectric and 33 Python tests, host lint 0 errors, APK package/signature and the complete artifact bundle.
3. Run target GitHub Actions and download/verify its APK. Update canonical docs/run links to the target repository.
4. Keep parent PR #12, its branch and source directory intact until migration and target CI are verified. Any later removal/merge is a separate reviewed change; this stage does not perform it.

No Gateway code or services are duplicated. Actual owner-approved Gateway provisioning/pairing tooling continues to live in the main Trackium repository.
