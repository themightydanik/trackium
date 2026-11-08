package tech.trackium.cargo

import android.content.Context
import android.content.SharedPreferences
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONArray
import org.json.JSONObject

/** Atomic ciphertext in noBackupFilesDir; device-bound AES key never leaves Android Keystore. */
class SecureStore(private val context: Context) {
    private val lock = Any()

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existing = ks.getKey("trackium-storage-v1", null) as? SecretKey
        if (existing != null) return existing
        check(context.noBackupFilesDir.listFiles()?.none { it.name.endsWith(".enc") } != false) {
            "Keystore key lost: retain Gateway checkpoints and perform manual recovery"
        }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
            .apply {
                init(
                    KeyGenParameterSpec.Builder(
                            "trackium-storage-v1",
                            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                        )
                        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                        .setKeySize(256)
                        .build()
                )
            }
            .generateKey()
    }

    private fun file(name: String): AtomicFile {
        require(Regex("[a-z0-9-]{1,80}").matches(name))
        return AtomicFile(File(context.noBackupFilesDir, "$name.enc"))
    }

    fun read(name: String): JSONObject =
        synchronized(lock) {
            val f = file(name)
            if (!f.baseFile.exists()) return@synchronized JSONObject()
            val data = f.readFully()
            require(data.size in 29..8_388_608 && data[0] == 1.toByte()) {
                "Encrypted state malformed: manual recovery required"
            }
            val c = Cipher.getInstance("AES/GCM/NoPadding")
            c.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, data.copyOfRange(1, 13)))
            JSONObject(String(c.doFinal(data.copyOfRange(13, data.size)), Charsets.UTF_8))
        }

    fun write(name: String, value: JSONObject) =
        synchronized(lock) {
            val raw = value.toString().toByteArray(Charsets.UTF_8)
            require(raw.size <= 7_000_000)
            val c = Cipher.getInstance("AES/GCM/NoPadding")
            c.init(Cipher.ENCRYPT_MODE, key())
            val bytes = byteArrayOf(1) + c.iv + c.doFinal(raw)
            val f = file(name)
            val stream = f.startWrite()
            try {
                stream.write(bytes)
                stream.fd.sync()
                f.finishWrite(stream)
            } catch (e: Exception) {
                f.failWrite(stream)
                throw e
            }
        }

    fun config(): JSONObject = read("settings")

    fun updateConfig(change: (JSONObject) -> Unit) =
        synchronized(lock) {
            val v = config()
            change(v)
            write("settings", v)
        }

    fun sdkPreferences(): SharedPreferences = EncryptedSdkPreferences(this)
}

private class EncryptedSdkPreferences(private val store: SecureStore) : SharedPreferences {
    override fun getAll(): MutableMap<String, *> =
        store.read("ipc-auth").let { j ->
            j.keys().asSequence().associateWith { j.get(it) }.toMutableMap()
        }

    override fun getString(key: String?, defValue: String?): String? =
        store.read("ipc-auth").optString(key, defValue)

    override fun contains(key: String?) = store.read("ipc-auth").has(key)

    override fun edit(): SharedPreferences.Editor =
        object : SharedPreferences.Editor {
            private val additions = mutableMapOf<String, String?>()
            private var clear = false

            override fun putString(key: String?, value: String?): SharedPreferences.Editor {
                require(key != null)
                additions[key] = value
                return this
            }

            override fun remove(key: String?): SharedPreferences.Editor {
                require(key != null)
                additions[key] = null
                return this
            }

            override fun clear(): SharedPreferences.Editor {
                clear = true
                return this
            }

            override fun commit(): Boolean =
                try {
                    val j = if (clear) JSONObject() else store.read("ipc-auth")
                    for ((k, v) in additions) if (v == null) j.remove(k) else j.put(k, v)
                    store.write("ipc-auth", j)
                    true
                } catch (e: Exception) {
                    false
                }

            override fun apply() {
                check(commit()) { "IPC auth persistence failed" }
            }

            override fun putStringSet(
                k: String?,
                v: MutableSet<String>?,
            ): SharedPreferences.Editor = error("SDK string storage only")

            override fun putInt(k: String?, v: Int): SharedPreferences.Editor =
                error("SDK string storage only")

            override fun putLong(k: String?, v: Long): SharedPreferences.Editor =
                error("SDK string storage only")

            override fun putFloat(k: String?, v: Float): SharedPreferences.Editor =
                error("SDK string storage only")

            override fun putBoolean(k: String?, v: Boolean): SharedPreferences.Editor =
                error("SDK string storage only")
        }

    override fun getStringSet(k: String?, v: MutableSet<String>?): MutableSet<String>? =
        error("SDK string storage only")

    override fun getInt(k: String?, v: Int): Int = error("SDK string storage only")

    override fun getLong(k: String?, v: Long): Long = error("SDK string storage only")

    override fun getFloat(k: String?, v: Float): Float = error("SDK string storage only")

    override fun getBoolean(k: String?, v: Boolean): Boolean = error("SDK string storage only")

    override fun registerOnSharedPreferenceChangeListener(
        l: SharedPreferences.OnSharedPreferenceChangeListener?
    ) {}

    override fun unregisterOnSharedPreferenceChangeListener(
        l: SharedPreferences.OnSharedPreferenceChangeListener?
    ) {}
}

class DiskPublisherStore(private val secure: SecureStore) : PublisherStore {
    private fun name(id: String): String {
        require(Regex("[0-9a-f-]{36}").matches(id))
        return "proof-$id"
    }

    override fun load(id: String): JSONObject? = secure.read(name(id)).takeIf { it.has("proof_id") }

    override fun save(id: String, state: JSONObject) {
        secure.write(name(id), state)
        secure.updateConfig {
            val ids = it.optJSONArray("proof_ids") ?: JSONArray()
            if ((0 until ids.length()).none { i -> ids.getString(i) == id }) ids.put(id)
            it.put("proof_ids", ids)
        }
    }

    override fun reserve(id: String, limit: Int) {
        require(limit in 1..100)
        secure.updateConfig {
            val active = it.optString("active_proof")
            check(active.isEmpty() || active == id) { "Another local job owns this wallet slot" }
            val used = it.optJSONArray("reserved_ids") ?: JSONArray()
            if ((0 until used.length()).none { i -> used.getString(i) == id }) {
                check(used.length() < limit) { "Local Mainnet publication limit reached" }
                used.put(id)
            }
            it.put("reserved_ids", used).put("active_proof", id)
        }
    }

    override fun release(id: String) {
        secure.updateConfig { if (it.optString("active_proof") == id) it.remove("active_proof") }
    }
}
