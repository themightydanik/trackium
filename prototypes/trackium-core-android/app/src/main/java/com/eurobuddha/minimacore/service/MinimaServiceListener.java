package com.eurobuddha.minimacore.service;

public interface MinimaServiceListener {
    public void MinimaServiceShutdown();

    public void MinimaNewBlock();

    /**
     * The node's NEWBALANCE event - funds actually moved on chain.
     *
     * This, not a `send` command reply, is the point at which a transaction has really
     * landed. Default no-op so existing implementors need no change.
     */
    default void MinimaNewBalance(){}

    public void MinimaLoadKeys(int zKeys, boolean zFinished);

}
