package com.eurobuddha.minimacore.testing;

import com.eurobuddha.minimacore.main.views.terminal.TerminalActivity;

/** Records terminal submissions without calling the node. */
public class TerminalHarnessActivity extends TerminalActivity {
    public int submissions;
    public String command;
    @Override public void runCMD(String value) { submissions++; command = value; }
}
