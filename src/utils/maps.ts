const join = (parts: (string | undefined)[]) => encodeURIComponent(parts.filter(Boolean).join(', '));

/** Google Maps directions to a place. */
export const mapsDirections = (parts: (string | undefined)[]) =>
  `https://www.google.com/maps/dir/?api=1&destination=${join(parts)}`;

/** Google Maps showing a place, such as an area. */
export const mapsSearch = (parts: (string | undefined)[]) =>
  `https://www.google.com/maps/search/?api=1&query=${join(parts)}`;
