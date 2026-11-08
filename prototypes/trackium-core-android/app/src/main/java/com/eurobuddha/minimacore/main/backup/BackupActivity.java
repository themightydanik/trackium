package com.eurobuddha.minimacore.main.backup;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;

import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.i18n.LanguageDialog;
import static com.eurobuddha.minimacore.i18n.R.string.*;
import com.eurobuddha.minimacore.utils.SystemBars;
import com.eurobuddha.minimacore.main.SeedSyncActivity;

/**
 * Backup &amp; Recovery - one home for the operations that were scattered across the overflow
 * menu (Resync Node, Show Seed) and the ones the node could never reach from its own UI at all.
 *
 * Rows are added here as each screen lands, so a feature that is not built yet is absent rather
 * than present and dead.
 */
public class BackupActivity extends AppCompatActivity {

    private TextView gate;
    private LinearLayout rows;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.backup_hub);

        Toolbar tb = findViewById(R.id.toolbar);
        Language.toolbarTitle(tb, Language.msg(l10n_menu_backup));
        setSupportActionBar(tb);
        if (getSupportActionBar() != null) getSupportActionBar().setDisplayHomeAsUpEnabled(true);
        tb.setNavigationOnClickListener(v -> finish());
        // targetSdk 35 is edge to edge: without this the toolbar sits under the clock.
        SystemBars.pad(findViewById(R.id.backup_hub_main));

        gate = findViewById(R.id.backup_hub_gate);
        rows = findViewById(R.id.backup_hub_rows);
        buildRows();
    }

    @Override protected void onResume() {
        super.onResume();
        // Keys finish creating while this screen is open, so re-read rather than cache.
        renderGate();
    }

    private void buildRows() {
        addRow(Language.msg(l10n_backup_create),
                Language.msg(l10n_backup_create_help),
                v -> startActivity(new Intent(this, BackupCreateActivity.class)));

        addRow(Language.msg(l10n_backup_restore),
                Language.msg(l10n_backup_restore_help),
                v -> startActivity(new Intent(this, RestoreFileActivity.class)));

        addRow(Language.msg(l10n_chatbak_title),
                Language.msg(l10n_chatbak_help),
                v -> startActivity(new Intent(this, ChatBackupActivity.class)));

        addRow(Language.msg(l10n_resync_title),
                Language.msg(l10n_backup_resync_help),
                v -> startActivity(new Intent(this, SeedSyncActivity.class)));

        addRow(Language.msg(l10n_backup_private_keys),
                Language.msg(l10n_backup_private_help),
                v -> startActivity(new Intent(this, VaultActivity.class)));
    }

    private void addRow(CharSequence title, CharSequence subtitle, View.OnClickListener onClick) {
        View row = LayoutInflater.from(this).inflate(R.layout.view_backup_row, rows, false);
        Language.setText(row.findViewById(R.id.backup_row_title), title);
        Language.setText(row.findViewById(R.id.backup_row_subtitle), subtitle);
        row.setOnClickListener(onClick);
        rows.addView(row);
    }

    /** Shown once, at the top, instead of as six identical mid-command failures. */
    private void renderGate() {
        NodeKeys.Status status = NodeKeys.read();
        boolean blocked = !status.ready;
        gate.setVisibility(blocked ? View.VISIBLE : View.GONE);
        if (blocked) Language.setText(gate, status.message());
        for (int i = 0; i < rows.getChildCount(); i++) {
            View row = rows.getChildAt(i);
            row.setEnabled(!blocked);
            row.setAlpha(blocked ? 0.45f : 1f);
        }
    }

}
