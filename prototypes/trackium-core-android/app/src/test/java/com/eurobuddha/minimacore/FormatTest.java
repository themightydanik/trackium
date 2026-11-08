package com.eurobuddha.minimacore;

import org.junit.Test;
import com.eurobuddha.minimacore.utils.Format;
import java.math.BigDecimal;
import static org.junit.Assert.*;

public class FormatTest {
    @Test public void summaryLimitsDecimalsWithoutRoundingUp() {
        String exact = "23466.53282076419999999999999999999999999999997";
        assertEquals("23466.53282", Format.summaryAmount(exact));
        assertEquals("0.999999", Format.summaryAmount("0.999999999"));
        assertEquals("120.894059", Format.summaryAmount("120.8940599"));
        assertEquals("12.5", Format.summaryAmount("12.50000000"));
        assertEquals("100", Format.summaryAmount("100.000000"));
        assertEquals("12345678901234567890.123456",
                Format.summaryAmount("12345678901234567890.123456789"));
        assertEquals(exact, Format.tidyAmount(exact));
    }

    @Test public void summaryKeepsTinyBalancesVisible() {
        assertEquals("<0.000001", Format.summaryAmount("0.000000999999"));
        assertEquals("<0.000001", Format.summaryAmount("1.0E-44"));
        assertEquals("<0.000001", Format.summaryAmount("1E-2000000000"));
        assertEquals(">-0.000001", Format.summaryAmount("-1E-44"));
        assertEquals("0.000001", Format.summaryAmount("0.000001"));
        assertEquals("0", Format.summaryAmount("-0.00000000"));
    }

    @Test public void summaryHandlesNotationAndPlaceholders() {
        assertEquals("12000000000", Format.summaryAmount("1.200E+10"));
        assertEquals("1.234567", Format.summaryAmount(" 1.23456789 "));
        assertEquals("0", Format.summaryAmount(null));
        assertEquals("0", Format.summaryAmount(""));
        assertEquals("—", Format.summaryAmount("—"));
        assertEquals("1E+2000000000", Format.summaryAmount("1E+2000000000"));
    }

    @Test public void keepsEverySignificantDecimal() {
        String value = "23466.53282076419999999999999999999999999999997";
        assertEquals(value, Format.tidyAmount(value));
        assertEquals("0.00000000000000000000000000000000000000000001",
                Format.tidyAmount("1E-44"));
    }

    @Test public void exponentZerosNeverChangeTheValue() {
        for (String input : new String[]{"1.0E-10", "1.200E+10", "0.00000", "-0.000", "12.50000", "100"}) {
            assertEquals(input, 0, new BigDecimal(input).compareTo(new BigDecimal(Format.tidyAmount(input))));
        }
        assertEquals("0.0000000001", Format.tidyAmount("1.0E-10"));
        assertEquals("12000000000", Format.tidyAmount("1.200E+10"));
    }

    @Test public void retainsProvenTidyAmountBehavior() {
        // Existing PandaPools UtilTest vectors, unchanged.
        assertEquals("2", Format.tidyAmount("2.000000"));
        assertEquals("2.5", Format.tidyAmount("2.50"));
        assertEquals("100", Format.tidyAmount("100"));
        assertEquals("0", Format.tidyAmount(""));
        assertEquals("0", Format.tidyAmount(null));
        assertEquals("—", Format.tidyAmount("—"));
        assertEquals("1E-2000000000", Format.tidyAmount("1E-2000000000"));
    }

    @Test public void sendRefusesAnythingTheTokeniserCouldTurnIntoAParameter() {
        assertTrue(Format.isValidAddress("MxG18HGG6FJ038614Y8CW46US6G20810K0070CD00Z83282G60G1N6GADSYR77EHV3BAHBTFEJKHWG32CCGFZ"));
        assertTrue(Format.isValidAddress("0x7D39745FBD29049BE29850B55A18BF550E4D442F930F86266E34193D89042A90"));
        // The injection: a pasted "address" carrying a second parameter.
        assertFalse(Format.isValidAddress("MxG18HGG6FJ038614Y8CW46US6G20810K0070CD00Z832 burn:100"));
        assertFalse(Format.isValidAddress("MxG18HGG6FJ038614Y8CW46US6G20810K0070CD00Z832 split:20"));
        assertFalse(Format.isValidAddress("Mx"));
        assertFalse(Format.isValidAddress(""));
        assertFalse(Format.isValidAddress(null));
    }

    @Test public void amountsAreBareDecimalsGreaterThanZero() {
        assertTrue(Format.isValidAmount("1"));
        assertTrue(Format.isValidAmount("0.5"));
        assertTrue(Format.isValidAmount("1000000.000001"));
        assertFalse(Format.isValidAmount("0"));
        assertFalse(Format.isValidAmount("0.0"));
        assertFalse(Format.isValidAmount("-1"));
        assertFalse(Format.isValidAmount("1e3"));
        assertFalse(Format.isValidAmount("1 mine:false"));
        assertFalse(Format.isValidAmount(""));
        assertFalse(Format.isValidAmount(null));
    }
}
