package tech.trackium.core;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;
import org.junit.Test;
import static org.junit.Assert.*;

public class OfflineNodeStartupTest {
    @Test(timeout = 240_000) public void packagedNodeStartsReadsStatusAndRetainsWalletAcrossRestart() throws Exception {
        Path root = Files.createTempDirectory("trackium-disposable-node-");
        try {
            String first = run(root, 1), second = run(root, 2);
            assertEquals("The same disposable wallet identity must survive a clean restart", first, second);
        } finally {
            try (var files = Files.walk(root)) {
                for (Path p : files.sorted(java.util.Comparator.reverseOrder()).toArray(Path[]::new)) Files.deleteIfExists(p);
            }
        }
    }
    private String run(Path root, int pass) throws Exception {
        Path result = root.resolve("public-key-" + pass), log = root.resolve("private-test-log-" + pass);
        Process process = new ProcessBuilder(Path.of(System.getProperty("java.home"), "bin", "java").toString(),
                "-Xmx768m", "-cp", System.getProperty("java.class.path"), OfflineNodeProbe.class.getName(),
                root.resolve("node").toString(), result.toString())
                .redirectErrorStream(true).redirectOutput(log.toFile()).start();
        try {
            assertTrue("Disposable offline node must finish within 110 seconds", process.waitFor(110, TimeUnit.SECONDS));
            assertEquals("Offline node probe must exit cleanly (raw log intentionally not published)", 0, process.exitValue());
            assertTrue(Files.readString(log).contains("TRACKIUM_OFFLINE_NODE_READY_AND_STOPPED"));
            return Files.readString(result);
        } finally { if (process.isAlive()) { process.destroyForcibly(); process.waitFor(10, TimeUnit.SECONDS); } }
    }
}
