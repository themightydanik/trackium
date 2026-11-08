package com.eurobuddha.minimacore;

import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;

import org.junit.Test;
import org.junit.runner.RunWith;
import com.eurobuddha.minimacore.main.backup.BackupActivity;
import com.eurobuddha.minimacore.main.backup.BackupCreateActivity;
import com.eurobuddha.minimacore.main.backup.RestoreFileActivity;

import static org.junit.Assert.*;

/**
 * No node, no network, nothing destructive: these only check that the screens refuse bad input
 * and state the gate, which is exactly the behaviour that must not regress. The tests run with
 * no node process, so every screen is in its blocked state - which is itself the thing worth
 * asserting, because a user opening this on a stopped node is a real case.
 */
@RunWith(AndroidJUnit4.class)
public class BackupScreensTest {

    @Test public void hubStatesTheGateAndDisablesEveryRowWhenTheNodeCannotAcceptCommands() {
        try (ActivityScenario<BackupActivity> screen = ActivityScenario.launch(BackupActivity.class)) {
            screen.onActivity(activity -> {
                TextView gate = activity.findViewById(R.id.backup_hub_gate);
                LinearLayout rows = activity.findViewById(R.id.backup_hub_rows);
                assertEquals(View.VISIBLE, gate.getVisibility());
                assertFalse(gate.getText().toString().isEmpty());
                assertTrue("every destination must exist", rows.getChildCount() >= 4);
                for (int i = 0; i < rows.getChildCount(); i++) {
                    assertFalse("row " + i + " must be blocked", rows.getChildAt(i).isEnabled());
                }
            });
        }
    }

    @Test public void hubSurvivesRecreationWithoutLosingItsRows() {
        try (ActivityScenario<BackupActivity> screen = ActivityScenario.launch(BackupActivity.class)) {
            int[] before = new int[1];
            screen.onActivity(a -> before[0] = ((LinearLayout) a.findViewById(R.id.backup_hub_rows)).getChildCount());
            screen.recreate();
            screen.onActivity(a ->
                    assertEquals(before[0], ((LinearLayout) a.findViewById(R.id.backup_hub_rows)).getChildCount()));
        }
    }

    @Test public void createBackupRefusesAPasswordTheNodeTokeniserWouldRewrite() {
        try (ActivityScenario<BackupCreateActivity> screen = ActivityScenario.launch(BackupCreateActivity.class)) {
            screen.onActivity(activity -> {
                EditText name = activity.findViewById(R.id.backup_create_name);
                EditText password = activity.findViewById(R.id.backup_create_password);
                EditText confirm = activity.findViewById(R.id.backup_create_confirm);
                Button go = activity.findViewById(R.id.backup_create_go);

                // A default name is offered, and it must be one the node can actually be given.
                assertFalse(name.getText().toString().isEmpty());
                assertTrue(com.eurobuddha.minimacore.main.ResyncJob.validFilename(name.getText().toString()));

                // 'a:b' is the case that silently becomes 'a : b' inside the node.
                password.setText("a:b");
                confirm.setText("a:b");
                go.performClick();
                assertNotNull("a rewritten password must be refused", password.getError());

                // Matching, legal password, but the confirm field disagrees.
                password.setText("pass123");
                confirm.setText("pass124");
                go.performClick();
                assertNull(password.getError());
                assertNotNull("mismatched confirmation must be refused", confirm.getError());
            });
        }
    }

    @Test public void createBackupNeverStartsWhileTheNodeIsNotAcceptingCommands() {
        try (ActivityScenario<BackupCreateActivity> screen = ActivityScenario.launch(BackupCreateActivity.class)) {
            screen.onActivity(activity -> {
                ((EditText) activity.findViewById(R.id.backup_create_password)).setText("pass123");
                ((EditText) activity.findViewById(R.id.backup_create_confirm)).setText("pass123");
                activity.findViewById(R.id.backup_create_go).performClick();
                TextView status = activity.findViewById(R.id.backup_create_status);
                assertFalse("the gate must be stated, not silently ignored",
                        status.getText().toString().isEmpty());
                assertEquals(View.GONE, activity.findViewById(R.id.backup_create_progress).getVisibility());
                // Nothing was produced, so nothing may be offered for export.
                assertEquals(View.GONE, activity.findViewById(R.id.backup_create_export).getVisibility());
                assertEquals(View.GONE, activity.findViewById(R.id.backup_create_path).getVisibility());
            });
        }
    }

    @Test public void restoreRefusesToRunWithNoFileChosen() {
        try (ActivityScenario<RestoreFileActivity> screen = ActivityScenario.launch(RestoreFileActivity.class)) {
            screen.onActivity(activity -> {
                ((EditText) activity.findViewById(R.id.backup_restore_password)).setText("pass123");
                activity.findViewById(R.id.backup_restore_go).performClick();
                TextView status = activity.findViewById(R.id.backup_restore_status);
                assertTrue(status.getText().toString().toLowerCase().contains("choose"));
            });
        }
    }

    @Test public void restoreOnlyAsksForAHostWhenTheBackupNeedsCatchingUp() {
        try (ActivityScenario<RestoreFileActivity> screen = ActivityScenario.launch(RestoreFileActivity.class)) {
            screen.onActivity(activity -> {
                View hostRow = activity.findViewById(R.id.backup_restore_host_row);
                assertEquals("a local restore has no host", View.GONE, hostRow.getVisibility());
                ((android.widget.RadioButton) activity.findViewById(R.id.backup_restore_mode_resync))
                        .setChecked(true);
                assertEquals(View.VISIBLE, hostRow.getVisibility());
            });
        }
    }
}
