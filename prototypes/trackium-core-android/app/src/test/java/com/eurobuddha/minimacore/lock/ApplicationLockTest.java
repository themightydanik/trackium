package com.eurobuddha.minimacore.lock;

import android.app.Activity;
import android.app.Application;
import android.content.Intent;
import com.eurobuddha.minimacore.MinimaApplication;
import java.lang.reflect.Method;
import org.junit.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import static org.mockito.Mockito.*;

public class ApplicationLockTest {
    private Application.ActivityLifecycleCallbacks callbacks(MinimaApplication app) throws Exception {
        doNothing().when(app).registerActivityLifecycleCallbacks(any());
        Method setup = MinimaApplication.class.getDeclaredMethod("setupActivityListener");
        setup.setAccessible(true); setup.invoke(app);
        ArgumentCaptor<Application.ActivityLifecycleCallbacks> capture = ArgumentCaptor.forClass(Application.ActivityLifecycleCallbacks.class);
        verify(app).registerActivityLifecycleCallbacks(capture.capture());
        return capture.getValue();
    }
    @Test public void coldRestoredScreenIsCoveredEvenWithoutRelockTransition() throws Exception {
        MinimaApplication app = mock(MinimaApplication.class, CALLS_REAL_METHODS);
        Activity restored = mock(Activity.class);
        AppLock session = mock(AppLock.class);
        try (org.mockito.MockedConstruction<Intent> intents = mockConstruction(Intent.class, (i, c) -> when(i.addFlags(anyInt())).thenReturn(i));
             MockedStatic<AppLock> lock = mockStatic(AppLock.class)) {
            lock.when(AppLock::get).thenReturn(session);
            lock.when(() -> AppLock.isEnabled(app)).thenReturn(true);
            callbacks(app).onActivityStarted(restored);
            verify(restored).startActivity(any(Intent.class));
        }
    }
    @Test public void unlockedDisabledFinishingAndLockScreensDoNotLoop() throws Exception {
        MinimaApplication app = mock(MinimaApplication.class, CALLS_REAL_METHODS);
        AppLock session = mock(AppLock.class);
        try (org.mockito.MockedConstruction<Intent> intents = mockConstruction(Intent.class, (i, c) -> when(i.addFlags(anyInt())).thenReturn(i));
             MockedStatic<AppLock> lock = mockStatic(AppLock.class)) {
            lock.when(AppLock::get).thenReturn(session);
            Application.ActivityLifecycleCallbacks cb = callbacks(app);
            Activity disabled = mock(Activity.class); cb.onActivityStarted(disabled);
            verify(disabled, never()).startActivity(any());
            lock.when(() -> AppLock.isEnabled(app)).thenReturn(true);
            when(session.isUnlocked()).thenReturn(true);
            Activity unlocked = mock(Activity.class); cb.onActivityStarted(unlocked);
            verify(unlocked, never()).startActivity(any());
            when(session.isUnlocked()).thenReturn(false);
            Activity finishing = mock(Activity.class); when(finishing.isFinishing()).thenReturn(true);
            cb.onActivityStarted(finishing); verify(finishing, never()).startActivity(any());
            LockActivity gate = mock(LockActivity.class); cb.onActivityStarted(gate);
            verify(gate, never()).startActivity(any());
        }
    }
    @Test public void rotationDoesNotStartBackgroundTimerButLeavingDoes() throws Exception {
        MinimaApplication app = mock(MinimaApplication.class, CALLS_REAL_METHODS);
        AppLock session = mock(AppLock.class);
        try (org.mockito.MockedConstruction<Intent> intents = mockConstruction(Intent.class, (i, c) -> when(i.addFlags(anyInt())).thenReturn(i));
             MockedStatic<AppLock> lock = mockStatic(AppLock.class)) {
            lock.when(AppLock::get).thenReturn(session);
            Application.ActivityLifecycleCallbacks cb = callbacks(app);
            Activity screen = mock(Activity.class); cb.onActivityStarted(screen);
            when(screen.isChangingConfigurations()).thenReturn(true); cb.onActivityStopped(screen);
            verify(session, never()).markBackgrounded();
            cb.onActivityStarted(screen); when(screen.isChangingConfigurations()).thenReturn(false);
            cb.onActivityStopped(screen); verify(session).markBackgrounded();
        }
    }
}
