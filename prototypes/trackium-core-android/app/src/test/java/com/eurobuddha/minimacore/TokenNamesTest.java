package com.eurobuddha.minimacore;

import org.junit.Test;
import static org.junit.Assert.*;
import org.minima.utils.json.JSONObject;
import com.eurobuddha.minimacore.main.views.balance.tokens.TokenMeta;
import com.eurobuddha.minimacore.utils.TokenUtils;
import com.eurobuddha.minimacore.utils.Format;
import com.eurobuddha.minimacore.i18n.Language;

public class TokenNamesTest {
    private JSONObject row(Object token){JSONObject j=new JSONObject();j.put("tokenid","0x1234");if(token!=null)j.put("token",token);return j;}
    private JSONObject name(Object name){JSONObject j=new JSONObject();j.put("name",name);return j;}
    @Test public void plainAndStructuredNamesUseTheExistingParser(){
        for(String literal:new String[]{"Token","Send","中文 Русский Українська {amount} $1","[1,2]"}){
            for(Object input:new Object[]{literal,name(literal),name(literal).toString(),name(name(literal))}){
                assertEquals(literal,TokenUtils.getTokenName(row(input)));
                assertEquals(literal,TokenUtils.getTokenDisplayName(row(input)));
                assertTrue(TokenMeta.parse(input,"0x1234").nameProvided);
            }
        }
    }
    @Test public void missingMetadataIsDifferentFromLiteralToken(){
        for(Object input:new Object[]{null,"",new JSONObject(),name(new JSONObject()),name("")}){
            assertFalse(TokenMeta.parse(input,"0x1234").nameProvided);
            assertTrue(TokenUtils.getTokenDisplayName(row(input)) instanceof Language.Message);
        }
        assertTrue(TokenMeta.parse(null,"0x00").nameProvided);
        assertEquals("Minima",TokenMeta.parse(null,"0x00").name);
    }
    @Test public void tokenIdsCannotIntroduceCommandArguments(){
        for(String id:new String[]{"0x00","0x1234","0x"+String.join("",java.util.Collections.nCopies(64,"F"))})assertTrue(id,Format.isValidTokenId(id));
        for(String id:new String[]{null,"","0x","0xZ1","0x00 burn:100","0x00;send amount:1","0x00\nsend","0x00\tquit"," 0x00","0x"+String.join("",java.util.Collections.nCopies(65,"f"))})assertFalse(id,Format.isValidTokenId(id));
    }
}
