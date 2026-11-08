package com.eurobuddha.minimacore.chat;

import android.app.Activity;
import androidx.appcompat.app.AlertDialog;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.i18n.LanguageDialog;
import com.eurobuddha.minimacore.i18n.ChatPreview;
import static com.eurobuddha.minimacore.i18n.R.string.*;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;

import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.main.BaseView;
import com.eurobuddha.minimacore.utils.MinimaCMD;
import com.google.android.material.floatingactionbutton.FloatingActionButton;
import com.google.zxing.BarcodeFormat;
import com.journeyapps.barcodescanner.BarcodeEncoder;

import org.minima.utils.json.JSONObject;

import java.util.ArrayList;

/**
 * The Chat tab: a clean thread list (avatar, name, preview, time, unread badge — no
 * raw hex anywhere), a + FAB that starts a chat by QR scan or pasted address, and a
 * "My address & QR" header that opens the identity sheet. History lives in ChatDb
 * (fed by ChatDrainer); conversations open in ChatThreadActivity.
 */
public class ChatView extends BaseView {

    private static String mMyPub = null;   // cached (stable per datadir until a chat backup is restored)

    /** A restored chat backup replaced the keets keypair: ask the sidecar again. */
    public static void forgetMyPub() { mMyPub = null; }

    private final View mEmpty;
    private final TextView mMyName;
    private final TextView mNotifyOff;
    private final ThreadAdapter mAdapter;
    private Runnable mScanRequest = null;  // wired by MainActivity (launcher must register pre-STARTED)
    private EditText mPendingScanTarget = null;
    private final Runnable mOnNewMessage = () -> mActivity.runOnUiThread(this::refreshView);
    private boolean destroyed;
    private final java.util.Set<AlertDialog> dialogs = new java.util.HashSet<>();

    private boolean alive() { return !destroyed && !mActivity.isFinishing() && !mActivity.isDestroyed(); }
    private LanguageDialog dialog() {
        return new LanguageDialog(mActivity) {
            @Override public AlertDialog create() {
                AlertDialog value = super.create();
                dialogs.add(value);
                value.setOnDismissListener(d -> {
                    dialogs.remove(value);
                    if (mPendingScanTarget != null && value.findViewById(R.id.newchat_address) == mPendingScanTarget)
                        mPendingScanTarget = null;
                });
                return value;
            }
        };
    }
    private CharSequence displayName(ChatDb.Thread t) {
        if (t.name == null || t.name.isEmpty()) return Language.msg(l10n_chat_parlons_contact);
        boolean unnamed = com.eurobuddha.minimacore.maxchat.MaxChatThreads.isMax(t.pubkey)
                ? t.name.startsWith("0x") : ChatDb.unnamedContact(t.pubkey, t.name);
        return unnamed ? Language.msg(l10n_chat_new_contact) : t.name;
    }
    static CharSequence preview(ChatDb.Thread t) {
        if (com.eurobuddha.minimacore.maxchat.MaxChatThreads.isMax(t.pubkey)) {
            CharSequence body = ChatPreview.message(t.lastBody);
            return t.lastMine ? Language.msg(l10n_chat_you_preview, body) : body;
        }
        if ("image".equals(t.lastState)) return Language.msg(l10n_media_photo);
        if ("audio".equals(t.lastState)) return Language.msg(l10n_media_voice);
        return t.lastBody;
    }
    @Override public void languageChanged() { mAdapter.notifyDataSetChanged(); }


    public ChatView(Activity zActivity) {
        super(zActivity, R.layout.view_chat);

        mEmpty = getMainView().findViewById(R.id.chat_empty_box);
        mMyName = getMainView().findViewById(R.id.chat_myname);
        mNotifyOff = getMainView().findViewById(R.id.chat_notify_off);
        mNotifyOff.setOnClickListener(v -> {
            Intent it = new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, mActivity.getPackageName());
            try { mActivity.startActivity(it); } catch (Exception ignored) {}
        });
        ListView list = getMainView().findViewById(R.id.chat_threads);
        mAdapter = new ThreadAdapter();
        list.setAdapter(mAdapter);

        getMainView().findViewById(R.id.chat_myaddress_row).setOnClickListener(v -> showIdentity());

        FloatingActionButton fab = getMainView().findViewById(R.id.chat_fab);
        fab.setOnClickListener(v -> showNewChat());
        getMainView().findViewById(R.id.chat_empty_start).setOnClickListener(v -> showNewChat());

        list.setOnItemClickListener((parent, view, position, id) -> {
            ChatDb.Thread t = (ChatDb.Thread) mAdapter.getItem(position);
            if (com.eurobuddha.minimacore.maxchat.MaxChatThreads.isMax(t.pubkey)) {
                Intent it = new Intent(mActivity,
                        com.eurobuddha.minimacore.maxchat.MaxThreadActivity.class);
                it.putExtra("peer", com.eurobuddha.minimacore.maxchat.MaxChatThreads.peer(t.pubkey));
                mActivity.startActivity(it);
                return;
            }
            openThread(t.pubkey);
        });
        list.setOnItemLongClickListener((parent, view, position, id) -> {
            ChatDb.Thread t = (ChatDb.Thread) mAdapter.getItem(position);
            if (com.eurobuddha.minimacore.maxchat.MaxChatThreads.isMax(t.pubkey)) {
                // Parlons rows live in the engine, not ChatDb - a ChatDb write here
                // would plant a phantom "max:" contact row that duplicates forever.
                dialog()
                        .setTitle(displayName(t))
                        .setItems(new CharSequence[]{Language.msg(l10n_chat_delete_chat), Language.msg(l10n_chat_delete_contact)}, (d, which) -> {
                            String peer = com.eurobuddha.minimacore.maxchat.MaxChatThreads.peer(t.pubkey);
                            if (which == 0) clearMaxChat(peer, t.name);
                            else deleteMaxContact(peer, t.name);
                        }).show();
                return true;
            }
            dialog()
                    .setTitle(displayName(t))
                    .setItems(new CharSequence[]{Language.msg(l10n_chat_rename), Language.msg(l10n_chat_delete_chat), Language.msg(l10n_chat_delete_contact)}, (d, which) -> {
                        if (which == 0) renameContact(t);
                        else if (which == 1) clearChat(t);
                        else deleteContact(t);
                    }).show();
            return true;
        });

        ChatDrainer.UI_LISTENERS.add(mOnNewMessage);
        com.eurobuddha.minimacore.maxchat.MaxChat.UI_LISTENERS.add(mOnNewMessage);
    }

    /** MainActivity wires the QR scanner through here (ActivityResult launchers must pre-register). */
    public void setOnScanRequest(Runnable zRequest) { mScanRequest = zRequest; }

    /** MainActivity routes the scan result back. */
    public void onScanResult(String zContents) {
        if (!alive() || zContents == null) return;
        String raw = zContents.trim();
        if (raw.regionMatches(true, 0, "MAX#", 0, 4)
                || raw.matches("(?s)Mx[0-9A-Za-z]+@\\S+:\\d+")) {
            if (mPendingScanTarget != null) {
                mPendingScanTarget.setText(raw);
                Language.error(mPendingScanTarget, null);
            }
            return;
        }
        String pub = raw.toLowerCase();
        if (!pub.matches("0x[0-9a-f]{64}")) {
            Toast.makeText(mActivity, Language.msg(l10n_chat_bad_qr), Toast.LENGTH_SHORT).show();
            return;
        }
        if (mPendingScanTarget != null) {
            mPendingScanTarget.setText(pub);
            Language.error(mPendingScanTarget, null);
        } else {
            ChatDb.get(mActivity).ensureContact(pub, null);
            openThread(pub);
        }
    }

    @Override
    public void onActivityDestroy() {
        destroyed = true;
        mPendingScanTarget = null;
        for (AlertDialog value : new java.util.ArrayList<>(dialogs)) value.dismiss();
        dialogs.clear();
        ChatDrainer.UI_LISTENERS.remove(mOnNewMessage);
        com.eurobuddha.minimacore.maxchat.MaxChat.UI_LISTENERS.remove(mOnNewMessage);
    }

    private void openThread(String zPubkey) {
        Intent it = new Intent(mActivity, ChatThreadActivity.class);
        it.putExtra("pubkey", zPubkey);
        mActivity.startActivity(it);
    }

    // ---- identity sheet: QR + full address + copy + display name ----------
    private void showIdentity() {
        View v = LayoutInflater.from(mActivity).inflate(R.layout.dialog_chat_identity, null);
        Language.apply(v);
        TextView addr = v.findViewById(R.id.identity_address);
        ImageView qr = v.findViewById(R.id.identity_qr);
        EditText name = v.findViewById(R.id.identity_name);

        SharedPreferences prefs = mActivity.getSharedPreferences("main_prefs", Context.MODE_PRIVATE);
        name.setText(prefs.getString("chat_name", ""));

        if (mMyPub != null) {
            addr.setText(mMyPub);
            try {
                Bitmap bm = new BarcodeEncoder().encodeBitmap(mMyPub, BarcodeFormat.QR_CODE, 480, 480);
                qr.setImageBitmap(bm);
            } catch (Exception e) {}
        } else {
            Language.setText(addr, Language.msg(l10n_chat_node_starting));
        }

        // The Parlons address (the app's own Maxima identity) under the keets one.
        // Permanent MAX# where a directory holds us, else the live Mx...@host:port.
        TextView max = new TextView(mActivity);
        max.setTextIsSelectable(true);
        max.setTextSize(11);
        max.setPadding(32, 24, 32, 8);
        Language.setText(max, Language.msg(l10n_chat_parlons_starting));
        ((android.widget.LinearLayout) v).addView(max);
        new Thread(() -> {
            String perm = com.eurobuddha.minimacore.maxchat.MaxChat.permanentAddress();
            java.util.List<String> live = com.eurobuddha.minimacore.maxchat.MaxChat.myAddresses();
            String show = !perm.equals("") ? perm : live.isEmpty() ? "" : live.get(0);
            mActivity.runOnUiThread(() -> {
                if (!alive() || !v.isAttachedToWindow()) return;
                if (show.equals("")) {
                    Language.setText(max, Language.msg(l10n_chat_no_relay));
                    return;
                }
                Language.setText(max, Language.msg(l10n_chat_parlons_address, show));
                max.setOnClickListener(b -> {
                    ClipboardManager cm = (ClipboardManager) mActivity.getSystemService(Context.CLIPBOARD_SERVICE);
                    cm.setPrimaryClip(ClipData.newPlainText("parlons address", show));
                    Toast.makeText(mActivity, Language.msg(l10n_chat_parlons_copied), Toast.LENGTH_SHORT).show();
                });
            });
        }, "maxchat-addr").start();

        v.findViewById(R.id.identity_copy).setOnClickListener(b -> {
            if (mMyPub == null) return;
            ClipboardManager cm = (ClipboardManager) mActivity.getSystemService(Context.CLIPBOARD_SERVICE);
            cm.setPrimaryClip(ClipData.newPlainText("keets address", mMyPub));
            Toast.makeText(mActivity, Language.msg(l10n_wallet_address_copied), Toast.LENGTH_SHORT).show();
        });

        dialog()
                .setTitle(Language.msg(l10n_chat_my_address))
                .setView(v)
                .setPositiveButton(Language.msg(l10n_chat_done), (d, w) -> {
                    prefs.edit().putString("chat_name", name.getText().toString().trim()).apply();
                    refreshView();
                })
                .show();
    }

    // ---- new chat: scan or paste -------------------------------------------
    private void showNewChat() {
        View v = LayoutInflater.from(mActivity).inflate(R.layout.dialog_chat_new, null);
        Language.apply(v);
        EditText addrIn = v.findViewById(R.id.newchat_address);
        EditText nameIn = v.findViewById(R.id.newchat_name);

        AlertDialog dlg = dialog()
                .setTitle(Language.msg(l10n_chat_new_chat))
                .setView(v)
                .setPositiveButton(Language.msg(l10n_chat_start_chat), null)   // set below so bad input doesn't dismiss
                .setNegativeButton(Language.msg(l10n_common_cancel), null)
                .create();

        v.findViewById(R.id.newchat_scan).setOnClickListener(b -> {
            mPendingScanTarget = addrIn;
            if (mScanRequest != null) mScanRequest.run();
        });

        // Saved-contacts picker: the elegant way to re-reach someone whose chat you
        // cleared. Label carries the count; disabled with a hint when there are none.
        com.google.android.material.button.MaterialButton pick = v.findViewById(R.id.newchat_pick);
        TextView pickHint = v.findViewById(R.id.newchat_pick_hint);
        pick.setOnClickListener(b -> showContactPicker(dlg));
        new Thread(() -> {
            int n = ChatDb.get(mActivity).contactList().size()
                    + com.eurobuddha.minimacore.maxchat.MaxChat.contacts().size();
            mActivity.runOnUiThread(() -> {
                if (!alive() || !dlg.isShowing()) return;
                if (n == 0) {
                    pick.setEnabled(false);
                    Language.setText(pick, Language.msg(l10n_chat_no_contacts));
                    Language.setText(pickHint, Language.msg(l10n_chat_contacts_hint));
                } else {
                    Language.setText(pick, Language.msg(l10n_chat_choose_count, Integer.toString(n)));
                }
            });
        }, "chat-contact-count").start();

        dlg.setOnShowListener(d -> dlg.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(b -> {
            String raw = addrIn.getText().toString().trim();
            if (raw.regionMatches(true, 0, "MAX#", 0, 4)
                    || raw.matches("(?s)Mx[0-9A-Za-z]+@\\S+:\\d+")) {
                dlg.dismiss();
                mPendingScanTarget = null;
                Toast.makeText(mActivity, Language.msg(l10n_chat_adding), Toast.LENGTH_SHORT).show();
                new Thread(() -> {
                    try {
                        com.eurobuddha.minimacore.maxchat.MaxChat.addContact(raw);
                        mActivity.runOnUiThread(() -> {
                            Toast.makeText(mActivity, Language.msg(l10n_chat_added), Toast.LENGTH_SHORT).show();
                            refreshView();
                        });
                    } catch (Exception e) {
                        mActivity.runOnUiThread(() -> Toast.makeText(mActivity,
                                Language.msg(l10n_chat_add_failed, ChatMessages.error(e)), Toast.LENGTH_LONG).show());
                    }
                }, "maxchat-add").start();
                return;
            }
            String pub = raw.toLowerCase();
            String name = nameIn.getText().toString().trim();
            if (!pub.matches("0x[0-9a-f]{64}")) {
                Language.error(addrIn, Language.msg(l10n_chat_bad_address));
                return;
            }
            ChatDb.get(mActivity).putContact(pub, name.equals("") ? null : name);
            dlg.dismiss();
            mPendingScanTarget = null;
            refreshView();
            openThread(pub);
        }));
        dlg.show();
    }

    private void renameContact(ChatDb.Thread zT) {
        EditText input = new EditText(mActivity);
        input.setText(zT.name.startsWith("0x") ? "" : zT.name);
        dialog()
                .setTitle(Language.msg(l10n_chat_contact_name))
                .setView(input)
                .setPositiveButton(Language.msg(l10n_common_save), (d, w) -> {
                    ChatDb.get(mActivity).putContact(zT.pubkey, input.getText().toString().trim());
                    refreshView();
                })
                .setNegativeButton(Language.msg(l10n_common_cancel), null)
                .show();
    }

    private CharSequence niceName(ChatDb.Thread zT) {
        return zT.name == null || zT.name.startsWith("0x") ? Language.msg(l10n_chat_this_contact) : zT.name;
    }

    // ---- delete: "Delete chat" keeps the contact, "Delete contact" removes it ----

    /** keets: clear the conversation, keep the contact (stays in the picker). */
    private void clearChat(ChatDb.Thread zT) {
        dialog()
                .setTitle(Language.msg(l10n_chat_delete_chat))
                .setMessage(Language.msg(l10n_chat_clear_named, niceName(zT)))
                .setPositiveButton(Language.msg(l10n_chat_delete_chat), (d, w) -> {
                    ChatDb.get(mActivity).clearMessages(zT.pubkey);
                    refreshView();
                })
                .setNegativeButton(Language.msg(l10n_common_cancel), null)
                .show();
    }

    /** keets: remove the contact and its history for good. */
    private void deleteContact(ChatDb.Thread zT) {
        dialog()
                .setTitle(Language.msg(l10n_chat_delete_contact))
                .setMessage(Language.msg(l10n_chat_remove_named, niceName(zT)))
                .setPositiveButton(Language.msg(l10n_chat_delete_contact), (d, w) -> {
                    ChatDb.get(mActivity).removeContact(zT.pubkey);
                    refreshView();
                })
                .setNegativeButton(Language.msg(l10n_common_cancel), null)
                .show();
    }

    /** Parlons: clear the conversation, keep the contact. */
    private void clearMaxChat(String zPeer, String zName) {
        dialog()
                .setTitle(Language.msg(l10n_chat_delete_chat))
                .setMessage(Language.msg(l10n_chat_clear_body))
                .setPositiveButton(Language.msg(l10n_chat_delete_chat), (d, w) -> new Thread(() -> {
                    try { com.eurobuddha.minimacore.maxchat.MaxChat.clearConversation(zPeer); }
                    catch (Exception ignored) {}
                    mActivity.runOnUiThread(this::refreshView);
                }, "maxchat-clear").start())
                .setNegativeButton(Language.msg(l10n_common_cancel), null)
                .show();
    }

    /** Parlons: remove the contact for good (also notifies the peer). */
    private void deleteMaxContact(String zPeer, String zName) {
        dialog()
                .setTitle(Language.msg(l10n_chat_delete_contact))
                .setMessage(Language.msg(l10n_chat_remove_parlons))
                .setPositiveButton(Language.msg(l10n_chat_delete_contact), (d, w) -> new Thread(() -> {
                    try { com.eurobuddha.minimacore.maxchat.MaxChat.removeContact(zPeer); }
                    catch (Exception ignored) {}
                    mActivity.runOnUiThread(this::refreshView);
                }, "maxchat-remove").start())
                .setNegativeButton(Language.msg(l10n_common_cancel), null)
                .show();
    }

    // ---- saved-contacts picker (shown from the New chat sheet) -------------

    private void showContactPicker(AlertDialog zParent) {
        new Thread(() -> {
            ArrayList<PickItem> items = new ArrayList<>();
            for (ChatDb.Thread t : ChatDb.get(mActivity).contactList()) {
                items.add(new PickItem(t.pubkey, t.name, false));
            }
            for (com.eurobuddha.maxima.core.contacts.Contact c
                    : com.eurobuddha.minimacore.maxchat.MaxChat.contacts()) {
                items.add(new PickItem(c.publicKey, c.name, true));
            }
            items.sort((a, b) -> a.label().toString().compareToIgnoreCase(b.label().toString()));
            mActivity.runOnUiThread(() -> {
                if (alive() && zParent.isShowing()) showPickerDialog(zParent, items);
            });
        }, "chat-contact-pick").start();
    }

    private void showPickerDialog(AlertDialog zParent, ArrayList<PickItem> zAll) {
        View v = LayoutInflater.from(mActivity).inflate(R.layout.dialog_contact_pick, null);
        Language.apply(v);
        ListView list = v.findViewById(R.id.pick_list);
        TextView empty = v.findViewById(R.id.pick_empty);
        EditText search = v.findViewById(R.id.pick_search);

        PickAdapter adapter = new PickAdapter(zAll);
        list.setAdapter(adapter);
        empty.setVisibility(zAll.isEmpty() ? View.VISIBLE : View.GONE);

        AlertDialog dlg = dialog()
                .setTitle(Language.msg(l10n_chat_choose_contact))
                .setView(v)
                .setNegativeButton(Language.msg(l10n_common_cancel), null)
                .create();

        search.addTextChangedListener(new android.text.TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) {
                adapter.filter(s.toString());
                empty.setVisibility(adapter.getCount() == 0 ? View.VISIBLE : View.GONE);
                Language.setText(empty, Language.msg(l10n_chat_no_matches));
            }
            @Override public void afterTextChanged(android.text.Editable s) {}
        });

        list.setOnItemClickListener((parent, view, pos, id) -> {
            PickItem it = (PickItem) adapter.getItem(pos);
            dlg.dismiss();
            zParent.dismiss();
            mPendingScanTarget = null;
            if (it.isMax) {
                Intent in = new Intent(mActivity,
                        com.eurobuddha.minimacore.maxchat.MaxThreadActivity.class);
                in.putExtra("peer", it.pubkey);
                mActivity.startActivity(in);
            } else {
                openThread(it.pubkey);
            }
        });
        dlg.show();
    }

    /** A pickable contact: keets (ChatDb) or Parlons (engine), unified for the picker. */
    private static class PickItem {
        final String pubkey;   // raw routing key (keets 0x… or Parlons RSA pubkey)
        final String name;
        final boolean isMax;
        PickItem(String zPubkey, String zName, boolean zMax) {
            pubkey = zPubkey; name = zName; isMax = zMax;
        }
        boolean named() {
            return name != null && !name.equals("") && !name.equals("noname")
                    && !name.startsWith("0x") && !name.startsWith("MAX#") && !name.startsWith("Mx");
        }
        CharSequence label() { return named() ? name : Language.msg(l10n_chat_new_typed_contact, isMax ? "Parlons" : "keets"); }
    }

    private class PickAdapter extends BaseAdapter {
        private final ArrayList<PickItem> mAll;
        private ArrayList<PickItem> mShown;
        PickAdapter(ArrayList<PickItem> zAll) { mAll = zAll; mShown = zAll; }

        void filter(String zQuery) {
            String s = zQuery.trim().toLowerCase(java.util.Locale.ROOT);
            if (s.isEmpty()) {
                mShown = mAll;
            } else {
                ArrayList<PickItem> f = new ArrayList<>();
                for (PickItem it : mAll) {
                    if (it.label().toString().toLowerCase(java.util.Locale.ROOT).contains(s) || it.pubkey.toLowerCase(java.util.Locale.ROOT).contains(s)) {
                        f.add(it);
                    }
                }
                mShown = f;
            }
            notifyDataSetChanged();
        }

        @Override public int getCount() { return mShown.size(); }
        @Override public Object getItem(int position) { return mShown.get(position); }
        @Override public long getItemId(int position) { return position; }

        @Override
        public View getView(int position, View convertView, ViewGroup parent) {
            View row = convertView != null ? convertView
                    : mActivity.getLayoutInflater().inflate(R.layout.chat_contact_row, parent, false);
            PickItem it = mShown.get(position);
            CharSequence label = it.label();
            Language.setText(row.findViewById(R.id.row_name), label);
            ((TextView) row.findViewById(R.id.row_sub)).setText(it.isMax ? "Parlons" : "Keets");
            ChatUi.avatar(row.findViewById(R.id.row_avatar), label.toString(), it.pubkey);
            return row;
        }
    }

    @Override
    public void refreshView() {
        if (!alive()) return;
        if (mMyPub == null && MinimaCMD.checkMinimaStarted()) {
            MinimaCMD.runMinima("keets action:info", zResult -> {
                if ((Boolean) zResult.getOrDefault("status", false)) {
                    mMyPub = (String) ((JSONObject) zResult.get("response")).get("pubkey");
                }
            });
        }
        SharedPreferences prefs = mActivity.getSharedPreferences("main_prefs", Context.MODE_PRIVATE);
        mMyName.setText(prefs.getString("chat_name", ""));
        mNotifyOff.setVisibility(notificationsBlocked() ? View.VISIBLE : View.GONE);
        mAdapter.reload();
    }

    /** True when the OS would drop a chat notification: app-level off, or the channel muted to NONE. */
    private boolean notificationsBlocked() {
        try {
            android.app.NotificationManager nm = (android.app.NotificationManager)
                    mActivity.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return false;
            if (!nm.areNotificationsEnabled()) return true;
            android.app.NotificationChannel ch = nm.getNotificationChannel(ChatDrainer.CHANNEL_ID);
            return ch != null && ch.getImportance() == android.app.NotificationManager.IMPORTANCE_NONE;
        } catch (Exception e) {
            return false;
        }
    }

    private class ThreadAdapter extends BaseAdapter {
        private ArrayList<ChatDb.Thread> mThreads = new ArrayList<>();

        void reload() {
            new Thread(() -> {
                ArrayList<ChatDb.Thread> all = ChatDb.get(mActivity).threads();
                all.addAll(com.eurobuddha.minimacore.maxchat.MaxChatThreads.list());
                // The Chats list shows conversations only. A contact with no messages
                // (never messaged, or a chat you deleted) isn't lost — it lives in the
                // New chat → "Choose a saved contact" picker.
                ArrayList<ChatDb.Thread> t = new ArrayList<>();
                for (ChatDb.Thread th : all) {
                    if (th.lastTs > 0) t.add(th);
                }
                t.sort((a, b) -> Long.compare(b.lastTs, a.lastTs));
                mActivity.runOnUiThread(() -> {
                    if (!alive()) return;
                    mThreads = t;
                    mEmpty.setVisibility(t.isEmpty() ? View.VISIBLE : View.GONE);
                    notifyDataSetChanged();
                });
            }, "chat-threads-load").start();
        }

        @Override public int getCount() { return mThreads.size(); }
        @Override public Object getItem(int position) { return mThreads.get(position); }
        @Override public long getItemId(int position) { return position; }

        @Override
        public View getView(int position, View convertView, ViewGroup parent) {
            View row = convertView != null ? convertView
                    : mActivity.getLayoutInflater().inflate(R.layout.chat_thread_row, parent, false);
            ChatDb.Thread t = mThreads.get(position);

            // a contact that is still its own pubkey shows as "New contact" — hex stays out of the list
            CharSequence display = displayName(t);
            Language.setText(row.findViewById(R.id.row_name), display);
            ChatUi.avatar(row.findViewById(R.id.row_avatar), display.toString(), t.pubkey);
            Language.setText(row.findViewById(R.id.row_last), preview(t));
            ((TextView) row.findViewById(R.id.row_time)).setText(ChatUi.listTime(t.lastTs));

            TextView unread = row.findViewById(R.id.row_unread);
            if (t.unread > 0) {
                unread.setVisibility(View.VISIBLE);
                unread.setText(t.unread > 99 ? "99+" : "" + t.unread);
            } else {
                unread.setVisibility(View.GONE);
            }
            return row;
        }
    }
}
