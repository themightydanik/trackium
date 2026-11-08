package com.eurobuddha.minimacore.integrated;
import org.junit.Test;
import static org.junit.Assert.*;
public class EmbeddedReadPolicyTest {
    @Test public void onlyExactMetadataReadsAreShared() {
        for(String read:new String[]{"status","balance","block","network","peers"})assertTrue(read,EmbeddedNodeTransport.sharedRead(read));
        for(String command:new String[]{"send address:0x01 amount:1","sign data:0x00","txnsign id:test","txnpost id:test","getaddress","newaddress","random","maxima action:info","coins","balance;send","status ","STATUS","balance tokenid:0x00","status;status","checkmode","",null})assertFalse(command,EmbeddedNodeTransport.sharedRead(command));
    }
}
