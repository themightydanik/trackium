// SPDX-License-Identifier: GPL-3.0-or-later
// Mininotes is free software: GNU General Public License, version 3 or later. See LICENSE.
package com.eurobuddha.minimacore.maxchat;

/**
 * SHA3-256, because Android does not have one.
 *
 * <p>Maxima hashes with SHA3-256 — the message id, the address checksum — and Android ships no provider
 * that offers it at any version. The usual answer is to add Bouncy Castle, four megabytes of library for
 * one function, on a phone that already has every other primitive this app needs. This is that one
 * function: Keccak-f[1600] with the SHA-3 padding, about a hundred lines, and nothing else.
 *
 * <p>A hash that is subtly wrong would not crash. It would quietly produce a different identity and make
 * this phone invisible on the network for no visible reason — so this is checked against the published NIST
 * answers in {@code the runtime known-answer check in Hashes.setSha3}, and the transport core checks it again with its own known answer before it
 * will accept it.
 */
final class Sha3 {
    /** The rate for SHA3-256: 1088 bits of the 1600-bit state are absorbed at a time. */
    private static final int RATE=136;
    private static final int OUT=32;

    private static final long[] ROUND={
        0x0000000000000001L,0x0000000000008082L,0x800000000000808aL,0x8000000080008000L,
        0x000000000000808bL,0x0000000080000001L,0x8000000080008081L,0x8000000000008009L,
        0x000000000000008aL,0x0000000000000088L,0x0000000080008009L,0x000000008000000aL,
        0x000000008000808bL,0x800000000000008bL,0x8000000000008089L,0x8000000000008003L,
        0x8000000000008002L,0x8000000000000080L,0x000000000000800aL,0x800000008000000aL,
        0x8000000080008081L,0x8000000000008080L,0x0000000080000001L,0x8000000080008008L};

    /** How far each lane is rotated in rho, by (x,y) laid out as the state is. */
    private static final int[] ROTATE={
         0, 1,62,28,27,
        36,44, 6,55,20,
         3,10,43,25,39,
        41,45,15,21, 8,
        18, 2,61,56,14};

    static byte[] of(byte[] message) {
        long[] state=new long[25];
        byte[] block=new byte[RATE];
        int at=0;
        // Absorb: whole blocks first, then whatever is left over with the padding on the end.
        while(message.length-at>=RATE) {
            System.arraycopy(message,at,block,0,RATE);
            soak(state,block);
            at+=RATE;
        }
        int left=message.length-at;
        java.util.Arrays.fill(block,(byte)0);
        System.arraycopy(message,at,block,0,left);
        // The SHA-3 padding: the domain mark 0x06, zeroes, and the last bit of the block set.
        block[left]=(byte)0x06;
        block[RATE-1]|=(byte)0x80;
        soak(state,block);
        // Squeeze: SHA3-256 asks for less than one block, so one pass is all of it.
        byte[] out=new byte[OUT];
        for(int i=0;i<OUT;i++)out[i]=(byte)(state[i/8]>>>(8*(i%8)));
        return out;
    }

    private static void soak(long[] state,byte[] block) {
        for(int i=0;i<RATE/8;i++) {
            long lane=0;
            for(int b=7;b>=0;b--)lane=(lane<<8)|(block[i*8+b]&0xFFL);
            state[i]^=lane;
        }
        keccak(state);
    }

    /** Keccak-f[1600]: twenty-four rounds of theta, rho and pi, chi, then iota. */
    private static void keccak(long[] a) {
        long[] c=new long[5], b=new long[25];
        for(int round=0;round<24;round++) {
            for(int x=0;x<5;x++)c[x]=a[x]^a[x+5]^a[x+10]^a[x+15]^a[x+20];
            for(int x=0;x<5;x++) {
                long d=c[(x+4)%5]^Long.rotateLeft(c[(x+1)%5],1);
                for(int y=0;y<25;y+=5)a[y+x]^=d;
            }
            // Pi moves the lane at (x,y) to (y, 2x+3y). The lanes are laid out with x running fastest,
            // so the new home is ((2x+3y)%5)*5 + y - putting y in the x place, not the other way round.
            for(int x=0;x<5;x++)
                for(int y=0;y<5;y++)
                    b[((2*x+3*y)%5)*5+y]=Long.rotateLeft(a[y*5+x],ROTATE[y*5+x]);
            for(int x=0;x<5;x++)
                for(int y=0;y<5;y++)
                    a[y*5+x]=b[y*5+x]^((~b[y*5+((x+1)%5)])&b[y*5+((x+2)%5)]);
            a[0]^=ROUND[round];
        }
    }

    private Sha3(){}
}
