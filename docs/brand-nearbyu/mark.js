// NearbyU, B1 refined: white, slim U. The road runs up both arms to the same height: on the left
// it meets the point of the location pin, on the right it runs straight into the bottom of the
// home (no gap) and in through its door.
function nearbyU(fg, cut) {
  return `
    <path d="M27 54V70A33 33 0 0 0 93 70V58H79V70A19 19 0 0 1 41 70V54Z" fill="${fg}" stroke="${fg}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M34 60V70A26 26 0 0 0 86 70V62" fill="none" stroke="${cut}" stroke-width="2.4" stroke-dasharray="4 5.5" stroke-linecap="round"/>
    <path d="M68 59V40H62L86 16L110 40H104V59Z" fill="${fg}" stroke="${fg}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M79.5 59.5V50.5a6.5 6.5 0 0 1 13 0V59.5Z" fill="${cut}"/>
    <circle cx="89.3" cy="54.5" r="1.4" fill="${fg}"/>
    <path d="M34 57C29 50.5 17 40.5 17 26.5A17 17 0 0 1 51 26.5C51 40.5 39 50.5 34 57Z" fill="${fg}" stroke="${cut}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="34" cy="26.5" r="6.6" fill="${cut}"/>`;
}

if (typeof module !== 'undefined' && require.main === module) {
  const fs = require('fs');
  let n = 0;
  const icon = (partner, size) => {
    const p = 'i' + n++;
    const cut = partner ? '#0B1F4D' : '#0055D3';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${size}" height="${size}"><defs><linearGradient id="${p}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${partner ? '#0B1F4D' : '#0046BE'}"/><stop offset="1" stop-color="${partner ? '#1A3C8C' : '#2B83FF'}"/></linearGradient></defs><rect width="120" height="120" rx="28" fill="url(#${p}bg)"/><g transform="translate(11 14) scale(.8)">${nearbyU('#FFFFFF', cut)}</g></svg>`;
  };
  fs.writeFileSync(__dirname + '/preview.html', `<html><body style="margin:0;background:#eef2f8;display:flex;gap:16px;padding:16px;align-items:flex-end">${icon(0, 260)}${icon(1, 260)}${icon(0, 64)}${icon(1, 48)}<svg viewBox="0 0 120 120" width="170" height="170">${nearbyU('#0055D3', '#FFFFFF')}</svg></body></html>`);
}
