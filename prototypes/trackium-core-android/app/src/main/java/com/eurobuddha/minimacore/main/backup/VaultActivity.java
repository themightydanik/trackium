package com.eurobuddha.minimacore.main.backup;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.LayoutInflater;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;



import org.minima.utils.json.JSONObject;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.i18n.LanguageDialog;
import static com.eurobuddha.minimacore.i18n.R.string.*;
import com.eurobuddha.minimacore.utils.SystemBars;
import com.eurobuddha.minimacore.main.ResyncJob;
import com.eurobuddha.minimacore.main.ResyncLauncher;
import com.eurobuddha.minimacore.main.SeedSyncActivity;
import com.eurobuddha.minimacore.utils.Clip;
import com.eurobuddha.minimacore.utils.Feedback;
import com.eurobuddha.minimacore.utils.MinimaCMD;
import com.eurobuddha.minimacore.utils.MinimaCMDListener;
import com.eurobuddha.minimacore.utils.Peers;

/**
 * The `vault` surface: read the seed phrase, lock and unlock the private keys, wipe and restore
 * them, and rebuild this wallet somewhere else from the phrase.
 *
 * FLAG_SECURE is forced on for the whole screen and never dropped, unlike the rest of the app
 * where it follows the "Allow Screenshots" setting. Everything here either is the wallet or
 * unlocks it, and a recents-thumbnail of a seed phrase is as good as the phrase itself.
 *
 * Only the last action - rebuilding from a phrase - is destructive and restarts the node, so it
 * alone goes through ResyncLauncher. The rest are ordinary commands run in place.
 */
public class VaultActivity extends AppCompatActivity {

    private final Handler handler = new Handler(Looper.getMainLooper());

    private TextView state, status, phrase, seed, seedLabel, phraseHint;
    private Button reveal, copyPhrase;
    private ProgressBar progress;
    private LinearLayout actions;

    /** Held only while the screen is up, so a wipe can hand the node its proof. */
    private String currentPhrase = "";
    private String currentSeed = "";
    private boolean locked;
    private boolean busy;
    /** False until the first `vault` reply lands, so "empty" is not mistaken for "no phrase". */
    private boolean loaded;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Never conditional here - see the class comment.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        setContentView(R.layout.vault_keys);

        Toolbar tb = findViewById(R.id.toolbar);
        Language.toolbarTitle(tb, Language.msg(l10n_backup_private_keys));
        setSupportActionBar(tb);
        if (getSupportActionBar() != null) getSupportActionBar().setDisplayHomeAsUpEnabled(true);
        tb.setNavigationOnClickListener(v -> finish());
        // targetSdk 35 is edge to edge: without this the toolbar sits under the clock.
        SystemBars.pad(findViewById(R.id.vault_main));

        state = findViewById(R.id.vault_state);
        status = findViewById(R.id.vault_status);
        phrase = findViewById(R.id.vault_phrase);
        seed = findViewById(R.id.vault_seed);
        seedLabel = findViewById(R.id.vault_seed_label);
        phraseHint = findViewById(R.id.vault_phrase_hint);
        reveal = findViewById(R.id.vault_reveal);
        copyPhrase = findViewById(R.id.vault_copy_phrase);
        progress = findViewById(R.id.vault_progress);
        actions = findViewById(R.id.vault_actions);

        reveal.setOnClickListener(v -> toggleReveal());
        copyPhrase.setOnClickListener(v ->
                Clip.copySensitive(this, Language.text(this, l10n_vault_seed_clipboard), currentPhrase, Language.text(this, l10n_vault_seed_copied)));
    }

    @Override protected void onResume() {
        super.onResume();
        hidePhrase();
        readVault();
    }

    @Override protected void onPause() {
        // Do not leave the phrase on screen, or in memory, for whoever opens the app next.
        // onResume re-reads it from the node, so nothing is lost by dropping it here.
        hidePhrase();
        currentPhrase = "";
        currentSeed = "";
        loaded = false;
        super.onPause();
    }

    // ---- reading state ----

    private void readVault() {
        MinimaCMD.runMinima(VaultCommands.read(), new MinimaCMDListener() {
            @Override public void cmdResult(JSONObject result) {
                handler.post(() -> {
                    if (isFinishing() || isDestroyed()) return;
                    String error = Feedback.errorOf(result);
                    if (error != null) {
                        Language.setText(state, Language.msg(l10n_vault_read_failed, error));
                        buildActions();
                        return;
                    }
                    loaded = true;
                    Object response = result.get("response");
                    if (response instanceof JSONObject) {
                        JSONObject json = (JSONObject) response;
                        currentPhrase = text(json.get("phrase"));
                        currentSeed = text(json.get("seed"));
                        locked = Boolean.TRUE.equals(json.get("locked"));
                    }
                    Language.setText(state, locked
                            ? Language.msg(l10n_vault_locked)
                            : Language.msg(l10n_vault_unlocked));
                    buildActions();
                });
            }
        });
    }

    private static String text(Object value) {
        String out = value == null ? "" : String.valueOf(value);
        return "null".equals(out) ? "" : out;
    }

    // ---- the seed phrase ----

    private void toggleReveal() {
        if (phrase.getVisibility() == View.VISIBLE) {
            hidePhrase();
            return;
        }
        if (!loaded) {
            // The cache is dropped on pause and refilled asynchronously on resume. Without this,
            // tapping Show in that gap reported "no seed phrase" for what is only a slow read.
            setStatus(Language.msg(l10n_vault_reading));
            return;
        }
        if (currentPhrase.isEmpty()) {
            setStatus(locked
                    ? Language.msg(l10n_vault_unlock_to_read)
                    : Language.msg(l10n_vault_no_phrase));
            return;
        }
        phrase.setText(currentPhrase);
        // The seed is shown too because wiping the keys requires handing it back.
        seed.setText(currentSeed);
        phrase.setVisibility(View.VISIBLE);
        seed.setVisibility(currentSeed.isEmpty() ? View.GONE : View.VISIBLE);
        seedLabel.setVisibility(currentSeed.isEmpty() ? View.GONE : View.VISIBLE);
        copyPhrase.setVisibility(View.VISIBLE);
        phraseHint.setVisibility(View.GONE);
        Language.setText(reveal, Language.msg(l10n_vault_hide_seed));
    }

    private void hidePhrase() {
        // Clear, not just hide: a GONE view still holds the words in the hierarchy.
        phrase.setText("");
        seed.setText("");
        phrase.setVisibility(View.GONE);
        seed.setVisibility(View.GONE);
        seedLabel.setVisibility(View.GONE);
        copyPhrase.setVisibility(View.GONE);
        phraseHint.setVisibility(View.VISIBLE);
        Language.setText(reveal, Language.msg(l10n_vault_show_seed));
    }

    // ---- actions ----

    private void buildActions() {
        actions.removeAllViews();
        if (locked) {
            addAction(Language.msg(l10n_vault_unlock_keys),
                    Language.msg(l10n_vault_unlock_help),
                    v -> askPassword(Language.msg(l10n_vault_unlock_keys),
                            Language.msg(l10n_vault_unlock_prompt),
                            Language.msg(l10n_lock_unlock),
                            password -> run(VaultCommands.passwordUnlock(password), Language.msg(l10n_vault_keys_unlocked))));
        } else {
            addAction(Language.msg(l10n_vault_lock_keys),
                    Language.msg(l10n_vault_lock_help),
                    v -> askNewPassword(Language.msg(l10n_vault_lock_keys),
                            Language.msg(l10n_vault_lock_prompt),
                            Language.msg(l10n_vault_lock),
                            (password, confirm) -> run(VaultCommands.passwordLock(password, confirm),
                                    Language.msg(l10n_vault_keys_locked))));

            addAction(Language.msg(l10n_vault_wipe_keys),
                    Language.msg(l10n_vault_wipe_help),
                    v -> confirmWipe());
        }

        addAction(Language.msg(l10n_vault_restore_keys),
                Language.msg(l10n_vault_restore_help),
                v -> askPhrase(Language.msg(l10n_vault_restore_keys),
                        Language.msg(l10n_vault_restore_prompt),
                        Language.msg(l10n_wallet_restore),
                        words -> run(VaultCommands.restoreKeys(words), Language.msg(l10n_vault_keys_restored))));

        addAction(Language.msg(l10n_vault_rebuild_wallet),
                Language.msg(l10n_vault_rebuild_help),
                v -> confirmSeedRebuild());
    }

    private void addAction(CharSequence title, CharSequence subtitle, View.OnClickListener onClick) {
        View row = LayoutInflater.from(this).inflate(R.layout.view_backup_row, actions, false);
        Language.setText(row.findViewById(R.id.backup_row_title), title);
        Language.setText(row.findViewById(R.id.backup_row_subtitle), subtitle);
        row.setOnClickListener(v -> { if (!busy) onClick.onClick(v); });
        actions.addView(row);
    }

    // ---- input dialogs ----

    private interface PasswordAction { void run(String password); }
    private interface NewPasswordAction { void run(String password, String confirm); }
    private interface PhraseAction { void run(String phrase); }

    private EditText field(int inputType, CharSequence hint) {
        EditText input = new EditText(this);
        input.setInputType(inputType);
        Language.hint(input, hint);
        input.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO);
        int pad = Math.round(20 * getResources().getDisplayMetrics().density);
        input.setPadding(pad, pad, pad, pad);
        return input;
    }

    private LinearLayout column() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        int pad = Math.round(8 * getResources().getDisplayMetrics().density);
        box.setPadding(pad, pad, pad, pad);
        return box;
    }

    /** One password, for a value the node itself verifies - a wrong one just fails harmlessly. */
    private void askPassword(CharSequence title, CharSequence message, CharSequence confirmText, PasswordAction action) {
        LinearLayout box = column();
        PasswordField entry = PasswordField.inflate(this, box, Language.msg(l10n_backup_password_hint));
        box.addView(entry.view());
        new LanguageDialog(this)
                .setTitle(title)
                .setMessage(message)
                .setView(box)
                .setPositiveButton(confirmText, (d, w) -> {
                    if (!ResyncJob.validPassword(entry.text())) {
                        // Same rule as everywhere else: the node's tokeniser rewrites anything
                        // else, so a password it would mangle must never be sent.
                        setStatus(Language.msg(l10n_vault_password_characters));
                        return;
                    }
                    action.run(entry.text());
                })
                .setNegativeButton(Language.msg(l10n_common_cancel), null)
                .show();
    }

    /**
     * Two entries, for a password that is being SET.
     *
     * Nothing verifies it afterwards: whatever is typed here becomes the only way back to the
     * keys short of the seed phrase, so a single mistyped character is unrecoverable. Both boxes
     * reveal, so the value can be read before committing.
     */
    private void askNewPassword(CharSequence title, CharSequence message, CharSequence confirmText, NewPasswordAction action) {
        LinearLayout box = column();
        PasswordField first = PasswordField.inflate(this, box, Language.msg(l10n_backup_password_hint));
        PasswordField second = PasswordField.inflate(this, box, Language.msg(l10n_backup_again_hint));
        box.addView(first.view());
        box.addView(second.view());
        new LanguageDialog(this)
                .setTitle(title)
                .setMessage(message)
                .setView(box)
                .setPositiveButton(confirmText, (d, w) -> {
                    if (!ResyncJob.validPassword(first.text())) {
                        setStatus(Language.msg(l10n_vault_password_characters));
                        return;
                    }
                    if (!first.text().equals(second.text())) {
                        setStatus(Language.msg(l10n_vault_mismatch_unchanged));
                        return;
                    }
                    action.run(first.text(), second.text());
                })
                .setNegativeButton(Language.msg(l10n_common_cancel), null)
                .show();
    }

    private void askPhrase(CharSequence title, CharSequence message, CharSequence confirmText, PhraseAction action) {
        EditText input = field(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE,
                Language.msg(l10n_vault_phrase_hint));
        new LanguageDialog(this)
                .setTitle(title)
                .setMessage(message)
                .setView(input)
                .setPositiveButton(confirmText, (d, w) -> {
                    String words = ResyncJob.tidyPhrase(input.getText().toString());
                    if (!ResyncJob.validPhrase(words)) {
                        setStatus(Language.msg(l10n_vault_invalid_phrase));
                        return;
                    }
                    action.run(words);
                })
                .setNegativeButton(Language.msg(l10n_common_cancel), null)
                .show();
    }

    /**
     * The node requires the seed handed back "TO SHOW THEY KNOW IT" (vault.java), and that is
     * the entire safety mechanism for a wipe. So this asks the user to paste it rather than
     * filling it in for them - autofilling it would satisfy the node while proving nothing, and
     * someone who cannot produce the seed is exactly the person who must not wipe.
     */
    private void confirmWipe() {
        EditText input = field(InputType.TYPE_CLASS_TEXT, "0x…");
        new LanguageDialog(this)
                .setTitle(Language.msg(l10n_vault_wipe_title))
                .setMessage(Language.msg(l10n_vault_wipe_warning))
                .setView(input)
                .setPositiveButton(Language.msg(l10n_vault_wipe_action), (d, w) -> {
                    String typed = input.getText().toString().trim();
                    if (!ResyncJob.validSeedHex(typed)) {
                        setStatus(Language.msg(l10n_vault_invalid_seed));
                        return;
                    }
                    // The node checks it really matches; a mismatch is refused there, not here.
                    run(VaultCommands.wipeKeys(typed), Language.msg(l10n_vault_keys_wiped));
                })
                .setNegativeButton(Language.msg(l10n_common_cancel), null)
                .show();
    }

    /**
     * Destructive and restarts the node, so it is the one action here that goes through
     * ResyncLauncher and is watched on the resync screen.
     */
    private void confirmSeedRebuild() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        EditText words = field(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE,
                Language.msg(l10n_vault_phrase_hint));
        EditText host = field(InputType.TYPE_CLASS_TEXT, "host:port");
        host.setText(Peers.getDefaultPeers(this));
        EditText uses = field(InputType.TYPE_CLASS_NUMBER,
                Language.msg(l10n_vault_uses_hint, ResyncJob.MIN_KEY_USES));
        uses.setText("2000");
        box.addView(words);
        box.addView(host);
        box.addView(uses);

        new LanguageDialog(this)
                .setTitle(Language.msg(l10n_vault_rebuild_title))
                .setMessage(Language.msg(l10n_vault_rebuild_warning))
                .setView(box)
                .setPositiveButton(Language.msg(l10n_vault_rebuild), (d, w) -> {
                    String phraseText = ResyncJob.tidyPhrase(words.getText().toString());
                    String hostText = host.getText().toString().trim();
                    int keyUses;
                    try {
                        keyUses = Integer.parseInt(uses.getText().toString().trim());
                    } catch (NumberFormatException exc) {
                        setStatus(Language.msg(l10n_restore_key_uses_integer));
                        return;
                    }
                    ResyncJob job = ResyncJob.seedResync(hostText, phraseText, keyUses);
                    if (job == null) {
                        setStatus(Language.msg(l10n_vault_check_rebuild, ResyncJob.MIN_KEY_USES, ResyncJob.maxKeyUses(org.minima.system.params.GeneralParams.USE_BLOCK_AS_KEYUSES)));
                        return;
                    }
                    ResyncLauncher.Result result = ResyncLauncher.begin(this, job);
                    if (!result.started) {
                        setStatus(SeedSyncActivity.launchError(result.error));
                        return;
                    }
                    startActivity(new Intent(this, SeedSyncActivity.class));
                    finish();
                })
                .setNegativeButton(Language.msg(l10n_common_cancel), null)
                .show();
    }

    // ---- running a vault command ----

    private void run(String command, CharSequence successMessage) {
        if (command == null) {
            setStatus(Language.msg(l10n_vault_check_input));
            return;
        }
        NodeKeys.Status keys = NodeKeys.read();
        if (!keys.ready) {
            setStatus(keys.message());
            return;
        }
        busy = true;
        progress.setVisibility(View.VISIBLE);
        setStatus(Language.msg(l10n_wallet_working));
        MinimaCMD.runMinima(command, new MinimaCMDListener() {
            @Override public void cmdResult(JSONObject result) {
                handler.post(() -> {
                    busy = false;
                    if (isFinishing() || isDestroyed()) return;
                    progress.setVisibility(View.GONE);
                    String error = Feedback.errorOf(result);
                    setStatus(error == null ? successMessage : error);
                    // The lock state and the phrase may both have changed.
                    currentPhrase = "";
                    currentSeed = "";
                    hidePhrase();
                    readVault();
                });
            }
        });
    }

    private void setStatus(CharSequence message) {
        status.setVisibility(message.length() == 0 ? View.GONE : View.VISIBLE);
        if (!message.toString().contentEquals(status.getText())) Language.setText(status, message);
    }
}
