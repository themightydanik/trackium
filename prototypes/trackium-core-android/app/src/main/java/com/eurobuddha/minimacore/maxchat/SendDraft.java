package com.eurobuddha.minimacore.maxchat;

import android.text.Editable;
import android.text.TextWatcher;
import android.widget.EditText;

/** Main-thread composer guard, adapted from Inbox ReplyDrafts' revision/identity checks. */
final class SendDraft {
    static final class Submission {
        private final SendDraft owner;
        private final String raw;
        private final int start, end;
        private final long revision;
        private boolean finished;
        private Submission(SendDraft owner, String raw, int start, int end, long revision) {
            this.owner = owner; this.raw = raw; this.start = start; this.end = end;
            this.revision = revision;
        }
        String text() { return raw.trim(); }
    }
    private final EditText field;
    private long revision;
    private boolean closed;
    private final TextWatcher watcher = new TextWatcher() {
        public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
        public void onTextChanged(CharSequence s, int start, int before, int count) {}
        public void afterTextChanged(Editable text) { if (!closed) revision++; }
    };
    SendDraft(EditText field) { this.field = field; field.addTextChangedListener(watcher); }
    private static int position(int value, int length) { return Math.max(0, Math.min(value, length)); }
    Submission begin() {
        if (closed) return null;
        String raw = field.getText().toString();
        if (raw.trim().isEmpty()) return null;
        int start = position(field.getSelectionStart(), raw.length());
        int end = position(field.getSelectionEnd(), raw.length());
        field.setText("");
        return new Submission(this, raw, start, end, revision);
    }
    void failed(Submission ticket) {
        if (closed || ticket == null || ticket.owner != this || ticket.finished) return;
        ticket.finished = true;
        // Editing and then deleting back to blank is still a newer draft.
        if (revision != ticket.revision || !field.getText().toString().isEmpty()) return;
        field.setText(ticket.raw);
        field.setSelection(ticket.start, ticket.end);
    }
    void close() { closed = true; field.removeTextChangedListener(watcher); }
}
