package com.eurobuddha.minimacore.lock;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertFalse;

import org.junit.Test;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/**
 * Off-device proof of the PIN verifier: VaultCrypto round-trips, rejects the wrong PIN, rejects a
 * tampered container, and produces a different container each time (fresh salt + nonce). This is the
 * exact code path {@link AppLock#setPin}/{@link AppLock#verifyPin} run on-device.
 */
public class VaultCryptoTest {

    private static final byte[] SENTINEL = "minima-core-applock".getBytes(StandardCharsets.UTF_8);

    @Test
    public void roundTripsWithCorrectPin() throws Exception {
        byte[] container = VaultCrypto.encrypt("1234", SENTINEL);
        assertArrayEquals(SENTINEL, VaultCrypto.decrypt("1234", container));
    }

    @Test(expected = VaultCrypto.BadPassphraseException.class)
    public void rejectsWrongPin() throws Exception {
        byte[] container = VaultCrypto.encrypt("1234", SENTINEL);
        VaultCrypto.decrypt("9999", container);
    }

    @Test(expected = VaultCrypto.BadPassphraseException.class)
    public void rejectsTamperedContainer() throws Exception {
        byte[] container = VaultCrypto.encrypt("1234", SENTINEL);
        container[container.length - 1] ^= 0x01;   // flip one ciphertext bit
        VaultCrypto.decrypt("1234", container);
    }

    @Test
    public void everyContainerIsUnique() throws Exception {
        byte[] a = VaultCrypto.encrypt("1234", SENTINEL);
        byte[] b = VaultCrypto.encrypt("1234", SENTINEL);
        assertFalse("fresh salt+nonce must make containers differ", Arrays.equals(a, b));
    }
}
