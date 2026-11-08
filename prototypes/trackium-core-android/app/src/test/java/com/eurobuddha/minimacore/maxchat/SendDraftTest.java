package com.eurobuddha.minimacore.maxchat;

import android.text.Editable;
import android.text.TextWatcher;
import android.widget.EditText;
import java.util.ArrayList;
import java.util.List;
import org.junit.Before;
import org.junit.Test;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

/** Adapts InboxReplyDraftTest's late-callback, revision, exact-text and close cases. */
public class SendDraftTest {
    EditText field;
    SendDraft draft;
    String text;
    Editable editable;
    int start, end;
    final List<TextWatcher> watchers = new ArrayList<>();
    @Before public void setup() {
        field = mock(EditText.class);
        when(field.getText()).thenAnswer(call -> editable);
        when(field.getSelectionStart()).thenAnswer(call -> start);
        when(field.getSelectionEnd()).thenAnswer(call -> end);
        doAnswer(call -> { watchers.add(call.getArgument(0)); return null; })
                .when(field).addTextChangedListener(any(TextWatcher.class));
        doAnswer(call -> { watchers.remove(call.getArgument(0)); return null; })
                .when(field).removeTextChangedListener(any(TextWatcher.class));
        doAnswer(call -> { edit(call.getArgument(0).toString()); return null; })
                .when(field).setText(any(CharSequence.class));
        doAnswer(call -> { start = call.getArgument(0); end = call.getArgument(1); return null; })
                .when(field).setSelection(anyInt(), anyInt());
        edit(""); draft = new SendDraft(field);
    }
    void edit(String value) {
        text = value; start = end = text.length(); editable = mock(Editable.class);
        when(editable.toString()).thenReturn(value);
        // Android delivers afterTextChanged synchronously for typing, paste and setText.
        for (TextWatcher watcher : new ArrayList<>(watchers)) watcher.afterTextChanged(editable);
    }
    @Test public void untouchedComposerRestoresExactRawTextAndSelection() {
        edit("  中文 Привіт русский\n unsent  "); start = 2; end = 7;
        SendDraft.Submission sent = draft.begin();
        assertEquals("中文 Привіт русский\n unsent", sent.text()); assertEquals("", text);
        draft.failed(sent);
        assertEquals("  中文 Привіт русский\n unsent  ", text); assertEquals(2, start); assertEquals(7, end);
    }
    @Test public void lateFailureCannotReplaceNewerDraftOrItsEditable() {
        edit("old message"); SendDraft.Submission sent = draft.begin();
        edit("new 中文 чернетка"); start = 1; end = 4; Editable newer = editable;
        clearInvocations(field); draft.failed(sent);
        assertEquals("new 中文 чернетка", text); assertSame(newer, editable);
        assertEquals(1, start); assertEquals(4, end);
        verify(field, never()).setText(any(CharSequence.class));
        verify(field, never()).setSelection(anyInt(), anyInt());
    }
    @Test public void editingBackToBlankStillInvalidatesTheOldCallback() {
        edit("old message"); SendDraft.Submission sent = draft.begin();
        edit("new draft"); edit(""); draft.failed(sent); assertEquals("", text);
    }
    @Test public void outOfOrderFailuresOnlyRestoreTheLatestUntouchedSubmission() {
        edit("first"); SendDraft.Submission first = draft.begin();
        edit("second"); SendDraft.Submission second = draft.begin();
        draft.failed(first); assertEquals("", text);
        draft.failed(second); assertEquals("second", text);
        edit(""); draft.failed(first); draft.failed(second); assertEquals("", text);
    }
    @Test public void retypingTheSameMessageCreatesANewDraft() {
        edit("same"); SendDraft.Submission sent = draft.begin();
        edit("same"); Editable newer = editable; draft.failed(sent);
        assertSame(newer, editable); assertEquals("same", text);
    }
    @Test public void blankSubmissionAndClosedHostDoNotChangeTheComposer() {
        edit(" \n "); assertNull(draft.begin()); assertEquals(" \n ", text);
        edit("pending"); SendDraft.Submission sent = draft.begin(); draft.close();
        assertTrue(watchers.isEmpty()); draft.failed(sent); assertEquals("", text); assertNull(draft.begin());
    }
    @Test public void foreignTicketsAndRepeatedFailuresAreIgnored() {
        edit("one"); SendDraft.Submission sent = draft.begin();
        SendDraft other = new SendDraft(field); other.failed(sent); assertEquals("", text); other.close();
        draft.failed(sent); assertEquals("one", text);
        edit(""); draft.failed(sent); assertEquals("", text);
    }
    @Test public void invalidSelectionIsClampedBeforeRestoring() {
        edit("abc"); start = -1; end = 100; SendDraft.Submission sent = draft.begin();
        draft.failed(sent); assertEquals(0, start); assertEquals(3, end);
    }
}
