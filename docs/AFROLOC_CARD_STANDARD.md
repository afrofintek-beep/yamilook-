# AFROLOC card contract v1

The three applications carry the same `src/shared/afroloc-card` source. Changes to the transport, renderer, export and field model must be released together and pass the same protocol tests. The visual base is the existing Yamilook card.

## Address and authority

- Preserve the complete issued AFROLOC code, including administrative segments, grid, X/Y components and any sequence suffix. Rendering and scanning never generate a replacement code.
- AFROLOC is authoritative for record status and official administrative fields. A Yamilook local review does not certify residence. NJILA public navigation does not establish ownership or certification.
- The common model supports holder/photo, place/type, country, province, municipality, commune, city, neighborhood, street, number, unit, complement, record status, validation source, verification time, issuance and address expiry. Missing values stay missing; never reconstruct an ambiguous administrative name from a short segment.
- Issue time, verification time, address expiry and card generation time are distinct. An access pass has its own expiry.

## QR transport and readers

- Public navigation: `https://www.njilamaps.com/?to=<encoded full code>`.
- Existing AFROLOC record lookup links remain usable where their public-lookup permission boundary is required. Readers accept approved AFROLOC `code` / `afroloc` query links, legacy `/a/<code>` and `#/publicLookup?code=...`.
- A bare printed legacy code remains importable. Untrusted hosts, duplicate parameters and mixed grant/address URLs are rejected.
- LOCACCESS: `https://app.afroloc.ao/experiencia/#acesso=<capability>`. It remains a separate access kind, never imported as a public address or passed to a public lookup API. The existing verifier continues to enforce proximity, expiry and revocation.
- The QR, clickable card and open button use the same destination within each card. Export does not append names, telephone numbers, coordinates or sessions to a QR URL.

## Presentation and export

The preview and exported PNG use the same SVG. It wraps the complete code and field values; contains a four-module QR quiet zone; and supports share, PNG save, copy and card-only print. Yamilook retains its contact/photo selection controls and freshness/expiry checks. NJILA only offers cards for shareable public endpoints. AFROLOC only builds owner cards from the owner's authorised records.

## Data availability

This frontend contract does not create a cross-service identity bridge or grant new database access. AFROLOC owner records have more fields than the current Yamilook summary and NJILA public resolver. The latter must display absent fields honestly until their existing authorised APIs supply them. A locally saved image is a snapshot; reissue it after data or QR changes.
