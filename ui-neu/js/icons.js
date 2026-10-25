/* ===========================================================================
   Misuc Neu — inline SVG icon set (current-color, 24px viewBox)
   Kept as raw path strings so views stamp them into buttons directly.
   =========================================================================== */

const wrap = (d) =>
  `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${d}</svg>`;

export const ICON = {
  logo: wrap(`<path d="M4 18V9l4 4 4-7 4 7 4-4v9z"/>`),
  play: wrap(`<path d="M8 5v14l11-7z"/>`),
  pause: wrap(`<path d="M7 5h3v14H7zM14 5h3v14h-3z"/>`),
  stop: wrap(`<path d="M6 6h12v12H6z"/>`),
  rec: wrap(`<circle cx="12" cy="12" r="6"/>`),
  rewind: wrap(`<path d="M6 6h2v12H6zm3 6l9-6v12z"/>`),
  loop: wrap(`<path d="M7 7h9a3 3 0 0 1 3 3v1h2v-1a5 5 0 0 0-5-5H7V3L3 6l4 3zm10 10H8a3 3 0 0 1-3-3v-1H3v1a5 5 0 0 0 5 5h9v2l4-3-4-3z"/>`),
  metro: wrap(`<path d="M12 3 6 20h12zM12 3v9m0 0-4 8m4-8 4 8"/>`),
  rack: wrap(`<path d="M4 6h16v3H4zm0 5h16v3H4zm0 5h16v3H4z"/>`),
  roll: wrap(`<path d="M3 5h3v14H3zM8 5h13v2H8zm0 4h13v2H8zm0 4h13v2H8zm0 4h13v2H8z"/>`),
  playlist: wrap(`<path d="M3 6h11v2H3zm0 4h11v2H3zm0 4h7v2H3zm12-4v8l5-4z"/>`),
  mixer: wrap(`<path d="M6 4v7M6 15v5M12 4v4M12 12v8M18 4v10M18 18v2M3.5 11h5v2h-5zM9.5 8h5v2h-5zM15.5 14h5v2h-5z"/>`),
  browser: wrap(`<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>`),
  settings: wrap(`<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.5 4-2-.6a6.5 6.5 0 0 0-.6-1.4l1-1.7-1.9-1.9-1.7 1a6.5 6.5 0 0 0-1.4-.6L13.5 4h-3l-.4 2a6.5 6.5 0 0 0-1.4.6l-1.7-1-1.9 1.9 1 1.7a6.5 6.5 0 0 0-.6 1.4l-2 .6v3l2 .6c.1.5.3 1 .6 1.4l-1 1.7 1.9 1.9 1.7-1c.4.3.9.5 1.4.6l.4 2h3l.4-2c.5-.1 1-.3 1.4-.6l1.7 1 1.9-1.9-1-1.7c.3-.4.5-.9.6-1.4l2-.6z"/>`),
  plus: wrap(`<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/>`),
  mute: wrap(`<path d="M4 9h3l5-4v14l-5-4H4zM16 9l4 6M20 9l-4 6"/>`),
  solo: wrap(`<path d="M5 5h14v14H5z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 12h8" stroke="currentColor" stroke-width="2"/>`),
  trash: wrap(`<path d="M9 4h6l1 2h4v2H4V6h4zM6 9h12l-1 11H7z"/>`),
  save: wrap(`<path d="M5 3h11l3 3v15H5zm3 0v6h8V3zM8 14h8v7H8z"/>`),
  moon: wrap(`<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z"/>`),
  sun: wrap(`<path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>`),
  pencil: wrap(`<path d="M4 20h4L20 8l-4-4L4 16zm10-14 4 4"/>`),
  eraser: wrap(`<path d="M8 20h12M4 16l8-8 6 6-6 6H8z"/>`),
  cursor: wrap(`<path d="M6 3l12 8-5 1.5L16 19l-2.5 1-3-6.5L6 17z"/>`),
  brush: wrap(`<path d="M14 4l6 6-8 8H6v-6z"/>`),
  hand: wrap(`<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5V5a1.5 1.5 0 0 1 3 0v6V7a1.5 1.5 0 0 1 3 0v7a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6v-3a1.5 1.5 0 0 1 3 0"/>`),
};
