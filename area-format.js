/* ─────────────────────────────────────────────────────────────────
   area-format.js — Shared area & price formatting
   Exposes: window.AN_FMT
   ─────────────────────────────────────────────────────────────────

   DATA CONTRACT (optional fields in each listing):
     interiorSize  {number}  Interior sq ft or m² (canonical; takes
                             priority over legacy `size` for display
                             and sorting).
     exteriorSize  {number}  Terrace / balcony / garden (same unit).
     size          {string}  Legacy built-area field (fallback).
     sizeUnit      {string}  'sqft' | omitted → m²

   MIAMI DUAL RULE:
     province === 'Florida' → always show both sq ft AND m².
     Derived value is rounded to integer and prefixed with ≈.
     Example: "430 sq ft (≈ 40 m²)"

   SORT FIELD:
     interiorSize ?? parseFloat(size) → AN_FMT.sortableSize(listing)

   PRICE PARSE:
     "From $419,900" → 419900  |  unparseable → Infinity (sorts last)
     Removes: "From", $, €, £, commas, spaces before parseFloat.
   ───────────────────────────────────────────────────────────────── */
;(function (w) {
  var SQ_FT_TO_M2 = 0.09290304

  function parsePrice(str) {
    if (!str || typeof str !== 'string') return Infinity
    var n = parseFloat(
      str.replace(/from\s*/i, '').replace(/[$€£,\s]/g, '').replace(/[^0-9.]/g, '')
    )
    return isNaN(n) ? Infinity : n
  }

  function isMiamiDual(listing) {
    return !!(listing && listing.province === 'Florida')
  }

  /* Returns { interior: string|null, exterior: string|null } */
  function formatAreaParts(listing) {
    if (!listing) return { interior: null, exterior: null }
    var dual   = isMiamiDual(listing)
    var isSqft = (listing.sizeUnit === 'sqft')

    var intRaw = (listing.interiorSize != null)
      ? parseFloat(listing.interiorSize)
      : parseFloat(String(listing.size != null ? listing.size : ''))
    var extRaw = (listing.exteriorSize != null)
      ? parseFloat(listing.exteriorSize)
      : NaN

    function fmt(val) {
      if (!isFinite(val) || val <= 0) return null
      if (isSqft) {
        var m2 = Math.round(val * SQ_FT_TO_M2)
        return dual ? (val + ' sq ft (≈ ' + m2 + ' m²)') : (val + ' sq ft')
      }
      if (dual) {
        var sqft = Math.round(val / SQ_FT_TO_M2)
        return val + ' m² (≈ ' + sqft + ' sq ft)'
      }
      return val + ' m²'
    }

    return { interior: fmt(intRaw), exterior: isNaN(extRaw) ? null : fmt(extRaw) }
  }

  /* Single-line convenience — returns interior string or '—' */
  function formatArea(listing) {
    return formatAreaParts(listing).interior || '—'
  }

  /* Canonical numeric value for size sorting */
  function sortableSize(listing) {
    if (!listing) return 0
    var v = (listing.interiorSize != null)
      ? parseFloat(listing.interiorSize)
      : parseFloat(String(listing.size != null ? listing.size : ''))
    return isFinite(v) ? v : 0
  }

  w.AN_FMT = {
    parsePrice:     parsePrice,
    isMiamiDual:    isMiamiDual,
    formatArea:     formatArea,
    formatAreaParts: formatAreaParts,
    sortableSize:   sortableSize,
  }
})(window)
