package com.eurobuddha.minimacore.keets;

import java.io.IOException;

/** Termination is safe only after the worker has released its persistent stores. */
final class WorkletShutdown {
    interface CloseRequest { String close() throws Exception; }

    static void close(CloseRequest request, Runnable terminate) throws Exception {
        if (!"media-closed-v1".equals(request.close())) {
            throw new IOException("Keets did not confirm media storage shutdown");
        }
        terminate.run();
    }
}
