package com.eurobuddha.history;
public class MainActivity extends androidx.appcompat.app.AppCompatActivity {
    private HistoryScreen screen;
    @Override protected void onCreate(android.os.Bundle state) {
        super.onCreate(state); screen = new HistoryScreen(this); setContentView(screen.getView());
    }
    @Override protected void onStart() { super.onStart(); screen.start(); }
    @Override protected void onResume() { super.onResume(); screen.refresh(); }
    @Override protected void onStop() { screen.stop(); super.onStop(); }
    @Override protected void onDestroy() { screen.close(); super.onDestroy(); }
}
