package com.eurobuddha.minimacore.utils;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.concurrent.CopyOnWriteArraySet;

/**
 * Static ring buffer for the node's log lines (MINIMALOG notify events).
 *
 * MinimaService appends every line as it arrives (NotifyManager thread) so logs
 * accumulate from service start whether or not the Logs tab is ever opened. The
 * LogsView attaches a sink to live-tail; the sink is invoked on the appender's
 * thread and must marshal to the UI itself.
 */
public final class LogBuffer {

    public interface Sink {
        void onLine(String zLine);
    }

    private static final int MAX_LINES = 600;

    private static final Tail mLines = new Tail();

    private static Sink mSink = null;

    // Non-UI observers (e.g. resync) coexist with the Logs tab, never replace it.
    private static final CopyOnWriteArraySet<Sink> mObservers = new CopyOnWriteArraySet<>();

    public static void addObserver(Sink sink) { mObservers.add(sink); }
    public static void removeObserver(Sink sink) { mObservers.remove(sink); }

    /** The same bounded tail for an operation that must outlive its Activity. */
    public static final class Tail {
        private final ArrayDeque<String> lines = new ArrayDeque<>();
        private long revision;

        public synchronized void append(String line) {
            if (line == null) return;
            lines.addLast(line);
            while (lines.size() > MAX_LINES) lines.removeFirst();
            revision++;
        }

        public synchronized ArrayList<String> snapshot() { return new ArrayList<>(lines); }
        public synchronized long revision() { return revision; }
        public synchronized void clear() { lines.clear(); revision++; }
    }

    private LogBuffer() {}

    public static void append(String zLine){
        if(zLine == null){
            return;
        }

        Sink sink;
        synchronized (mLines){
            mLines.append(zLine);
            sink = mSink;
        }

        //Deliver OUTSIDE the lock
        if(sink != null){
            try{
                sink.onLine(zLine);
            }catch(Exception ignore){}
        }
        for (Sink observer : mObservers) {
            try { observer.onLine(zLine); } catch (Exception ignore) { }
        }
    }

    /** All buffered lines, oldest first. */
    public static ArrayList<String> snapshot(){
        synchronized (mLines){
            return mLines.snapshot();
        }
    }

    public static void clear(){
        synchronized (mLines){
            mLines.clear();
        }
    }

    public static void setSink(Sink zSink){
        synchronized (mLines){
            mSink = zSink;
        }
    }

    public static void clearSink(Sink zSink){
        synchronized (mLines){
            if(mSink == zSink){
                mSink = null;
            }
        }
    }
}
