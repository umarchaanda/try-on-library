const svg = (body: string, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const icons = {
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  arrowLeft: svg('<path d="M15 6l-6 6 6 6"/>'),
  camera: svg('<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.5-2h5L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.5"/>', 22),
  upload: svg('<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14"/>', 22),
  lock: svg('<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>', 14),
  person: svg('<circle cx="12" cy="6.5" r="2.75"/><path d="M7 21v-6.5a5 5 0 0 1 10 0V21"/>', 18),
  sun: svg('<circle cx="12" cy="12" r="3.5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>', 18),
  frame: svg('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 15.5 9 11l4 4 2.5-2.5L20 17"/>', 18),
  flip: svg('<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5"/><path d="M20 4v4.5h-4.5"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.5"/><path d="M4 20v-4.5h4.5"/>', 22),
  timer: svg('<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.5M9.5 3h5"/>', 22),
  refresh: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>', 18),
  sparkle: svg('<path d="M12 3.5l1.9 5.1L19 10.5l-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>', 18),
  bag: svg('<path d="M5 8h14l-1.2 11.1a1.5 1.5 0 0 1-1.5 1.4H7.7a1.5 1.5 0 0 1-1.5-1.4z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>', 18),
  download: svg('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19.5h14"/>', 18),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 18),
  alert: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.2v.1"/>', 26),
  chevrons: svg('<path d="M9.5 7 4.5 12l5 5M14.5 7l5 5-5 5"/>', 18),
};

/** Dashed head-and-shoulders outline shown over the camera view. */
export const bodyGuide = `<svg class="vto-guide pointer-events-none absolute inset-x-0 bottom-0 h-[88%] w-full" viewBox="0 0 200 300" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
<ellipse cx="100" cy="62" rx="27" ry="33"/>
<path d="M85 94c0 10-6 14-24 18-18 4-25 14-27 32L26 300M115 94c0 10 6 14 24 18 18 4 25 14 27 32L174 300"/>
</svg>`;
