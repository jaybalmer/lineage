# Podcast sketches map data

Used only by the admin Sketches tab (`/admin/podcast/staging?tab=sketches`).
Copied from `podcast_archive/viz/`; these two files are the only ones that leave
that folder (brief Part B, B5).

- `land-50m.json`: world land outlines as TopoJSON, from the `world-atlas`
  package (Natural Earth 1:50m, public domain). Loaded lazily when the Map view
  first opens.
- `place-coords.json`: `{ "<staging place name>": [lat, lon] }`, 217 places,
  entered by hand. Positions are approximate. A place shows on the map only if
  its staging node name matches a key here exactly.
