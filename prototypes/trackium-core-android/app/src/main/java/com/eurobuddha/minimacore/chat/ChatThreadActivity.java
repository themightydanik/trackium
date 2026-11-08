package com.eurobuddha.minimacore.chat;

import androidx.appcompat.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.widget.ImageButton;

import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.i18n.LanguageDialog;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import com.eurobuddha.minimacore.utils.MinimaCMD;
import com.google.android.material.floatingactionbutton.FloatingActionButton;
import com.google.zxing.BarcodeFormat;
import com.journeyapps.barcodescanner.BarcodeEncoder;

import org.minima.utils.json.JSONObject;

import java.text.DateFormat;
import java.util.ArrayList;
import java.util.Date;

/**
 * One conversation — messenger-grade: bubbles with day separators and delivery ticks
 * (🕓 sending, ✓ held at a mailbox, ✓✓ delivered direct), a pill input bar, and a
 * toolbar menu (rename / view address / delete). Sends ride
 * `keets action:send to:<pubkey> datahex:<schema json>`; inbound arrives via ChatDrainer.
 */
public class ChatThreadActivity extends AppCompatActivity {

    private final java.util.Set<AlertDialog> dialogs = new java.util.HashSet<>();
    private LanguageDialog dialog() {
        return new LanguageDialog(this) {
            @Override public AlertDialog create() {
                AlertDialog value = super.create();
                dialogs.add(value);
                value.setOnDismissListener(d -> dialogs.remove(value));
                return value;
            }
        };
    }


    private void showFailure(CharSequence message) {
        if (isFinishing() || isDestroyed()) return;
        ChatFailureDialog.show(this, dialog(), message);
    }

    /** Pubkey of the thread currently on screen, else null - ChatDrainer stays silent for it. */
    static volatile String sForegroundPubkey = null;

    private String mPubkey;
    private MsgAdapter mAdapter;
    private ChatFiles mFiles;
    private Toolbar mToolbar;
    private ActivityResultLauncher<String> mPickImage;
    private final Runnable mOnNewMessage = () -> runOnUiThread(() -> {
        if (isFinishing() || isDestroyed()) return;
        refreshTitle();
        ChatDb.get(this).markThreadRead(mPubkey);
        sendReadReceipt();
        mAdapter.reload();
    });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_chat_thread);
        Language.apply(findViewById(android.R.id.content));

        mPubkey = getIntent().getStringExtra("pubkey");
        if (mPubkey == null) { finish(); return; }
        //Keets transport off (Startup Params): nothing here can send or fetch. Reached only via a
        //stale notification or a saved shortcut - the Chat tab itself is gone.
        if (!com.eurobuddha.minimacore.main.StartupMode.keetsEnabled(getSharedPreferences("main_prefs", MODE_PRIVATE))) {
            Toast.makeText(this, Language.msg(l10n_chat_keets_off), Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        mPickImage = registerForActivityResult(new ActivityResultContracts.GetContent(),
                uri -> { if (uri != null) sendImage(uri); });

        mToolbar = findViewById(R.id.chat_thread_toolbar);
        com.eurobuddha.minimacore.utils.KeyboardInsets.install(this, findViewById(R.id.chat_thread_main), mToolbar);
        setSupportActionBar(mToolbar);
        refreshTitle();
        getSupportActionBar().setDisplayHomeAsUpEnabled(true);
        mToolbar.setNavigationOnClickListener(v -> finish());

        ListView list = findViewById(R.id.chat_msgs);
        mAdapter = new MsgAdapter();
        mFiles = new ChatFiles(this,mPubkey,()->mAdapter.reload());
        list.setAdapter(mAdapter);

        ImageButton attach = findViewById(R.id.chat_attach);
        attach.setOnClickListener(v -> dialog()
                .setItems(new CharSequence[]{Language.msg(l10n_media_photo), Language.msg(l10n_media_voice), Language.msg(l10n_chat_pay_action), Language.msg(l10n_chat_request_pay), Language.msg(R.string.chat_files_attach), Language.msg(R.string.chat_files_title)}, (d, which) -> {
                    if (which == 0) mPickImage.launch("image/*");
                    else if (which == 1) startVoiceNote();
                    else if (which == 2) startPayment();
                    else if (which == 3) requestPayAddr(true);
                    else if (which == 4) mFiles.pick();
                    else mFiles.transfers();
                }).show());

        EditText input = findViewById(R.id.chat_input);
        FloatingActionButton send = findViewById(R.id.chat_send);
        send.setOnClickListener(v -> {
            String text = input.getText().toString().trim();
            if (text.equals("")) return;
            input.setText("");
            sendMessage(text);
        });
    }

    @Override public void onConfigurationChanged(android.content.res.Configuration config) {
        super.onConfigurationChanged(config);
        Language.configurationChanged(this);
        if (mToolbar != null) { refreshTitle(); refreshMenu(); }
        if (mAdapter != null) mAdapter.notifyDataSetChanged();
    }
    private void refreshMenu() {
        android.view.Menu menu = mToolbar.getMenu();
        if (menu.findItem(R.id.chatmenu_rename) != null) menu.findItem(R.id.chatmenu_rename).setTitle(Language.text(this, l10n_chat_rename_contact));
        if (menu.findItem(R.id.chatmenu_address) != null) menu.findItem(R.id.chatmenu_address).setTitle(Language.text(this, l10n_chat_view_address));
        if (menu.findItem(R.id.chatmenu_clear) != null) menu.findItem(R.id.chatmenu_clear).setTitle(Language.text(this, l10n_chat_delete_chat));
        if (menu.findItem(R.id.chatmenu_delete) != null) menu.findItem(R.id.chatmenu_delete).setTitle(Language.text(this, l10n_chat_delete_contact));
    }

    private void refreshTitle() {
        String name = ChatDb.get(this).contactName(mPubkey);
        CharSequence title = ChatDb.unnamedContact(mPubkey, name) ? Language.msg(l10n_chat_new_contact) : name;
        getSupportActionBar().setTitle(title);
        Language.toolbarTitle(mToolbar, title);
    }

    @Override public boolean onCreateOptionsMenu(android.view.Menu menu) {
        getMenuInflater().inflate(R.menu.chat_thread_menu, menu);
        refreshMenu();
        return true;
    }
    @Override public boolean onOptionsItemSelected(android.view.MenuItem item) {
        return onMenu(item) || super.onOptionsItemSelected(item);
    }
    private boolean onMenu(android.view.MenuItem item) {
        int id = item.getItemId();
        if (id == R.id.chatmenu_rename) {
            EditText input = new EditText(this);
            String cur = ChatDb.get(this).contactName(mPubkey);
            input.setText(ChatDb.unnamedContact(mPubkey, cur) ? "" : cur);
            dialog()
                    .setTitle(Language.msg(l10n_chat_contact_name))
                    .setView(input)
                    .setPositiveButton(Language.msg(l10n_common_save), (d, w) -> {
                        ChatDb.get(this).putContact(mPubkey, input.getText().toString().trim());
                        refreshTitle();
                    })
                    .setNegativeButton(Language.msg(l10n_common_cancel), null)
                    .show();
            return true;
        }
        if (id == R.id.chatmenu_address) {
            View v = LayoutInflater.from(this).inflate(R.layout.dialog_chat_identity, null);
            Language.apply(v);
            ((TextView) v.findViewById(R.id.identity_address)).setText(mPubkey);
            v.findViewById(R.id.identity_name).setVisibility(View.GONE);
            try {
                Bitmap bm = new BarcodeEncoder().encodeBitmap(mPubkey, BarcodeFormat.QR_CODE, 480, 480);
                ((ImageView) v.findViewById(R.id.identity_qr)).setImageBitmap(bm);
            } catch (Exception e) {}
            v.findViewById(R.id.identity_copy).setOnClickListener(b -> {
                ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                cm.setPrimaryClip(ClipData.newPlainText("keets address", mPubkey));
                Toast.makeText(this, Language.msg(l10n_wallet_address_copied), Toast.LENGTH_SHORT).show();
            });
            dialog().setTitle(Language.msg(l10n_chat_contact_address)).setView(v)
                    .setPositiveButton(Language.msg(l10n_chat_done), null).show();
            return true;
        }
        if (id == R.id.chatmenu_clear) {
            dialog()
                    .setTitle(Language.msg(l10n_chat_delete_chat))
                    .setMessage(Language.msg(l10n_chat_clear_thread))
                    .setPositiveButton(Language.msg(l10n_chat_delete_chat), (d, w) -> {
                        ChatDb.get(this).clearMessages(mPubkey);
                        finish();
                    })
                    .setNegativeButton(Language.msg(l10n_common_cancel), null)
                    .show();
            return true;
        }
        if (id == R.id.chatmenu_delete) {
            dialog()
                    .setTitle(Language.msg(l10n_chat_delete_contact))
                    .setMessage(Language.msg(l10n_chat_remove_thread))
                    .setPositiveButton(Language.msg(l10n_chat_delete_contact), (d, w) -> {
                        ChatDb.get(this).removeContact(mPubkey);
                        finish();
                    })
                    .setNegativeButton(Language.msg(l10n_common_cancel), null)
                    .show();
            return true;
        }
        return false;
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (mPubkey == null || mAdapter == null) return;
        sForegroundPubkey = mPubkey;
        try {
            ((android.app.NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).cancel("keetchat", 3);
        } catch (Exception ignored) {}
        refreshTitle();
        ChatDb.get(this).markThreadRead(mPubkey);
        sendReadReceipt();
        mAdapter.reload();
        ChatDrainer.UI_LISTENERS.add(mOnNewMessage);
    }

    @Override
    protected void onPause() {
        super.onPause();
        sForegroundPubkey = null;
        ChatDrainer.UI_LISTENERS.remove(mOnNewMessage);
    }

    /** Tell the peer we read up to the newest incoming message (blue ticks their side). */
    private void sendReadReceipt() {
        new Thread(() -> {
            ChatDb db = ChatDb.get(this);
            ChatDb.Msg latest = db.latestIncoming(mPubkey);
            if (latest == null || latest.msgid.equals(db.lastReceipt(mPubkey))) return;
            db.setLastReceipt(mPubkey, latest.msgid);
            org.minima.utils.json.JSONObject r = ChatSchema.base("", "", "");
            r.put("state", "read");
            r.put("ref", latest.msgid);
            MinimaCMD.execute("keets action:send to:" + mPubkey + " datahex:" + ChatSchema.toDataHex(r.toString()));
        }, "chat-receipt").start();
    }

    /** Ask the peer for a Minima pay address (their node auto-answers). */
    private void requestPayAddr(boolean zToast) {
        new Thread(() -> {
            org.minima.utils.json.JSONObject r = ChatSchema.base("", "", "");
            r.put("state", "payaddr-req");
            MinimaCMD.execute("keets action:send to:" + mPubkey + " datahex:" + ChatSchema.toDataHex(r.toString()));
        }, "chat-payaddr-req").start();
        if (zToast) Toast.makeText(this, Language.msg(l10n_chat_address_requested), Toast.LENGTH_SHORT).show();
    }

    // ---- payments -------------------------------------------------------------
    private void startPayment() {
        String payaddr = ChatDb.get(this).contactPayAddr(mPubkey);
        if (payaddr.equals("")) {
            requestPayAddr(false);
            Toast.makeText(this, Language.msg(l10n_chat_no_pay_address), Toast.LENGTH_LONG).show();
            return;
        }
        View v = getLayoutInflater().inflate(R.layout.dialog_chat_pay, null);
        Language.apply(v);
        ((TextView) v.findViewById(R.id.pay_to)).setText(payaddr);
        dialog()
                .setTitle(Language.msg(l10n_chat_send_payment))
                .setView(v)
                .setPositiveButton(Language.msg(l10n_wallet_send), (d, w) -> {
                    String amt = ((EditText) v.findViewById(R.id.pay_amount)).getText().toString().trim();
                    if (!amt.matches("[0-9]+(\\.[0-9]+)?") || amt.equals("0")) {
                        Toast.makeText(this, Language.msg(l10n_chat_valid_amount), Toast.LENGTH_SHORT).show();
                        return;
                    }
                    boolean usd = ((android.widget.RadioButton) v.findViewById(R.id.pay_mxusd)).isChecked();
                    doPayment(payaddr, amt, usd ? MXUSD_TOKENID : "0x00", usd ? "MxUSD" : "Minima");
                })
                .setNegativeButton(Language.msg(l10n_common_cancel), null)
                .show();
    }

    /** MxUSD, the Minima dollar-pegged token - the one id, whatever a bridge calls it. */
    static final String MXUSD_TOKENID = "0x7D39745FBD29049BE29850B55A18BF550E4D442F930F86266E34193D89042A90";

    private void doPayment(String zAddr, String zAmt, String zTokenId, String zTokName) {
        Toast.makeText(this, Language.msg(l10n_chat_sending_amount_token, zAmt, zTokName), Toast.LENGTH_SHORT).show();
        String cmd = "send address:" + zAddr + " amount:" + zAmt + ("0x00".equals(zTokenId) ? "" : " tokenid:" + zTokenId);
        MinimaCMD.runMinima(cmd, zResult -> {
            boolean ok = (Boolean) zResult.getOrDefault("status", false);
            if (!ok) {
                runOnUiThread(() -> showFailure(Language.msg(l10n_chat_payment_failed, String.valueOf(zResult.get("error")))));
                return;
            }
            String txid = "";
            try { txid = "" + ((JSONObject) zResult.get("response")).get("txpowid"); } catch (Exception e) {}

            SharedPreferences prefs = getSharedPreferences("main_prefs", Context.MODE_PRIVATE);
            org.minima.utils.json.JSONObject pm = ChatSchema.base(prefs.getString("chat_name", ""), "", "");
            pm.put("state", "payment");
            pm.put("amt", zAmt);
            pm.put("tok", zTokenId);
            pm.put("tokname", zTokName);
            pm.put("txid", txid);
            pm.put("addr", zAddr);
            String payload = pm.toString();
            String msgid = ChatSchema.decode(payload).id;

            ChatDb.Msg m = new ChatDb.Msg();
            m.msgid = msgid; m.pubkey = mPubkey; m.incoming = false;
            m.body = ""; m.state = "payment"; m.amt = zAmt; m.tokname = zTokName; m.txid = txid;
            m.ts = System.currentTimeMillis(); m.via = ""; m.read = true;
            ChatDb.get(this).addMessage(m);
            runOnUiThread(() -> mAdapter.reload());

            MinimaCMD.runMinima("keets action:send to:" + mPubkey + " datahex:" + ChatSchema.toDataHex(payload),
                    zR2 -> runOnUiThread(() -> {
                        boolean ok2 = (Boolean) zR2.getOrDefault("status", false);
                        String via = ok2 ? (String) ((JSONObject) zR2.get("response")).get("delivered") : "FAILED";
                        ChatDb.get(this).setVia(msgid, via);
                        mAdapter.reload();
                        // The on-chain send already succeeded (txid stored); surface it if the keets
                        // delivery of the payment receipt failed, like the image/voice/text paths do.
                        if (!ok2) showFailure(Language.msg(l10n_chat_send_failed,
                                ChatMessages.message(String.valueOf(zR2.get("error")))));
                    }));
        });
    }

    // ---- photos ---------------------------------------------------------------
    private void sendImage(android.net.Uri zUri) {
        new Thread(() -> {
            try {
                byte[] jpeg = ChatPhoto.encodeForSend(this, zUri);
                java.io.File tmp = new java.io.File(getCacheDir(), "chat-out-" + System.currentTimeMillis() + ".jpg");
                try (java.io.FileOutputStream fos = new java.io.FileOutputStream(tmp)) {
                    fos.write(jpeg);
                }

                //file: hand-off — megabyte params break the command tokenizer
                JSONObject pub = MinimaCMD.execute("keets action:publish path:/chat/img-" +
                        System.currentTimeMillis() + ".jpg file:" + tmp.getAbsolutePath());
                tmp.delete();
                if (!(Boolean) pub.getOrDefault("status", false)) throw new Exception("" + pub.get("error"));
                String url = (String) ((JSONObject) pub.get("response")).get("url");

                SharedPreferences prefs = getSharedPreferences("main_prefs", Context.MODE_PRIVATE);
                org.minima.utils.json.JSONObject im = ChatSchema.base(prefs.getString("chat_name", ""), "", url);
                im.put("state", "image");
                String payload = im.toString();
                String msgid = ChatSchema.decode(payload).id;

                ChatDb.Msg m = new ChatDb.Msg();
                m.msgid = msgid; m.pubkey = mPubkey; m.incoming = false;
                m.body = ""; m.state = "image"; m.ref = url;
                m.ts = System.currentTimeMillis(); m.via = ""; m.read = true;
                ChatDb.get(this).addMessage(m);
                runOnUiThread(() -> mAdapter.reload());

                JSONObject sr = MinimaCMD.execute("keets action:send to:" + mPubkey +
                        " datahex:" + ChatSchema.toDataHex(payload));
                String via = (Boolean) sr.getOrDefault("status", false)
                        ? (String) ((JSONObject) sr.get("response")).get("delivered") : "FAILED";
                ChatDb.get(this).setVia(msgid, via);
                runOnUiThread(() -> {
                    mAdapter.reload();
                    if ("FAILED".equals(via)) showFailure(Language.msg(l10n_chat_send_failed,
                            ChatMessages.message(String.valueOf(sr.get("error")))));
                });
            } catch (Exception exc) {
                runOnUiThread(() -> showFailure(Language.msg(l10n_chat_photo_failed, ChatMessages.error(exc))));
            }
        }, "chat-image-send").start();
    }

    // ---- voice notes (ported from Parlons ChatActivity) -------------------

    private static final int REQ_RECORD_AUDIO = 73;
    private VoiceNote mActiveRecorder;
    private android.media.MediaPlayer mPlayer;
    private String mPlayingRef = "";
    private String mLoadingRef = "";

    private int dp(int zDp) {
        return Math.round(zDp * getResources().getDisplayMetrics().density);
    }

    private void startVoiceNote() {
        if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{android.Manifest.permission.RECORD_AUDIO},
                    REQ_RECORD_AUDIO);
            return;
        }
        recordVoiceDialog();
    }

    @Override
    public void onRequestPermissionsResult(int zReq, String[] zPerms, int[] zGrants) {
        super.onRequestPermissionsResult(zReq, zPerms, zGrants);
        if (zReq == REQ_RECORD_AUDIO && zGrants.length > 0) {
            if (zGrants[0] == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                recordVoiceDialog();
            } else {
                Toast.makeText(this, Language.msg(l10n_chat_microphone_permission),
                        Toast.LENGTH_SHORT).show();
            }
        }
    }

    private void recordVoiceDialog() {
        mActiveRecorder = VoiceRecordDialog.show(this,
                (bytes, mime, secs, wave) -> sendAudio(bytes, mime, secs, wave));
    }

    /** Publish the note over keets and send a state:"audio" message whose body
     *  is "M:SS|waveformhex" - the Parlons caption convention, so every
     *  flavour draws the real shape without decoding audio. */
    private void sendAudio(final byte[] zBytes, final String zMime, final int zSecs, final String zWave) {
        Toast.makeText(this, Language.msg(l10n_chat_sending_voice), Toast.LENGTH_SHORT).show();
        new Thread(() -> {
            try {
                String ext = zMime.contains("ogg") ? ".ogg" : ".m4a";
                java.io.File tmp = new java.io.File(getCacheDir(),
                        "chat-vn-" + System.currentTimeMillis() + ext);
                java.io.FileOutputStream fos = new java.io.FileOutputStream(tmp);
                fos.write(zBytes);
                fos.close();

                //file: hand-off — megabyte params break the command tokenizer
                JSONObject pub = MinimaCMD.execute("keets action:publish path:/chat/vn-" +
                        System.currentTimeMillis() + ext + " file:" + tmp.getAbsolutePath());
                tmp.delete();
                if (!(Boolean) pub.getOrDefault("status", false)) throw new Exception("" + pub.get("error"));
                String url = (String) ((JSONObject) pub.get("response")).get("url");

                String cap = VoiceRecordDialog.fmtSecs(zSecs)
                        + (zWave == null || zWave.isEmpty() ? "" : "|" + zWave);
                SharedPreferences prefs = getSharedPreferences("main_prefs", Context.MODE_PRIVATE);
                org.minima.utils.json.JSONObject im = ChatSchema.base(prefs.getString("chat_name", ""), cap, url);
                im.put("state", "audio");
                String payload = im.toString();
                String msgid = ChatSchema.decode(payload).id;

                ChatDb.Msg m = new ChatDb.Msg();
                m.msgid = msgid; m.pubkey = mPubkey; m.incoming = false;
                m.body = cap; m.state = "audio"; m.ref = url;
                m.ts = System.currentTimeMillis(); m.via = ""; m.read = true;
                ChatDb.get(this).addMessage(m);
                runOnUiThread(() -> mAdapter.reload());

                JSONObject sr = MinimaCMD.execute("keets action:send to:" + mPubkey +
                        " datahex:" + ChatSchema.toDataHex(payload));
                String via = (Boolean) sr.getOrDefault("status", false)
                        ? (String) ((JSONObject) sr.get("response")).get("delivered") : "FAILED";
                ChatDb.get(this).setVia(msgid, via);
                runOnUiThread(() -> {
                    mAdapter.reload();
                    if ("FAILED".equals(via)) showFailure(Language.msg(l10n_chat_send_failed,
                            ChatMessages.message(String.valueOf(sr.get("error")))));
                });
            } catch (Exception exc) {
                runOnUiThread(() -> showFailure(Language.msg(l10n_chat_voice_failed, ChatMessages.error(exc))));
            }
        }, "chat-voice-send").start();
    }

    /** Play/pause one note; a second tap pauses, a different note switches. */
    private void toggleAudio(String zRef, Runnable zOnState) {
        if (mPlayer != null && zRef.equals(mPlayingRef)) {
            if (mPlayer.isPlaying()) {
                mPlayer.pause();
            } else {
                mPlayer.start();
            }
            zOnState.run();
            return;
        }
        if (zRef.equals(mLoadingRef)) {
            return;   // fetch already in flight - a double-tap must not double-play
        }
        stopAudio();
        mLoadingRef = zRef;
        ChatAudio.load(this, zRef, f -> {
            if (!zRef.equals(mLoadingRef) || isDestroyed() || isFinishing()) {
                return;   // superseded by another tap, or the screen is gone
            }
            mLoadingRef = "";
            if (f == null) {
                Toast.makeText(this, Language.msg(l10n_chat_voice_unavailable), Toast.LENGTH_SHORT).show();
                return;
            }
            try {
                mPlayer = new android.media.MediaPlayer();
                mPlayer.setAudioAttributes(new android.media.AudioAttributes.Builder()
                        .setUsage(android.media.AudioAttributes.USAGE_MEDIA)
                        .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build());
                mPlayer.setDataSource(f.getAbsolutePath());
                mPlayer.prepare();
                mPlayingRef = zRef;
                mPlayer.setOnCompletionListener(mp -> {
                    mPlayingRef = "";
                    zOnState.run();
                });
                mPlayer.start();
                zOnState.run();
            } catch (Exception e) {
                stopAudio();
                Toast.makeText(this, Language.msg(l10n_chat_playback_failed), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void stopAudio() {
        mLoadingRef = "";
        if (mPlayer != null) {
            try {
                mPlayer.release();
            } catch (Exception ignored) {
            }
            mPlayer = null;
        }
        mPlayingRef = "";
    }

    @Override
    protected void onDestroy() {
        for (AlertDialog value : new java.util.ArrayList<>(dialogs)) value.dismiss();
        dialogs.clear();
        if(mFiles!=null)mFiles.close();
        stopAudio();
        if (mActiveRecorder != null) {
            // the dialog's dismiss listener never fires on activity death -
            // without this the mic records on until the 60s cap
            mActiveRecorder.stopQuiet();
            mActiveRecorder = null;
        }
        super.onDestroy();
    }

    @Override protected void onActivityResult(int request,int result,Intent data) {
        super.onActivityResult(request,result,data);
        if(mFiles!=null)mFiles.result(request,result,data);
    }

    private void sendMessage(String zText) {
        SharedPreferences prefs = getSharedPreferences("main_prefs", Context.MODE_PRIVATE);
        String myname = prefs.getString("chat_name", "");
        String payload = ChatSchema.encode(myname, zText, "");
        String msgid = ChatSchema.decode(payload).id;

        // write-before-send: the message exists locally even if the send fails
        ChatDb.Msg m = new ChatDb.Msg();
        m.msgid = msgid; m.pubkey = mPubkey; m.incoming = false;
        m.body = zText; m.name = myname; m.ref = "";
        m.ts = System.currentTimeMillis(); m.via = ""; m.read = true;
        ChatDb.get(this).addMessage(m);
        mAdapter.reload();

        MinimaCMD.runMinima("keets action:send to:" + mPubkey + " datahex:" + ChatSchema.toDataHex(payload),
                zResult -> runOnUiThread(() -> {
                    boolean ok = (Boolean) zResult.getOrDefault("status", false);
                    String via = "FAILED";
                    if (ok) via = (String) ((JSONObject) zResult.get("response")).get("delivered");
                    ChatDb.get(this).setVia(msgid, via);
                    mAdapter.reload();
                    if (!ok) showFailure(Language.msg(l10n_chat_send_failed, ChatMessages.message(String.valueOf(zResult.get("error")))));
                }));
    }

    // ---- messages + day separators ------------------------------------------
    private static class Item {
        ChatDb.Msg msg;      // null = date separator
        long day;
    }

    private class MsgAdapter extends BaseAdapter {
        private ArrayList<Item> mItems = new ArrayList<>();


        void reload() {
            new Thread(() -> {
                ArrayList<ChatDb.Msg> msgs = ChatDb.get(ChatThreadActivity.this).thread(mPubkey);
                ArrayList<Item> items = new ArrayList<>();
                long lastDay = 0;
                for (ChatDb.Msg m : msgs) {
                    if (lastDay == 0 || !ChatUi.sameDay(lastDay, m.ts)) {
                        Item sep = new Item();
                        sep.day = m.ts;
                        items.add(sep);
                    }
                    lastDay = m.ts;
                    Item it = new Item();
                    it.msg = m;
                    items.add(it);
                }
                runOnUiThread(() -> { if (!isFinishing() && !isDestroyed()) { mItems = items; notifyDataSetChanged(); } });
            }, "chat-thread-load").start();
        }

        @Override public int getCount() { return mItems.size(); }
        @Override public Object getItem(int position) { return mItems.get(position); }
        @Override public long getItemId(int position) { return position; }
        @Override public int getViewTypeCount() { return 2; }
        @Override public int getItemViewType(int position) { return mItems.get(position).msg == null ? 0 : 1; }

        @Override
        public View getView(int position, View convertView, ViewGroup parent) {
            Item it = mItems.get(position);

            if (it.msg == null) {
                View row = convertView != null ? convertView
                        : getLayoutInflater().inflate(R.layout.chat_date_row, parent, false);
                ((TextView) row.findViewById(R.id.date_text)).setText(ChatUi.dayLabel(ChatThreadActivity.this, it.day));
                return row;
            }

            ChatDb.Msg m = it.msg;
            View row = convertView != null ? convertView
                    : getLayoutInflater().inflate(R.layout.chat_msg_row, parent, false);
            Language.apply(row);

            LinearLayout rowBox = row.findViewById(R.id.msg_row);
            LinearLayout bubble = row.findViewById(R.id.msg_bubble);
            ImageView image = row.findViewById(R.id.msg_image);
            TextView body = row.findViewById(R.id.msg_body);
            TextView attach = row.findViewById(R.id.msg_attach);
            TextView meta = row.findViewById(R.id.msg_meta);

            rowBox.setGravity(m.incoming ? Gravity.START : Gravity.END);
            bubble.setBackgroundResource(m.incoming ? R.drawable.chat_bubble_in : R.drawable.chat_bubble_out);
            int fg = m.incoming ? getColor(R.color.core_text) : Color.WHITE;
            body.setTextColor(fg);
            meta.setTextColor(fg);
            attach.setTextColor(fg);

            LinearLayout audio = row.findViewById(R.id.msg_audio);
            image.setVisibility(View.GONE);
            image.setTag(null);
            attach.setVisibility(View.GONE);
            audio.setVisibility(View.GONE);
            body.setVisibility(View.VISIBLE);

            if ("file".equals(m.state)) {
                body.setText("📎 " + m.body);
                attach.setVisibility(View.VISIBLE);
                Language.setText(attach,Language.msg(R.string.chat_files_open));
                attach.setOnClickListener(v -> mFiles.showOffer(m.ref));
            } else if ("audio".equals(m.state) && m.ref != null && !m.ref.equals("")) {
                // body is "M:SS|waveformhex" (the Parlons caption convention)
                String dur = m.body;
                String waveHex = "";
                int bar = m.body.indexOf('|');
                if (bar > 0) {
                    dur = m.body.substring(0, bar);
                    waveHex = m.body.substring(bar + 1);
                }
                body.setVisibility(View.GONE);
                audio.setVisibility(View.VISIBLE);
                TextView btn = row.findViewById(R.id.msg_audio_btn);
                WaveformView wv = row.findViewById(R.id.msg_audio_wave);
                TextView time = row.findViewById(R.id.msg_audio_time);
                btn.setTextColor(fg);
                time.setTextColor(fg);
                wv.setInk(fg);
                wv.setBars(waveHex.isEmpty() ? new int[WaveformView.BAR_COUNT]
                        : WaveformView.decode(waveHex));
                time.setText(dur);
                final String ref = m.ref;
                btn.setText(ref.equals(mPlayingRef) && mPlayer != null && mPlayer.isPlaying()
                        ? "\u23f8" : "\u25b6");
                Language.description(btn, Language.msg(ref.equals(mPlayingRef) && mPlayer != null && mPlayer.isPlaying()
                        ? l10n_chat_pause_voice : l10n_chat_play_voice));
                View.OnClickListener play = v ->
                        toggleAudio(ref, () -> notifyDataSetChanged());
                btn.setOnClickListener(play);
                audio.setOnClickListener(play);
            } else if ("image".equals(m.state) && m.ref != null && !m.ref.equals("")) {
                body.setVisibility(m.body.equals("") ? View.GONE : View.VISIBLE);
                Language.setText(body, m.body);
                linkify(body);
                image.setVisibility(View.VISIBLE);
                image.setImageResource(android.R.drawable.stat_sys_download);
                final String ref = m.ref;
                image.setTag(ref);
                ChatImages.load(ChatThreadActivity.this, ref, bm -> {
                    if (bm != null && ref.equals(image.getTag())) image.setImageBitmap(bm);
                });
                image.setOnClickListener(v -> {
                    Intent viewer = new Intent(ChatThreadActivity.this, ChatImageActivity.class);
                    viewer.putExtra("ref", ref);
                    viewer.putExtra("caption", m.body);
                    startActivity(viewer);
                });
            } else if ("payment".equals(m.state)) {
                Language.setText(body, Language.join("💸 ", Language.msg(m.incoming ? l10n_chat_payment_received : l10n_chat_payment_sent), "\n",
                        m.amt, " ", (m.tokname.equals("") ? "Minima" : m.tokname)));
                attach.setVisibility(View.VISIBLE);
                Language.setText(attach, Language.msg(l10n_chat_tap_txid));
                final String txid = m.txid;
                attach.setOnClickListener(v -> dialog()
                        .setTitle(Language.msg(l10n_chat_txid_title))
                        .setMessage(txid)
                        .setPositiveButton(Language.msg(l10n_wallet_copy), (d, w) -> {
                            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                            cm.setPrimaryClip(ClipData.newPlainText("txid", txid));
                            Toast.makeText(ChatThreadActivity.this, Language.msg(l10n_chat_txid_copied), Toast.LENGTH_SHORT).show();
                        })
                        .setNegativeButton(Language.msg(l10n_language_close), null)
                        .show());
            } else {
                Language.setText(body, m.body);
                linkify(body);
                if (m.ref != null && !m.ref.equals("")) {
                    attach.setVisibility(View.VISIBLE);
                    Language.setText(attach, Language.msg(l10n_chat_attachment_copy));
                    final String ref = m.ref;
                    attach.setOnClickListener(v -> {
                        // the FULL keets:// url lands on the clipboard (never truncated)
                        ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                        cm.setPrimaryClip(ClipData.newPlainText("keets media url", ref));
                        Toast.makeText(ChatThreadActivity.this, Language.msg(l10n_chat_link_copied), Toast.LENGTH_SHORT).show();
                    });
                }
            }

            if (!"payment".equals(m.state) && !"audio".equals(m.state)) {
                // keep the bubble's long-press (copy / delete) working on top of tappable links
                body.setOnLongClickListener(v -> bubble.performLongClick());
            }

            //ticks: 🕓 sending · ✓ at mailbox · ✓✓ delivered · blue ✓✓ read by them
            CharSequence when = Language.stamp(m.ts, "Hm");
            if (m.incoming) {
                Language.setText(meta, when);
            } else if (m.peerread) {
                Language.setText(meta, Language.join(when, "  ✓✓"));
                meta.setTextColor(Color.parseColor("#7DD3FC"));
            } else {
                Language.setText(meta, Language.join(when, "  ", ChatUi.statusGlyph(m.via)));
            }

            //long-press: copy / delete (local)
            bubble.setOnLongClickListener(v -> {
                dialog()
                        .setItems(new CharSequence[]{Language.msg(l10n_chat_copy_text), Language.msg(l10n_chat_delete_local)}, (d, which) -> {
                            if (which == 0) {
                                ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                                cm.setPrimaryClip(ClipData.newPlainText("message", m.body));
                                Toast.makeText(ChatThreadActivity.this, Language.msg(l10n_history_copied), Toast.LENGTH_SHORT).show();
                            } else {
                                ChatDb.get(ChatThreadActivity.this).deleteMessage(m.msgid);
                                reload();
                            }
                        }).show();
                return true;
            });
            return row;
        }
    
        /** http(s) links in a message become tappable and open in the browser; the text itself is
         *  untouched, so copy still copies exactly what was sent. */
        private void linkify(TextView zBody) {
            android.text.util.Linkify.addLinks(zBody, android.text.util.Linkify.WEB_URLS);
            zBody.setLinkTextColor(zBody.getCurrentTextColor());
        }
}
}
