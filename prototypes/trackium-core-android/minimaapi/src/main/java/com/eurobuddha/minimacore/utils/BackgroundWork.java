package com.eurobuddha.minimacore.utils;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/** Bounded background work; overload is reported rather than run on the UI thread. */
public final class BackgroundWork {
    private BackgroundWork() { }
    public static ThreadPoolExecutor pool(int workers, int queued) {
        ThreadPoolExecutor pool = new ThreadPoolExecutor(workers, workers, 30, TimeUnit.SECONDS,
                new ArrayBlockingQueue<>(queued), new ThreadPoolExecutor.AbortPolicy());
        pool.allowCoreThreadTimeOut(true);
        return pool;
    }
}
