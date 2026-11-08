# PandaBear and BlackBear: which Minima node should I use?

**PandaBear uses classic wallet keys. BlackBear forces block-as-key-uses and low-RAM storage.** Both run on the same Minima network and include our companion-app, signing-safety and reliability fixes.

| | PandaBear | BlackBear |
| --- | --- | --- |
| Android package | `com.eurobuddha.minimacore` | `com.eurobuddha.minimablock` |
| Wallet key mode | Classic, per-key signing counter | Block-as-key-uses, based on chain height and persisted counters |
| Key tree | 64 × 64 × 64: 262,144 leaves per key | 128 × 128 × 128 × 128: 268,435,456 leaves per key |
| Best fit | Keep using your existing classic wallet and addresses | Start a new wallet in the newer mode |
| Installation | The 1.9.10 build is a separate Android identity from earlier PandaBear releases | The 1.9.10 build is a separate Android identity from earlier BlackBear releases |
| Storage mode | Existing classic configuration | Low-RAM SQL coin/block storage enabled by default |

## The important difference: wallet addresses

The same seed produces **different addresses** in these two modes. Installing BlackBear and entering a PandaBear seed does not move the coins on the old addresses. BlackBear is not an in-place wallet migration or an automatic replacement for PandaBear.

To move from PandaBear to BlackBear:

1. Complete or unwind active AtomiX swaps and close or migrate PandaPools positions while the original wallet can still sign. A live contract keeps the public keys it was created with.
2. Create the destination wallet in BlackBear and record its receive address and recovery information.
3. Stop BlackBear, run PandaBear, and send funds to the recorded BlackBear address. Confirm receipt when running BlackBear.
4. Re-pair companion apps with the destination node. AtomiX needs a valid identity in that wallet; counterparties need the new maker key when it changes.

Run **one node at a time**. Since 2.1.1 each Bear listens on its own port (PandaBear 13001, BlackBear 21001, Pandamonium 25001), so the ports no longer collide; even so, installing both is supported, but running both together is not the migration procedure.

## Signing counters and recovery

In PandaBear, a key's use count advances when that key signs. In BlackBear, the selected index is at least the chain height and also advances past persisted use counters. A large block-mode number is normal; it is not the number of swaps you have made.

Neither mode permits reuse of a one-time signing leaf. Restore with the matching wallet mode, stop the old wallet first, and set a recovery floor above every previously used index. Chain height alone cannot prove that a signing index is unused. Neither mode makes two simultaneously signing copies of the same wallet safe.

## Pandamonium

The application is **Minima Core**; **Pandamonium** is its integrated-app build. It uses
`com.eurobuddha.pandamonium`. Block-as-key-uses and low-RAM storage are enabled by default.
Its Classic mode setting removes both startup flags. Changing that setting does not recreate
existing keys or reset their signing counters. Standalone companion APKs remain supported.

## Companion apps

The updated family SDK discovers PandaBear, BlackBear and Pandamonium by registration, then
sends commands to one responding node. Multiple responders cause a refusal; commands are
never broadcast to several nodes. PandaDEX retains its bounded SDK and uses the same
three-build discovery rule. External apps still require the core's normal enable/admin permissions.

## Namespace migration candidate

The verified Pandamonium Fold release is **1.9.9**, Android version code **80**, using the existing
family key. Their application IDs and shared IPC namespace now use `com.eurobuddha`.

**These core candidates cannot update earlier installations in place.** Android treats the new
application IDs as separate apps, even with the same signing key. Keep the old installation
until its wallet and app data have been migrated and verified. A seed alone is not a complete
backup of signing counters, active swaps, pool recovery records or embedded app data.
Android Keystore-backed data also cannot simply be copied across application identities.
A complete cross-identity migration has not yet been verified; these builds are not published.

Companions whose application IDs already used `com.eurobuddha` keep those IDs and can receive
normal signed updates. The standalone Terminal ID also changes, so its installation is separate.
The companion updates and new cores must be released together; the new SDK targets the new
family identities and protocol. No compatibility with unrevised APKs or the upstream official
Core is implied by this namespace migration.

Pandamonium 1.9.9 was installed in place over the already-renamed 1.9.7 build on the Fold and confirmed working by the owner. The separate-identity warning above concerns the earlier namespace migration, not updates between these `com.eurobuddha` versions. Store publication remains pending.

All three 1.9.10 (81) release artifacts have passed local builds, unit tests, release lint and family-signature verification. The reviewed jar is 1.1.2.31-euro4. Its default balance excludes watch-only addresses while companion tracking remains available. The Fold remains on owner-verified 1.9.9; 1.9.10 store publication awaits selection.
