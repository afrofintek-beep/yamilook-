# Postal reference on the AFROLOC card

The Yamilook card displays `Cx. Postal*` and retains the explanatory note in the shared text, image and print/PDF output. Terminology: Cód. Postal, Cx. Postal, Apartado n.º. These are distinct concepts; no official postal code is manufactured.

The read-only function `afroloc-postal-card` is deployed in the AFROLOC Supabase project (ljcxqwjvjgobhisqkujr), although its integration source is maintained here. It validates the Yamilook token itself, then uses the owner/session checked RPC in docs/database/postal-card-context.sql in Yamilook (rfayqekonkovfbkwjjum). Gateway JWT checking is disabled because the token belongs to the other project; application authentication is mandatory.

A linked reference requires an active, consumed, consented partner link, current unrevoked certificate, matching record revision and owner-bound box. Otherwise an exact active station match by province and municipality may produce a fixed example: seven station digits, hyphen, 10000 (the start of AFROLOC's standard five-digit range). This is not a unique allocation. No allocation RPC, counter update or box insertion occurs. Missing/ambiguous stations produce unavailable. Errors do not manufacture a reference.

An example is marked Exemplo and explains that it is not assigned, cannot receive correspondence/parcels and is not an official postal allocation. A linked reference also states that its display in Yamilook does not activate service or establish official allocation. AFROLOC digital station registration does not imply recognition as a Correios de Angola physical station.

The QR remains the protected LOCACCESS link. No coordinates or additional private address fields are returned by this service. Existing AFROLOC frontend deployment is not replaced by this integration.
