package com.eurobuddha.minimacore.main.views.balance.tokens;
import org.junit.Test;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;
public class WebValidateTest {
    @Test public void distinguishesNetworkFailureFromNonMatchingDocument() {
        assertEquals(WebValidate.Result.UNAVAILABLE, WebValidate.verify(null, "0xabc123"));
        assertEquals(WebValidate.Result.NOT_VERIFIED, WebValidate.verify(new byte[0], "0xabc123"));
        assertEquals(WebValidate.Result.VERIFIED, WebValidate.verify("token: 0xABC123".getBytes(StandardCharsets.UTF_8), "0xabc123"));
        assertEquals(WebValidate.Result.NOT_VERIFIED, WebValidate.verify("anything".getBytes(StandardCharsets.UTF_8), "0x"));
    }
    @Test public void cachedProofIsBoundToTokenAndExactUrl() throws Exception {
        try (org.mockito.MockedStatic<android.os.SystemClock> clock = org.mockito.Mockito.mockStatic(android.os.SystemClock.class)) {
            clock.when(android.os.SystemClock::elapsedRealtime).thenReturn(1000L);
            java.lang.reflect.Field field = WebValidate.class.getDeclaredField("CACHE");
            field.setAccessible(true);
            @SuppressWarnings("unchecked") com.eurobuddha.minimacore.utils.ExpiringCache<String,WebValidate.Result> cache =
                    (com.eurobuddha.minimacore.utils.ExpiringCache<String,WebValidate.Result>) field.get(null);
            String token = "web-validation-test", url = "https://example.invalid/proof";
            cache.put(token + "|" + url, WebValidate.Result.VERIFIED, 300_000);
            assertEquals(Boolean.TRUE, WebValidate.status("0xWEB-VALIDATION-TEST", " " + url + " "));
            assertNull(WebValidate.status(token, url + "?different"));
            assertNull(WebValidate.status("another-token", url));
            assertFalse(WebValidate.needsCheck(token, url));
            assertTrue(WebValidate.needsCheck(token, url + "?different"));
            cache.put(token + "|" + url, WebValidate.Result.UNAVAILABLE, 30_000);
            assertNull(WebValidate.status(token, url));
            assertFalse(WebValidate.needsCheck(token, url));
            cache.put(token + "|" + url, WebValidate.Result.UNAVAILABLE, 0);
            assertTrue(WebValidate.needsCheck(token, url));
        }
    }
}
