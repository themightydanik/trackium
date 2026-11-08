package com.eurobuddha.minimacore.maxchat;

import com.eurobuddha.maxima.core.MaximaNode;
import com.eurobuddha.maxima.core.chat.ChatEngine;
import com.eurobuddha.maxima.core.codec.MiniData;
import com.eurobuddha.maxima.core.msg.MaximaMessage;
import org.junit.*;
import java.lang.reflect.Field;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

public class MaxChatDispatchTest {
    private org.mockito.MockedStatic<android.util.Log> log;
    private MaximaNode node;
    private ChatEngine chat;
    private int epoch;
    @Before public void setup() throws Exception {
        log=mockStatic(android.util.Log.class);
        node=mock(MaximaNode.class);chat=mock(ChatEngine.class);
        Field current=MaxChat.class.getDeclaredField("sNode");current.setAccessible(true);current.set(null,node);
        Field generation=MaxChat.class.getDeclaredField("sEpoch");generation.setAccessible(true);epoch=generation.getInt(null);
        MaxChat.APPLICATION_LISTENERS.clear();
    }
    @After public void clear() throws Exception {
        log.close();
        MaxChat.APPLICATION_LISTENERS.clear();
        Field current=MaxChat.class.getDeclaredField("sNode");current.setAccessible(true);current.set(null,null);
    }
    @Test public void normalChatAndIntegratedAppBothReceiveWithoutReplacingEitherListener() {
        MaximaNode.MessageListener salon=mock(MaximaNode.MessageListener.class);
        MaxChat.APPLICATION_LISTENERS.add(salon);
        MaximaMessage message=new MaximaMessage();MiniData id=new MiniData("0x1234");
        MaxChat.dispatch(node,epoch,chat,message,id);
        verify(chat).onInbound(message,"0x1234");verify(salon).onMessage(message,id);
    }
    @Test public void previousNodeOrEpochCannotDeliverIntoCurrentApps() {
        MaximaNode.MessageListener salon=mock(MaximaNode.MessageListener.class);MaxChat.APPLICATION_LISTENERS.add(salon);
        MaxChat.dispatch(mock(MaximaNode.class),epoch,chat,new MaximaMessage(),null);
        MaxChat.dispatch(node,epoch-1,chat,new MaximaMessage(),null);
        verifyNoInteractions(chat,salon);
    }
    @Test public void failedApplicationListenerDoesNotConsumeAnotherAppsMessage() {
        MaximaNode.MessageListener broken=(message,id)->{throw new IllegalStateException();};
        MaximaNode.MessageListener salon=mock(MaximaNode.MessageListener.class);
        MaxChat.APPLICATION_LISTENERS.add(broken);MaxChat.APPLICATION_LISTENERS.add(salon);
        MaximaMessage message=new MaximaMessage();MaxChat.dispatch(node,epoch,chat,message,null);
        verify(chat).onInbound(message,"");verify(salon).onMessage(message,null);
    }
    @Test public void chatFailureStillAllowsSignatureCheckedSalonIntake() {
        MaximaNode.MessageListener salon=mock(MaximaNode.MessageListener.class);MaxChat.APPLICATION_LISTENERS.add(salon);
        MaximaMessage message=new MaximaMessage();when(chat.onInbound(any(),anyString())).thenThrow(new IllegalStateException());
        assertThrows(IllegalStateException.class,()->MaxChat.dispatch(node,epoch,chat,message,null));
        verify(salon).onMessage(message,null);
    }
}
