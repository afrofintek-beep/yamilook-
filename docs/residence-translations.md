# Residence and AFROLOC form translations

The 35 strings in `src/i18n/residence-keys.json` cover the residence questions, inline address choices, existing-card import, validation hints and reader messages. They are supplied for every enabled app language: pt, en, fr, ar, am, sw, ln, yo, sn and zu. Residence dictionaries merge into the existing interface namespace when the language loads; user-entered codes and filenames are never translated. Codes remain left-to-right in Arabic.

New translations were drafted using Google Translate, with technical terminology checked and AFROLOC, NJILA, Yamilook and Banda preserved. This is not a claim of native-speaker certification. Kimbundu, Umbundu and Kikongo remain disabled under the existing linguistic-review rollout; this change does not enable or represent those languages as complete.

Tests check complete key coverage across the ten enabled languages and changing language without losing an entered address, plus the existing residence and UI source checks. No real account registration or device-GPS test is claimed by these tests.
