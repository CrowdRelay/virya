# AREA and Virya Signal mobile bridge

The website remains the authority for live AREA drops, challenge issuance and location verification.

Virya Signal authenticates AREA requests with the fan session plus its local AREA wallet identifier. The website validates the fan session against CrowdRelay through one bounded server-side request. Raw fan tokens are not logged or persisted; the short-lived cache is keyed only by SHA-256.

Public wallet responses expose live drop identifiers only. Exact claim coordinates, radii and capacity remain server-side. Both the website and mobile app use the same coarse city-level reference points for map presentation and route starts.

The map must always render all city markers. Live state changes styling and claim availability; it must never hide the marker or city-list entry.
