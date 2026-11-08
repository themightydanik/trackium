package com.eurobuddha.minimacore.chat;

import android.content.ContentResolver;
import android.content.Context;
import android.graphics.BitmapFactory;
import android.net.Uri;
import com.eurobuddha.maxima.core.media.MediaCodec;
import com.eurobuddha.maxima.core.media.MediaService;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.i18n.R;
import java.io.ByteArrayInputStream;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Iterator;
import java.util.Locale;
import org.minima.utils.json.JSONArray;
import org.minima.utils.json.JSONObject;
import org.minima.utils.json.parser.JSONParser;
import org.junit.Test;
import org.mockito.MockedStatic;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

/** Reuses WalletMessages/Parlons lookup tests and exercises actual core media failures. */
public class ChatMessagesTest {
    static Object field(Object value, String name) throws Exception {
        Field f = Language.Message.class.getDeclaredField(name);
        f.setAccessible(true); return f.get(value);
    }
    static int resource(String key) throws Exception {
        String name = "l10n_" + key.replaceAll("([a-z0-9])([A-Z])", "$1_$2")
                .replace('.', '_').toLowerCase(Locale.ROOT);
        return R.string.class.getField(name).getInt(null);
    }
    static JSONObject source() throws Exception {
        return (JSONObject) new JSONParser().parse(new String(Files.readAllBytes(Path.of("../localization/chat-errors.json")), java.nio.charset.StandardCharsets.UTF_8));
    }
    static void checkError(Throwable error, String key, Object... arguments) throws Exception {
        String raw = error.getMessage();
        CharSequence value = ChatMessages.error(error);
        assertTrue(value instanceof Language.Message);
        assertEquals(resource(key), field(value, "resource"));
        assertArrayEquals(arguments, (Object[]) field(value, "arguments"));
        assertEquals(raw, error.getMessage());
    }
    @Test public void everyFixedFailureResolvesToItsDeclaredResource() throws Exception {
        JSONObject fixed = (JSONObject) source().get("fixed"); assertEquals(13, fixed.size());
        for (Iterator<String> it = fixed.keySet().iterator(); it.hasNext();) {
            String raw = it.next();
            checkError(new Exception(raw), (String) fixed.get(raw));
        }
    }
    @Test public void everyPatternPreservesLiteralDataAndNumbers() throws Exception {
        JSONArray patterns = (JSONArray) source().get("patterns"); assertEquals(6, patterns.size());
        for (int i = 0; i < patterns.size(); i++) {
            JSONObject row = (JSONObject) patterns.get(i); JSONArray kinds = (JSONArray) row.get("kinds");
            String raw = (String) row.get("template"); Object[] args = new Object[kinds.size()];
            for (int j = 0; j < args.length; j++) {
                String kind = (String) kinds.get(j);
                args[j] = kind.equals("integer") ? "00012345678901234567890"
                        : kind.equals("number") ? "00012.34000" : "could not read image 中文 Русский Українська $1 {0} <img>";
                raw = raw.replace("{" + j + "}", (String) args[j]);
            }
            checkError(new Exception(raw), (String) row.get("key"), args);
        }
    }
    @Test public void unknownDiagnosticsAndNearMatchesStayLiteral() {
        for (String raw : new String[]{"Copy", "Saved 中文 Українська $1 {0}",
                "could not read image\n", "media over NaN bytes", "media over 1e9 bytes",
                "MaximaPackage too big: 1 > 2 (peer would reply TOOBIG)\n",
                "node error: could not read image", "java.lang.RuntimeException: empty media"})
            assertEquals(raw, ChatMessages.message(raw));
        assertEquals("", ChatMessages.message(null));
        Exception noMessage = new Exception();
        assertEquals(noMessage.toString(), ChatMessages.error(noMessage));
    }
    @Test public void nestedDiagnosticLookingAddressesAreNeverTranslated() throws Exception {
        String data = "could not read image";
        checkError(new Exception("couldn't reach " + data + " on any known relay"),
                "chat.error.unreachableRelay", data);
        checkError(new Exception("anchor directory failed: " + data),
                "chat.error.anchorDirectory", data);
        assertEquals(resource("chat.error.operationFailed"), field(ChatMessages.error(null), "resource"));
    }
    @Test public void actualPhotoOpenAndDecodeFailuresRemainIntact() throws Exception {
        Context context = mock(Context.class); ContentResolver resolver = mock(ContentResolver.class);
        Uri uri = mock(Uri.class); when(context.getContentResolver()).thenReturn(resolver);
        when(resolver.openInputStream(uri)).thenReturn(null);
        Exception open = assertThrows(Exception.class, () -> ChatPhoto.encodeForSend(context, uri));
        assertEquals("could not open image", open.getMessage());
        checkError(open, "chat.error.openImage");
        ByteArrayInputStream stream = new ByteArrayInputStream(new byte[]{1, 2, 3});
        when(resolver.openInputStream(uri)).thenReturn(stream);
        try (MockedStatic<BitmapFactory> bitmap = mockStatic(BitmapFactory.class)) {
            bitmap.when(() -> BitmapFactory.decodeStream(stream)).thenReturn(null);
            Exception decode = assertThrows(Exception.class, () -> ChatPhoto.encodeForSend(context, uri));
            assertEquals("could not read image", decode.getMessage());
            checkError(decode, "chat.error.readImage");
        }
    }
    @Test public void actualEmptyMediaRejectionIsTranslatedWithoutChangingTransport() throws Exception {
        for (byte[] bytes : new byte[][]{null, new byte[0]}) {
            IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                    () -> MediaCodec.encrypt(bytes, "image/jpeg"));
            checkError(error, "chat.error.emptyMedia");
        }
    }
    @Test public void actualMeshLimitReportsOriginalSizesInEverySupportedLocale() throws Exception {
        Locale previous = Locale.getDefault();
        byte[] oversized = new byte[(int) MediaService.MAX_MESH_FILE_BYTES + 1];
        MediaService service = new MediaService(null, null);
        try {
            for (String code : new String[]{"en", "zh-Hans", "ru", "uk"}) {
                Locale.setDefault(Locale.forLanguageTag(code));
                IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                        () -> service.publish(oversized, "application/octet-stream"));
                checkError(error, "chat.error.meshLimit", "16", "16");
            }
        } finally { Locale.setDefault(previous); }
    }
}
