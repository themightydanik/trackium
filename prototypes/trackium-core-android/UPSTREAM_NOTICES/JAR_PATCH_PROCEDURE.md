# Surgical jar patch — changing the node without rebuilding the fork

The node ships to the APK as a prebuilt jar, not as source in this repo. A change to
`core/minima-core/src/...` reaches a device by recompiling **one class** and swapping it into
three prebuilt jars — never by a Gradle rebuild of the fork.

**Why not Gradle:** the fork's `buildjars.sh` runs Gradle 6.7.1, which caps at JDK 15. The only
JDK installed here is 26.0.1. (Note the naming inversion in that script if it is ever used:
Gradle's `minima.jar` becomes `minima-nolibs.jar`, and `minima-all.jar` becomes `minima.jar`.)

This procedure was written by executing it, for the `TxPoWSqlDB` index patch of 1.6.17-ui-h2
(vc45). Every number below is a real measurement from that run.

## The three jars

Patch all three, in this order. They drifted apart once before (July 2026: four commits patched
only `minima-nolibs.jar`, and `ec862a7` had to repair the fat jar afterwards) — which is why the
three-jar rule exists.

| jar | what it is | entries | `org/h2` |
|---|---|---|---|
| `core/minima-core/jar/minima.jar` | the **fat** jar (bundles H2 2.4.240, BouncyCastle) — desktop | 3278 | 1030 |
| `core/minima-core/jar/minima-nolibs.jar` | Gradle-built nolibs | 478 | 0 |
| `apks/base/app/libs/minima.jar` | **what the APK ships** — nolibs, plain-javac vintage | 478 | 0 |

The Android app gets its H2 from Maven, not from the jar: `app/build.gradle` pins
`com.h2database:h2:2.1.214` (downgraded from 2.4.240 because that version's
`org.h2.security.SHA256.getPBKDF2` fails ART's verifier on Samsung — see
`H2_VERIFYERROR_FIX.md`). **Test node DB changes against 2.1.214, not the 2.4.240 in the fat
jar.**

## Procedure

### 1. Edit the source

Edit `core/minima-core/src/...` normally and commit it in that repo. The source is the record;
the jars are the artefact.

### 2. Record the baseline — before touching anything

```bash
cd ~/Projects/minima
C=org/minima/database/txpowdb/sql/TxPoWSqlDB.class      # the class you are patching
for j in core/minima-core/jar/minima.jar \
         core/minima-core/jar/minima-nolibs.jar \
         apks/base/app/libs/minima.jar; do
  echo "=== $j"
  echo "  entries : $(unzip -l "$j" | tail -1 | awk '{print $2}')"
  echo "  org/h2  : $(unzip -l "$j" | grep -c '^.* org/h2/')"
  unzip -v "$j" | awk -v c="$C" '$0 ~ c {print "  CRC     : "$7}'
  echo "  members : $(javap -p -cp "$j" ${C%.class} | tr / . | grep -c ';')"
done
```

Back the jars up somewhere outside the repo before patching — they are large binaries and a
botched `zip` is easier to restore than to reason about.

### 3. Compile once per jar, against that jar

Compiling cleanly against a jar is what **proves API compatibility** with it. Do not compile
once and reuse — compile three times, each with that jar as the classpath.

```bash
SRC=core/minima-core/src/org/minima/database/txpowdb/sql/TxPoWSqlDB.java
i=0
for j in core/minima-core/jar/minima.jar \
         core/minima-core/jar/minima-nolibs.jar \
         apks/base/app/libs/minima.jar; do
  i=$((i+1)); mkdir -p /tmp/jarpatch/out$i
  javac --release 11 -nowarn -encoding UTF-8 -implicit:none \
        -cp "$j" -d /tmp/jarpatch/out$i "$SRC"
done
```

- **`--release 11`** matches `compileOptions` in `app/build.gradle` (`VERSION_11`, no
  desugaring) and is what shipped and was dex-verified in vc39. `--release 8` also works on
  JDK 26 (emits major 52, with an obsolescence warning) and is the more homogeneous choice —
  the rest of the jar is major 52 while patched classes are major 55. Pick one; do not mix
  within a release without saying so.
- **`-implicit:none`** stops javac quietly compiling dependencies it finds on the source path.
  Check the class count: you should get exactly the classes you expect, plus any inner classes.

Then confirm all three outputs are byte-identical and correctly targeted:

```bash
md5 -q /tmp/jarpatch/out{1,2,3}/$C        # three identical hashes
xxd -l 8 /tmp/jarpatch/out1/$C            # cafebabe 0000 0037  → major 55 = Java 11
```

### 4. Insert the class

Use **`zip`, not `jar uf`** — `jar uf` does not reliably update the fat jar. Run it from the
output directory so the entry lands at its package path.

```bash
ROOT=~/Projects/minima
( cd /tmp/jarpatch/out1 && zip -q "$ROOT/core/minima-core/jar/minima.jar"        "$C" )
( cd /tmp/jarpatch/out2 && zip -q "$ROOT/core/minima-core/jar/minima-nolibs.jar" "$C" )
( cd /tmp/jarpatch/out3 && zip -q "$ROOT/apks/base/app/libs/minima.jar"          "$C" )
```

### 5. Verify — all five checks, every time

```bash
for j in core/minima-core/jar/minima.jar \
         core/minima-core/jar/minima-nolibs.jar \
         apks/base/app/libs/minima.jar; do
  echo "=== $j"
  echo "  entries : $(unzip -l "$j" | tail -1 | awk '{print $2}')"
  echo "  org/h2  : $(unzip -l "$j" | grep -c '^.* org/h2/')"
  unzip -v "$j" | awk -v c="$C" '$0 ~ c {print "  CRC     : "$7}'
  echo "  members : $(javap -p -cp "$j" ${C%.class} | tr / . | grep -c ';')"
  unzip -t "$j" >/dev/null && echo "  archive : OK"
done
```

| check | expectation |
|---|---|
| entry count | **unchanged** — 3278 / 478 / 478. A change means you added an entry instead of replacing one (wrong path). |
| `org/h2` count | **unchanged** — 1030 / 0 / 0. A change means you clobbered bundled libraries. |
| CRC of the patched class | **identical in all three jars.** This is the patch's own fingerprint and the strongest single check. Before the vc45 patch the app jar differed from the other two (a different build vintage); after it, all three agree. |
| member count | unchanged, unless the change deliberately adds or removes members. |
| `unzip -t` | OK. |

Then confirm the change is actually *in* there, not merely that a file was replaced:

```bash
javap -c -p -cp core/minima-core/jar/minima.jar org.minima.database.txpowdb.sql.TxPoWSqlDB \
  | grep 'CREATE INDEX'
```

### 6. Verify into the dex — do not skip this

Bytecode that is valid on the JVM can still be **rejected by ART**; that is exactly what
`H2_VERIFYERROR_FIX.md` documents, and why vc39 checked with `dexdump` rather than stopping at
`javap`. After building the release APK:

```bash
unzip -o -q app/build/outputs/apk/release/app-release.apk 'classes*.dex' -d /tmp/dexcheck
for d in /tmp/dexcheck/classes*.dex; do
  dexdump -d "$d" 2>/dev/null | grep -q 'TxPoWSqlDB' && echo "found in $d"
done
```

Check the changed behaviour is present — for vc45, the `CREATE INDEX` string constants.

### 6b. Verify the change does what you intended, not just that it is present

All the checks above prove the bytecode arrived. None of them prove it *works*. Test the actual
behaviour against the library version the APK ships, not the one in the fat jar.

The vc45 patch is the cautionary tale. The first cut added the two indexes, verified perfectly
through jar and dex — and would have shipped a fix that did nothing for the hot path. An
`EXPLAIN` against H2 **2.1.214** showed `getLatestTxPoW` was *still* a full table scan, because
H2 will not use an index for a bare `ORDER BY … LIMIT` with no `WHERE`. The query needed
changing too. `EXPLAIN ANALYZE` then gave the number that mattered:

| | plan | page reads (60k rows) |
|---|---|---|
| index only, query unchanged | `tableScan` | 25,535 |
| index + `WHERE timemilli > 0` | index | **3,755** |

Note also that wall-clock timing on a warm SSD showed **no difference** (85 ms vs 88 ms) and
would have sent you the wrong way entirely. Measure work done — pages read, rows examined —
not elapsed time on hardware that is nothing like the target.

For a DB change: `EXPLAIN` and `EXPLAIN ANALYZE` on a scratch H2 of the right version, seeded
to a realistic row count. A single-file Java source launch (`java -cp h2-2.1.214.jar Test.java`)
is enough; no project needed.

### 7. Ship it

- **Bump `versionCode` + `versionName`** in `app/build.gradle` and add a line to the
  per-version changelog comment block. **The pre-commit hook will not catch this for you**: it
  defines a code change as `^app/src/`, so a patched `app/libs/minima.jar` commits cleanly with
  no bump. The most consequential change in this repo is the one the hook cannot see.
- Commit the fork's source change in `core/minima-core` **and** its two jars; commit the app's
  jar with the version bump in `apks/base`. One logical change, one version, one commit.
- Then the normal release ritual (see `HARDENING_1.6.16.md`): assemble, lint, tests,
  `apksigner verify` against family cert
  `eca1383c9d27683a281fbe6355356267877dc2dd14d963d7cc289ca0700e517f`, artefacts + sidecars into
  `dist/`, GitHub release on the `fork` remote, then `scripts/publish-app.py` in
  `desktop/minima-core-apks` with `--name "minimaCore PandaBear"`.

## Known drift

`desktop/minimacore-desktop/resources/minima.jar` is the `ec862a7` fat jar — one revision behind
`core/minima-core/jar/minima.jar`, and it does **not** carry the `removeScript` fix. Refresh it
when convenient; it is a fourth copy nobody currently patches.

## History

Prior patches, for reference on style and verification depth:

| commit | what |
|---|---|
| `ec862a7` (core) | origin of the technique — `Wallet.signData`/`updateUses` synchronized, `--release 8` |
| `c081533` (core) | `Wallet.removeScript` cache clears, `--release 11`, all three jars |
| `6855b51` (apks/base) | ships the signData jar as 1.6.7-ui-h2 |
| `56e2959` (apks/base) | ships the removeScript jar as 1.6.11-ui-h2 — first `dexdump` verification |
| this document | `TxPoWSqlDB` indexes, 1.6.17-ui-h2 (vc45) |
