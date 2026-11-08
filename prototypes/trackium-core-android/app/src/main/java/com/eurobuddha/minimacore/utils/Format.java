package com.eurobuddha.minimacore.utils;

import org.minima.utils.json.JSONObject;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Display formatting for wallet amounts, hashes and timestamps.
 *
 * Ported from the AtomiX companion app (apks/atomix Util.tidyAmount / MainActivity.shortAddr)
 * so the two apps read the same. Pure statics, no Android dependencies.
 */
public class Format {

    private static final BigDecimal SUMMARY_UNIT = new BigDecimal("0.000001");

    private Format(){}

    /** Chain IDs are command arguments: never allow whitespace or parameter separators. */
    public static boolean isValidTokenId(String id) {
        return id != null && ("0x00".equals(id) || id.matches("^0x[0-9a-fA-F]{2,64}$"));
    }

    /** Display only: at most six decimals; use tidyAmount for exact token/coin details. */
    public static String summaryAmount(String zAmount){
        if(zAmount == null || zAmount.isEmpty()) return "0";
        try {
            BigDecimal value = new BigDecimal(zAmount.trim());
            if(value.signum() == 0) return "0";
            // Do not hide a real balance as zero, even with very small exponents.
            if(value.abs().compareTo(SUMMARY_UNIT) < 0){
                return value.signum() > 0 ? "<0.000001" : ">-0.000001";
            }
            if(value.scale() < -1000) return zAmount;
            // AtomiX Util.fmt5, adapted to six places: never round spendable funds up.
            return tidyAmount(value.setScale(6, RoundingMode.DOWN).toPlainString());
        } catch (NumberFormatException | ArithmeticException exc) {
            return zAmount;
        }
    }

    /** Trim trailing zeros from a decimal amount string for tidy display. */
    public static String tidyAmount(String zAmount){
        if(zAmount == null || zAmount.isEmpty()){
            return "0";
        }
        try {
            // PandaDEX PriceMath.fmt: normalise without rounding or exponent form.
            // Regex zero-stripping corrupts exponents: 1.0E-10 becomes 1.0E-1.
            BigDecimal value = new BigDecimal(zAmount.trim()).stripTrailingZeros();
            // Malformed external data must not expand an enormous exponent in the UI.
            // Keep the exact original notation for values outside any node amount range.
            if (value.scale() > 1000 || value.scale() < -1000) return zAmount;
            return value.toPlainString();
        } catch (NumberFormatException | ArithmeticException exc) {
            return zAmount; // preserve placeholders and unexpected node responses
        }
    }

    // NOTE: there is deliberately no shortHash/abbreviate helper here. Hashes, addresses
    // and token ids are shown IN FULL everywhere in this app - wrapped if they need it -
    // and are copyable. If you are tempted to add one back, wrap the text instead.

    /**
     * Pull a bare Minima address out of whatever a QR actually contained.
     *
     * Wallets encode addresses plain, but also as URIs (minima:Mx… , minima://Mx…?amount=1).
     * A raw Mx… / 0x… is passed straight through - neither contains a colon, so a colon is a
     * reliable marker of a scheme rather than part of the address.
     */
    public static String cleanAddress(String zRaw){
        if(zRaw == null){
            return "";
        }

        String s = zRaw.trim();

        //Strip a URI scheme, but never touch a bare address
        if(!s.startsWith("0x") && !s.startsWith("Mx")){
            int colon = s.indexOf(':');
            if(colon > -1){
                s = s.substring(colon+1);
                while(s.startsWith("/")){
                    s = s.substring(1);
                }
            }
        }

        //Drop any query string / fragment the URI carried
        int cut = s.indexOf('?');
        if(cut > -1){ s = s.substring(0, cut); }
        cut = s.indexOf('#');
        if(cut > -1){ s = s.substring(0, cut); }

        //A QR can carry trailing whitespace or a newline
        return s.trim();
    }

    /**
     * Coarse "how stale is this" bucket. Coarse on purpose - the wallet re-renders this
     * every 10s and fine-grained seconds would visibly jitter.
     */
    public static String ago(long zWhen){
        if(zWhen <= 0){
            return "never";
        }

        long secs = (System.currentTimeMillis() - zWhen) / 1000;
        if(secs < 0){
            secs = 0;
        }

        if(secs < 5){       return "just now";          }
        if(secs < 60){      return secs+"s ago";        }
        if(secs < 3600){    return (secs/60)+"m ago";   }

        return (secs/3600)+"h ago";
    }

    /**
     * The amount of a coin in the units the balance is denominated in.
     *
     * A token coin carries both the raw Minima-scaled `amount` and the human `tokenamount`;
     * `balance.confirmed` is in token units, so summing raw `amount` would make the coin
     * modal's cross-check look broken for every non-Minima token.
     */
    public static String coinAmount(JSONObject zCoin){
        if(zCoin == null){
            return "0";
        }

        Object tokenamount = zCoin.get("tokenamount");
        if(tokenamount != null){
            return String.valueOf(tokenamount);
        }

        Object amount = zCoin.get("amount");
        return amount == null ? "0" : String.valueOf(amount);
    }

    /**
     * a - b as an exact decimal, clamped at zero. Returns an em dash if either side
     * is missing or not a number - this feeds the "locked" figure on the wallet card,
     * where a wrong number is worse than no number.
     */
    public static String subtract(String zA, String zB){
        try{
            BigDecimal diff = new BigDecimal(zA).subtract(new BigDecimal(zB));
            if(diff.signum() < 0){
                diff = BigDecimal.ZERO;
            }
            return tidyAmount(diff.toPlainString());

        }catch(Exception exc){
            return "—";
        }
    }

    /**
     * A Minima address the node will accept as `address:`. Checked BEFORE it goes into a command:
     * the node has no escape character, so a pasted "MxREAL burn:100" would otherwise inject a
     * burn. Mx addresses are upper-case base32; 0x is script hex.
     */
    public static boolean isValidAddress(String zAddress){
        return zAddress != null && zAddress.matches("(Mx[A-Z0-9]{20,}|0x[0-9A-Fa-f]{20,})");
    }

    /** A plain positive decimal. No sign, exponent or spaces - nothing the tokeniser can split. */
    public static boolean isValidAmount(String zAmount){
        return zAmount != null && zAmount.matches("[0-9]+(\\.[0-9]+)?")
                && new BigDecimal(zAmount).signum() > 0;
    }
}
