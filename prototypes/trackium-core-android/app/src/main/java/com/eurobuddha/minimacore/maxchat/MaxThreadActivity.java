package com.eurobuddha.minimacore.maxchat;

import androidx.appcompat.app.AlertDialog;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;

import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.i18n.LanguageDialog;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import com.eurobuddha.minimacore.chat.ChatUi;
import com.eurobuddha.minimacore.chat.ChatMessages;
import com.eurobuddha.minimacore.chat.ChatFailureDialog;
import com.eurobuddha.maxima.core.MaximaNode;
import com.eurobuddha.maxima.core.chat.ChatEngine;
import com.eurobuddha.maxima.core.chat.ChatMedia;
import com.eurobuddha.maxima.core.chat.ChatPay;
import com.eurobuddha.maxima.core.chat.Receipt;
import com.eurobuddha.maxima.core.contacts.Contact;

import java.text.DateFormat;
import java.util.ArrayList;
import java.util.List;

/**
 * One Parlons conversation, over the app's own Maxima transport (MaxChat).
 * Same screens and bubbles as the keets thread; the engine underneath is the
 * Parlons ChatEngine, so receipts and the resend ladder match what the peer's
 * Parlons app expects. v1 renders photos/payments as labelled text - the
 * Parlons media mesh is a follow-up.
 */
public class MaxThreadActivity extends AppCompatActivity {

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

    private SendDraft mSendDraft;
    private String mPeer;
    private MsgAdapter mAdapter;
    private final Runnable mOnChange = () -> runOnUiThread(() -> {
        ChatEngine chat = MaxChat.chat();
        if (chat != null) {
            chat.markRead(mPeer);
        }
        mAdapter.reload();
    });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_chat_thread);
        Language.apply(findViewById(android.R.id.content));

        mPeer = getIntent().getStringExtra("peer");
        if (mPeer == null) {
            finish();
            return;
        }

        Toolbar tb = findViewById(R.id.chat_thread_toolbar);
        // Same inset handling as the keets thread: without it the input row sits
        // under the gesture bar on tall screens (seen on the Fold).
        com.eurobuddha.minimacore.utils.KeyboardInsets.install(this,
                findViewById(R.id.chat_thread_main), tb);
        setSupportActionBar(tb);
        getSupportActionBar().setDisplayHomeAsUpEnabled(true);
        tb.setNavigationOnClickListener(v -> finish());
        // After setSupportActionBar the bar owns the title - set it THERE, or
        // the manifest label ("Minima Core") wins.
        getSupportActionBar().setTitle(title());
        Language.toolbarTitle(tb, title());
        getSupportActionBar().setSubtitle("Parlons");

        ListView list = findViewById(R.id.chat_msgs);
        mAdapter = new MsgAdapter();
        list.setAdapter(mAdapter);

        mPickImage = registerForActivityResult(
                new androidx.activity.result.contract.ActivityResultContracts.GetContent(),
                uri -> { if (uri != null) sendPhoto(uri); });
        EditText input = findViewById(R.id.chat_input);
        mSendDraft = new SendDraft(input);
        findViewById(R.id.chat_attach).setOnClickListener(v ->
                dialog()
                        .setItems(new CharSequence[]{Language.msg(l10n_media_photo), Language.msg(l10n_media_voice)}, (d, which) -> {
                            if (which == 0) mPickImage.launch("image/*");
                            else startVoiceNote();
                        }).show());
        findViewById(R.id.chat_send).setOnClickListener(v -> {
            String text = input.getText().toString().trim();
            if (text.isEmpty()) {
                return;
            }
            ChatEngine chat = MaxChat.chat();
            MaximaNode node = MaxChat.node();
            Contact c = node == null ? null : node.contact(mPeer);
            if (chat == null || c == null) {
                Toast.makeText(this, Language.msg(l10n_chat_transport_not_ready), Toast.LENGTH_SHORT).show();
                return;
            }
            final SendDraft.Submission submission = mSendDraft.begin();
            if (submission == null) return;
            new Thread(() -> {
                try {
                    chat.send(c, submission.text());
                } catch (Exception e) {
                    runOnUiThread(() -> {
                        if (isFinishing() || isDestroyed()) return;
                        mSendDraft.failed(submission);
                        showFailure(Language.msg(l10n_chat_send_failed, ChatMessages.error(e)));
                    });
                }
                runOnUiThread(() -> { if (!isFinishing() && !isDestroyed()) mAdapter.reload(); });
            }, "maxchat-send").start();
        });

        MaxChat.UI_LISTENERS.add(mOnChange);
        mOnChange.run();
    }

    @Override public void onConfigurationChanged(android.content.res.Configuration config) {
        super.onConfigurationChanged(config);
        Language.configurationChanged(this);
        Toolbar toolbar = findViewById(R.id.chat_thread_toolbar);
        getSupportActionBar().setTitle(title());
        Language.toolbarTitle(toolbar, title());
        refreshMenu(toolbar.getMenu());
        if (mAdapter != null) mAdapter.notifyDataSetChanged();
    }
    private void refreshMenu(android.view.Menu menu) {
        if (menu.findItem(R.id.maxmenu_clear) != null) menu.findItem(R.id.maxmenu_clear).setTitle(Language.text(this, l10n_chat_delete_chat));
        if (menu.findItem(R.id.maxmenu_delete) != null) menu.findItem(R.id.maxmenu_delete).setTitle(Language.text(this, l10n_chat_delete_contact));
    }

    @Override
    public boolean onCreateOptionsMenu(android.view.Menu menu) {
        getMenuInflater().inflate(R.menu.max_thread_menu, menu);
        refreshMenu(menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(android.view.MenuItem item) {
        int id = item.getItemId();
        if (id == R.id.maxmenu_clear) {
            dialog()
                    .setTitle(Language.msg(l10n_chat_delete_chat))
                    .setMessage(Language.msg(l10n_chat_clear_thread))
                    .setPositiveButton(Language.msg(l10n_chat_delete_chat), (d, w) -> new Thread(() -> {
                        try { MaxChat.clearConversation(mPeer); } catch (Exception ignored) {}
                        runOnUiThread(this::finish);
                    }, "maxchat-clear").start())
                    .setNegativeButton(Language.msg(l10n_common_cancel), null)
                    .show();
            return true;
        }
        if (id == R.id.maxmenu_delete) {
            dialog()
                    .setTitle(Language.msg(l10n_chat_delete_contact))
                    .setMessage(Language.msg(l10n_chat_remove_parlons))
                    .setPositiveButton(Language.msg(l10n_chat_delete_contact), (d, w) -> new Thread(() -> {
                        try { MaxChat.removeContact(mPeer); } catch (Exception ignored) {}
                        runOnUiThread(this::finish);
                    }, "maxchat-remove").start())
                    .setNegativeButton(Language.msg(l10n_common_cancel), null)
                    .show();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    @Override
    protected void onDestroy() {
        if (mSendDraft != null) mSendDraft.close();
        for (AlertDialog value : new java.util.ArrayList<>(dialogs)) value.dismiss();
        dialogs.clear();
        stopAudio();
        if (mActiveRecorder != null) {
            mActiveRecorder.stopQuiet();
            mActiveRecorder = null;
        }
        MaxChat.UI_LISTENERS.remove(mOnChange);
        super.onDestroy();
    }

    private androidx.activity.result.ActivityResultLauncher<String> mPickImage;
    private com.eurobuddha.minimacore.chat.VoiceNote mActiveRecorder;
    private android.media.MediaPlayer mPlayer;
    private String mPlayingRef = "";
    private String mLoadingRef = "";
    private static final int REQ_RECORD_AUDIO = 74;

    private void startVoiceNote() {
        if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{android.Manifest.permission.RECORD_AUDIO},
                    REQ_RECORD_AUDIO);
            return;
        }
        mActiveRecorder = com.eurobuddha.minimacore.chat.VoiceRecordDialog.show(this,
                (bytes, mime, secs, wave) -> sendMediaBytes(bytes, mime,
                        com.eurobuddha.minimacore.chat.VoiceRecordDialog.fmtSecs(secs)
                                + (wave == null || wave.isEmpty() ? "" : "|" + wave)));
    }

    @Override
    public void onRequestPermissionsResult(int zReq, String[] zPerms, int[] zGrants) {
        super.onRequestPermissionsResult(zReq, zPerms, zGrants);
        if (zReq == REQ_RECORD_AUDIO && zGrants.length > 0) {
            if (zGrants[0] == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                startVoiceNote();
            } else {
                Toast.makeText(this, Language.msg(l10n_chat_microphone_permission),
                        Toast.LENGTH_SHORT).show();
            }
        }
    }

    private void sendPhoto(android.net.Uri zUri) {
        new Thread(() -> {
            try {
                // shared pipeline: EXIF rotation + 1280px + JPEG q80
                byte[] jpeg = com.eurobuddha.minimacore.chat.ChatPhoto.encodeForSend(this, zUri);
                // sendMediaBytes toasts, so it must run on the main thread
                // (it spawns its own send thread for the slow publish)
                runOnUiThread(() -> sendMediaBytes(jpeg, "image/jpeg", ""));
            } catch (Exception e) {
                runOnUiThread(() -> showFailure(Language.msg(l10n_chat_photo_failed, ChatMessages.error(e))));
            }
        }, "maxchat-photo").start();
    }

    /** Publish + send any media through the engine (blocks on the mesh publish). */
    private void sendMediaBytes(byte[] zBytes, String zMime, String zCaption) {
        ChatEngine chat = MaxChat.chat();
        MaximaNode node = MaxChat.node();
        Contact c = node == null ? null : node.contact(mPeer);
        if (chat == null || c == null) {
            Toast.makeText(this, Language.msg(l10n_chat_transport_not_ready), Toast.LENGTH_SHORT).show();
            return;
        }
        Toast.makeText(this, Language.msg(l10n_chat_sending), Toast.LENGTH_SHORT).show();
        new Thread(() -> {
            try {
                chat.sendMedia(c, zBytes, zMime, zCaption);
            } catch (Exception e) {
                runOnUiThread(() -> showFailure(Language.msg(l10n_chat_send_failed, ChatMessages.error(e))));
            }
            runOnUiThread(mAdapter::reload);
        }, "maxchat-media-send").start();
    }

    private void toggleAudio(String zBody, Runnable zOnState) {
        final String ref = ChatMedia.ref(zBody);
        if (ref == null) {
            return;
        }
        if (mPlayer != null && ref.equals(mPlayingRef)) {
            if (mPlayer.isPlaying()) {
                mPlayer.pause();
            } else {
                mPlayer.start();
            }
            zOnState.run();
            return;
        }
        if (ref.equals(mLoadingRef)) {
            return;
        }
        stopAudio();
        mLoadingRef = ref;
        MaxMedia.load(this, zBody, f -> {
            if (!ref.equals(mLoadingRef) || isDestroyed() || isFinishing()) {
                return;
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
                mPlayingRef = ref;
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

    private CharSequence title() {
        MaximaNode node = MaxChat.node();
        Contact c = node == null ? null : node.contact(mPeer);
        return c != null && !c.name.isEmpty() ? c.name : Language.msg(l10n_chat_parlons_contact);
    }

    private static String ticks(ChatEngine.Entry zE) {
        if (!zE.mine) {
            return "";
        }
        String s = zE.state == null ? "" : zE.state;
        if (s.contains(Receipt.READ) || s.contains(Receipt.DELIVERED)) {
            return "  ✓✓";
        }
        if (s.contains(Receipt.SENT)) {
            return "  ✓";
        }
        return "  🕓";
    }

    private class MsgAdapter extends BaseAdapter {
        private ArrayList<Object> mItems = new ArrayList<>();   // Long day timestamp | Entry

        // Reloads race during a message burst; only the newest snapshot may land.
        private final java.util.concurrent.atomic.AtomicInteger mGen =
                new java.util.concurrent.atomic.AtomicInteger();

        void reload() {
            ChatEngine chat = MaxChat.chat();
            if (chat == null) {
                return;
            }
            final int gen = mGen.incrementAndGet();
            new Thread(() -> {
                List<ChatEngine.Entry> conv = chat.conversation(mPeer);
                ArrayList<Object> items = new ArrayList<>();
                long lastDay = 0;
                for (ChatEngine.Entry e : conv) {
                    if (lastDay == 0 || !ChatUi.sameDay(lastDay, e.time)) {
                        items.add(e.time);
                    }
                    lastDay = e.time;
                    items.add(e);
                }
                runOnUiThread(() -> {
                    if (gen != mGen.get() || isFinishing() || isDestroyed()) {
                        return;   // a newer snapshot is on its way
                    }
                    mItems = items;
                    notifyDataSetChanged();
                });
            }, "maxchat-thread-load").start();
        }

        @Override public int getCount() { return mItems.size(); }
        @Override public Object getItem(int position) { return mItems.get(position); }
        @Override public long getItemId(int position) { return position; }
        @Override public int getViewTypeCount() { return 2; }
        @Override public int getItemViewType(int position) {
            return mItems.get(position) instanceof Long ? 0 : 1;
        }

        @Override
        public View getView(int position, View convertView, ViewGroup parent) {
            Object it = mItems.get(position);
            if (it instanceof Long) {
                View row = convertView != null ? convertView
                        : getLayoutInflater().inflate(R.layout.chat_date_row, parent, false);
                ((TextView) row.findViewById(R.id.date_text)).setText(ChatUi.dayLabel(MaxThreadActivity.this, (Long) it));
                return row;
            }

            ChatEngine.Entry e = (ChatEngine.Entry) it;
            View row = convertView != null ? convertView
                    : getLayoutInflater().inflate(R.layout.chat_msg_row, parent, false);
            Language.apply(row);

            LinearLayout rowBox = row.findViewById(R.id.msg_row);
            LinearLayout bubble = row.findViewById(R.id.msg_bubble);
            ImageView image = row.findViewById(R.id.msg_image);
            TextView body = row.findViewById(R.id.msg_body);
            TextView attach = row.findViewById(R.id.msg_attach);
            TextView meta = row.findViewById(R.id.msg_meta);

            boolean incoming = !e.mine;
            rowBox.setGravity(incoming ? Gravity.START : Gravity.END);
            bubble.setBackgroundResource(incoming
                    ? R.drawable.chat_bubble_in : R.drawable.chat_bubble_out);
            int fg = incoming ? getColor(R.color.core_text) : Color.WHITE;
            body.setTextColor(fg);
            meta.setTextColor(fg);
            attach.setTextColor(fg);

            LinearLayout audio = row.findViewById(R.id.msg_audio);
            image.setVisibility(View.GONE);
            image.setTag(null);   // a recycled image row must not accept stale decodes
            attach.setVisibility(View.GONE);
            audio.setVisibility(View.GONE);
            body.setVisibility(View.VISIBLE);

            String mime = ChatMedia.isMedia(e.body) ? ChatMedia.mime(e.body) : null;
            if (mime != null && mime.startsWith("audio")) {
                // caption is "M:SS|waveformhex" - same convention everywhere
                String cap = ChatMedia.caption(e.body);
                String dur = cap;
                String waveHex = "";
                int bar = cap.indexOf('|');
                if (bar > 0) {
                    dur = cap.substring(0, bar);
                    waveHex = cap.substring(bar + 1);
                }
                body.setVisibility(View.GONE);
                audio.setVisibility(View.VISIBLE);
                TextView btn = row.findViewById(R.id.msg_audio_btn);
                com.eurobuddha.minimacore.chat.WaveformView wv = row.findViewById(R.id.msg_audio_wave);
                TextView time = row.findViewById(R.id.msg_audio_time);
                btn.setTextColor(fg);
                time.setTextColor(fg);
                wv.setInk(fg);
                wv.setBars(waveHex.isEmpty()
                        ? new int[com.eurobuddha.minimacore.chat.WaveformView.BAR_COUNT]
                        : com.eurobuddha.minimacore.chat.WaveformView.decode(waveHex));
                time.setText(dur);
                final String mbody = e.body;
                final String mref = ChatMedia.ref(e.body);
                btn.setText(mref != null && mref.equals(mPlayingRef)
                        && mPlayer != null && mPlayer.isPlaying() ? "\u23f8" : "\u25b6");
                Language.description(btn, Language.msg(mref.equals(mPlayingRef) && mPlayer != null && mPlayer.isPlaying()
                        ? l10n_chat_pause_voice : l10n_chat_play_voice));
                View.OnClickListener play = v -> toggleAudio(mbody, this::notifyDataSetChanged);
                btn.setOnClickListener(play);
                audio.setOnClickListener(play);
            } else if (mime != null && mime.startsWith("image")) {
                String cap = ChatMedia.caption(e.body);
                body.setVisibility(cap.isEmpty() ? View.GONE : View.VISIBLE);
                Language.setText(body, cap);
                image.setVisibility(View.VISIBLE);
                image.setImageResource(android.R.drawable.stat_sys_download);
                final String mbody = e.body;
                image.setTag(mbody);
                MaxMedia.loadBitmap(MaxThreadActivity.this, mbody, bm -> {
                    if (bm != null && mbody.equals(image.getTag())) {
                        image.setImageBitmap(bm);
                    }
                });
            } else {
                Language.setText(body, ChatMedia.isMedia(e.body) ? com.eurobuddha.minimacore.i18n.ChatPreview.message(e.body)
                        : ChatPay.isPayment(e.body)
                            ? "💸 " + ChatPay.amount(e.body) + " " + ChatPay.tokenName(e.body)
                            : e.body);
            }
            Language.setText(meta, Language.join(Language.stamp(e.time, "Hm"), ticks(e)));
            return row;
        }
    }
}
