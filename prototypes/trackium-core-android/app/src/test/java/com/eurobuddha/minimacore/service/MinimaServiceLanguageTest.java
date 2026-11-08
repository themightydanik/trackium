package com.eurobuddha.minimacore.service;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import androidx.core.app.NotificationCompat;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.i18n.NotificationLabels;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import org.junit.Test;
import org.minima.utils.json.JSONObject;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import static com.eurobuddha.minimacore.i18n.R.string.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

/** Real notification control flow with Android boundaries mocked; no node startup or wallet. */
public class MinimaServiceLanguageTest {
    private static void set(MinimaService service, String name, Object value) throws Exception {
        Field field = MinimaService.class.getDeclaredField(name); field.setAccessible(true); field.set(service, value);
    }
    private static Object call(MinimaService service, String name) throws Exception {
        Method method = MinimaService.class.getDeclaredMethod(name); method.setAccessible(true); return method.invoke(service);
    }
    @Test public void startupAndCachedBlockKeepTheirMeaningInEveryLanguage() throws Exception {
        MinimaService service = mock(MinimaService.class, CALLS_REAL_METHODS);
        JSONObject header = new JSONObject(); header.put("block", "0000123456789"); header.put("timemilli", "1792281600000");
        JSONObject block = new JSONObject(); block.put("header", header);
        try (MockedStatic<Language> language = mockStatic(Language.class)) {
            for (String code : new String[]{"en", "zh-Hans", "ru", "uk"}) {
                language.when(() -> Language.text(service, l10n_startup_starting)).thenReturn(code + " starting");
                language.when(() -> Language.date(1792281600000L, "yMdHms")).thenReturn(code + " date");
                service.mTxPowJSON = null;
                assertEquals(code + " starting", call(service, "nodeStatusText"));
                service.mTxPowJSON = block;
                assertEquals("0000123456789 @ " + code + " date", call(service, "nodeStatusText"));
                assertEquals("0000123456789", header.getString("block"));
                assertEquals("1792281600000", header.getString("timemilli"));
            }
        }
    }
    @Test public void languageRefreshUpdatesExistingNotificationWithoutForegroundPromotion() throws Exception {
        MinimaService service = mock(MinimaService.class, CALLS_REAL_METHODS);
        NotificationManager manager = mock(NotificationManager.class);
        Notification notification = mock(Notification.class);
        service.mNotificationManager = manager;
        doReturn(notification).when(service).createNotification(anyString());
        set(service, "foregroundActive", true);
        try (MockedStatic<Language> language = mockStatic(Language.class);
             MockedStatic<NotificationLabels> channels = mockStatic(NotificationLabels.class)) {
            language.when(() -> Language.text(service, l10n_startup_starting)).thenReturn("starting");
            call(service, "refreshLanguageNotification");
            verify(manager).notify(1, notification);
            verify(service).createNotification("starting");
            verify(service, never()).startForeground(anyInt(), any());
            channels.verify(() -> NotificationLabels.update(service));
            doThrow(new SecurityException("synthetic OS refusal")).when(manager).notify(1, notification);
            call(service, "refreshLanguageNotification"); // refusal must not escape and interrupt selection
        }
    }
    @Test public void inactiveAndDestroyedServicesCannotResurrectNotifications() throws Exception {
        MinimaService service = mock(MinimaService.class, CALLS_REAL_METHODS);
        NotificationManager manager = mock(NotificationManager.class); service.mNotificationManager = manager;
        call(service, "refreshLanguageNotification");
        set(service, "foregroundActive", true); set(service, "serviceDestroyed", true);
        call(service, "refreshLanguageNotification");
        call(service, "setMinimaNotification"); // late NEWBLOCK callback after shutdown
        verifyNoInteractions(manager);
        verify(service, never()).createNotification(anyString());
        verify(service, never()).startForeground(anyInt(), any());
    }
    @Test public void successfulForegroundPromotionRegistersTheExistingCallback() throws Exception {
        MinimaService service = mock(MinimaService.class, CALLS_REAL_METHODS);
        Notification notification = mock(Notification.class); Runnable callback = mock(Runnable.class);
        doReturn(notification).when(service).createNotification(anyString());
        doNothing().when(service).startForeground(anyInt(), any());
        set(service, "languageChanged", callback);
        try (MockedStatic<Language> language = mockStatic(Language.class)) {
            language.when(() -> Language.text(service, l10n_startup_starting)).thenReturn("starting");
            call(service, "setMinimaNotification");
            language.verify(() -> Language.addListener(callback));
            verify(service).startForeground(1, notification);
            verifyNoInteractions(callback);
        }
    }
    @Test public void notificationBuilderKeepsLiteralTitleAndLocalizedBody() throws Exception {
        MinimaService service = mock(MinimaService.class, CALLS_REAL_METHODS);
        doReturn(null).when(service).getBaseContext();
        Notification notification = mock(Notification.class);
        try (MockedStatic<Language> language = mockStatic(Language.class);
             MockedStatic<PendingIntent> pending = mockStatic(PendingIntent.class);
             MockedConstruction<Intent> intents = mockConstruction(Intent.class);
             MockedConstruction<NotificationCompat.Builder> builders = mockConstruction(NotificationCompat.Builder.class,
                     withSettings().defaultAnswer(RETURNS_SELF), (builder, context) -> when(builder.build()).thenReturn(notification))) {
            for (String code : new String[]{"en", "zh-Hans", "ru", "uk"}) {
                language.when(() -> Language.text(service, l10n_core_notice_status)).thenReturn(code + " node status");
                assertSame(notification, service.createNotification("000123 @ original date"));
                NotificationCompat.Builder builder = builders.constructed().get(builders.constructed().size() - 1);
                verify(builder).setContentTitle("000123 @ original date");
                verify(builder).setContentText(code + " node status");
                verify(builder).setSilent(true);
            }
        }
    }
}
