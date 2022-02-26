// Various reverse-engineered versions of the allocation algorithms
// used by different countries to allocate 24-bit ICAO addresses based
// on the aircraft registration.
//
// These were worked out by looking at the allocation patterns and
// working backwards to an algorithm that generates that pattern,
// spot-checking aircraft to see if it worked.
// YMMV.
"use strict";

const registration_from_hexid = (function () {
    // hide the guts in a closure

    let limited_alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // 24 chars; no I, O
    let full_alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";  // 26 chars

    // handles 3-letter suffixes assigned with a regular pattern
    //
    // start: first hexid of range
    // s1: major stride (interval between different first letters)
    // s2: minor stride (interval between different second letters)
    // prefix: the registration prefix
    //
    // optionally:
    //   alphabet: the alphabet to use (defaults full_alphabet)
    //   first: the suffix to use at the start of the range (default: AAA)
    //   last: the last valid suffix in the range (default: ZZZ)

    let stride_mappings = [
        // South African stride mapping apparently no longer in use
        //{ start: 0x008011, s1: 26*26, s2: 26, prefix: "ZS-" },

        { start: 0x380000, s1: 1024, s2: 32, prefix: "F-B" },
        { start: 0x388000, s1: 1024, s2: 32, prefix: "F-I" },
        { start: 0x390000, s1: 1024, s2: 32, prefix: "F-G" },
        { start: 0x398000, s1: 1024, s2: 32, prefix: "F-H" },
        { start: 0x3A0000, s1: 1024, s2: 32, prefix: "F-O" },


        { start: 0x3C4421, s1: 1024,  s2: 32, prefix: "D-A", first: 'AAA', last: 'OZZ' },
        { start: 0x3C0001, s1: 26*26, s2: 26, prefix: "D-A", first: 'PAA', last: 'ZZZ' },
        { start: 0x3C8421, s1: 1024,  s2: 32, prefix: "D-B", first: 'AAA', last: 'OZZ' },
        { start: 0x3C2001, s1: 26*26, s2: 26, prefix: "D-B", first: 'PAA', last: 'ZZZ' },
        { start: 0x3CC000, s1: 26*26, s2: 26, prefix: "D-C" },
        { start: 0x3D04A8, s1: 26*26, s2: 26, prefix: "D-E" },
        { start: 0x3D4950, s1: 26*26, s2: 26, prefix: "D-F" },
        { start: 0x3D8DF8, s1: 26*26, s2: 26, prefix: "D-G" },
        { start: 0x3DD2A0, s1: 26*26, s2: 26, prefix: "D-H" },
        { start: 0x3E1748, s1: 26*26, s2: 26, prefix: "D-I" },

        { start: 0x448421, s1: 1024,  s2: 32, prefix: "OO-" },
        { start: 0x458421, s1: 1024,  s2: 32, prefix: "OY-" },
        { start: 0x460000, s1: 26*26, s2: 26, prefix: "OH-" },
        { start: 0x468421, s1: 1024,  s2: 32, prefix: "SX-" },
        { start: 0x490421, s1: 1024,  s2: 32, prefix: "CS-" },
        { start: 0x4A0421, s1: 1024,  s2: 32, prefix: "YR-" },
        { start: 0x4B8421, s1: 1024,  s2: 32, prefix: "TC-" },
        { start: 0x740421, s1: 1024,  s2: 32, prefix: "JY-" },
        { start: 0x760421, s1: 1024,  s2: 32, prefix: "AP-" },
        { start: 0x768421, s1: 1024,  s2: 32, prefix: "9V-" },
        { start: 0x778421, s1: 1024,  s2: 32, prefix: "YK-" },
        { start: 0xC00001, s1: 26*26, s2: 26, prefix: "C-F" },
        { start: 0xC044A9, s1: 26*26, s2: 26, prefix: "C-G" },
        { start: 0xE01041, s1: 4096,  s2: 64, prefix: "LV-" }
    ];

    // numeric registrations
    //  start: start hexid in range
    //  first: first numeric registration
    //  count: number of numeric registrations
    //  template: registration template, trailing characters are replaced with the numeric registration
    let numeric_mappings = [
        { start: 0x140000, first: 0,    count: 100000, template: "RA-00000" },
        { start: 0x0B03E8, first: 1000, count: 1000,   template: "CU-T0000" }
    ];

    // fill in some derived data
    for (let i = 0; i < stride_mappings.length; ++i) {
        let mapping = stride_mappings[i];

        if (!mapping.alphabet) {
            mapping.alphabet = full_alphabet;
        }

        if (mapping.first) {
            let c1 = mapping.alphabet.indexOf(mapping.first.charAt(0));
            let c2 = mapping.alphabet.indexOf(mapping.first.charAt(1));
            let c3 = mapping.alphabet.indexOf(mapping.first.charAt(2));
            mapping.offset = c1 * mapping.s1 + c2 * mapping.s2 + c3;
        } else {
            mapping.offset = 0;
        }

        if (mapping.last) {
            let c1 = mapping.alphabet.indexOf(mapping.last.charAt(0));
            let c2 = mapping.alphabet.indexOf(mapping.last.charAt(1));
            let c3 = mapping.alphabet.indexOf(mapping.last.charAt(2));
            mapping.end = mapping.start - mapping.offset +
                c1 * mapping.s1 +
                c2 * mapping.s2 +
                c3;
        } else {
            mapping.end = mapping.start - mapping.offset +
                (mapping.alphabet.length - 1) * mapping.s1 +
                (mapping.alphabet.length - 1) * mapping.s2 +
                (mapping.alphabet.length - 1);
        }
    }

    for (let i = 0; i < numeric_mappings.length; ++i) {
        numeric_mappings[i].end = numeric_mappings[i].start + numeric_mappings[i].count - 1;
    }

    function lookup(hexid) {
        hexid = +("0x" + hexid);

        if (isNaN(hexid)) {
            return null;
        }

        let reg;
        reg = n_reg(hexid);
        if (reg)
            return reg;

        reg = ja_reg(hexid);
        if (reg)
            return reg;

        reg = hl_reg(hexid);
        if (reg)
            return reg;

        reg = numeric_reg(hexid);
        if (reg)
            return reg;

        reg = stride_reg(hexid);
        if (reg)
            return reg;

        return null;
    }

    function stride_reg(hexid) {
        // try the mappings in stride_mappings
        let i;
        for (i = 0; i < stride_mappings.length; ++i) {
            let mapping = stride_mappings[i];
            if (hexid < mapping.start || hexid > mapping.end)
                continue;

            let offset = hexid - mapping.start + mapping.offset;

            let i1 = Math.floor(offset / mapping.s1);
            offset = offset % mapping.s1;
            let i2 = Math.floor(offset / mapping.s2);
            offset = offset % mapping.s2;
            let i3 = offset;

            if (i1 < 0 || i1 >= mapping.alphabet.length ||
                i2 < 0 || i2 >= mapping.alphabet.length ||
                i3 < 0 || i3 >= mapping.alphabet.length)
                continue;

            return mapping.prefix + mapping.alphabet.charAt(i1) + mapping.alphabet.charAt(i2) + mapping.alphabet.charAt(i3);
        }

        // nothing
        return null;
    }

    function numeric_reg(hexid) {
        // try the mappings in numeric_mappings
        let i;
        for (i = 0; i < numeric_mappings.length; ++i) {
            let mapping = numeric_mappings[i];
            if (hexid < mapping.start || hexid > mapping.end)
                continue;

            let reg = (hexid - mapping.start + mapping.first) + "";
            return mapping.template.substring(0, mapping.template.length - reg.length) + reg;
        }
    }

    //
    // US N-numbers
    //

    function n_letters(rem) {
        if (rem == 0)
            return "";

        --rem;
        return limited_alphabet.charAt(Math.floor(rem / 25)) + n_letter(rem % 25);
    }

    function n_letter(rem) {
        if (rem == 0)
            return "";

        --rem;
        return limited_alphabet.charAt(rem);
    }

    function n_reg(hexid) {
        let offset = hexid - 0xA00001;
        if (offset < 0 || offset >= 915399) {
            return null;
        }

        let digit1 = Math.floor(offset / 101711) + 1;
        let reg = "N" + digit1;
        offset = offset % 101711;
        if (offset <= 600) {
            // Na, NaA .. NaZ, NaAA .. NaZZ
            return reg + n_letters(offset);
        }

        // Na0* .. Na9*
        offset -= 601;

        let digit2 = Math.floor(offset / 10111);
        reg += digit2;
        offset = offset % 10111;

        if (offset <= 600) {
            // Nab, NabA..NabZ, NabAA..NabZZ
            return reg + n_letters(offset);
        }

        // Nab0* .. Nab9*
        offset -= 601;

        let digit3 = Math.floor(offset / 951);
        reg += digit3;
        offset = offset % 951;

        if (offset <= 600) {
            // Nabc, NabcA .. NabcZ, NabcAA .. NabcZZ
            return reg + n_letters(offset);
        }

        // Nabc0* .. Nabc9*
        offset -= 601;

        let digit4 = Math.floor(offset / 35);
        reg += digit4.toFixed(0);
        offset = offset % 35;

        if (offset <= 24) {
            // Nabcd, NabcdA .. NabcdZ
            return reg + n_letter(offset);
        }

        // Nabcd0 .. Nabcd9
        offset -= 25;
        return reg + offset.toFixed(0);
    }

    // South Korea
    function hl_reg(hexid) {
        if (hexid >= 0x71BA00 && hexid <= 0x71bf99) {
            return "HL" + (hexid - 0x71BA00 + 0x7200).toString(16);
        }

        if (hexid >= 0x71C000 && hexid <= 0x71C099) {
            return "HL" + (hexid - 0x71C000 + 0x8000).toString(16);
        }

        if (hexid >= 0x71C200 && hexid <= 0x71C299) {
            return "HL" + (hexid - 0x71C200 + 0x8200).toString(16);
        }

        return null;
    }

    // Japan
    function ja_reg(hexid) {
        let offset = hexid - 0x840000;
        if (offset < 0 || offset >= 229840)
            return null;

        let reg = "JA";

        let digit1 = Math.floor(offset / 22984);
        if (digit1 < 0 || digit1 > 9)
            return null;
        reg += digit1;
        offset = offset % 22984;

        let digit2 = Math.floor(offset / 916);
        if (digit2 < 0 || digit2 > 9)
            return null;
        reg += digit2;
        offset = offset % 916;

        if (offset < 340) {
            // 3rd is a digit, 4th is a digit or letter
            let digit3 = Math.floor(offset / 34);
            reg += digit3;
            offset = offset % 34;

            if (offset < 10) {
                // 4th is a digit
                return reg + offset;
            }

            // 4th is a letter
            offset -= 10;
            return reg + limited_alphabet.charAt(offset);
        }

        // 3rd and 4th are letters
        offset -= 340;
        let letter3 = Math.floor(offset / 24);
        return reg + limited_alphabet.charAt(letter3) + limited_alphabet.charAt(offset % 24);
    }

    return lookup;
})();

// make nodejs happy:
if (typeof module !== 'undefined') {
    module.exports = registration_from_hexid;
}
