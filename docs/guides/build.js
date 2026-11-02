/*
 * Builds the three PDF guides (customer, partner, ads) from guides.js:
 *   node docs/guides/build.js
 * Each step is a short explanation beside a drawn phone screen in the apps' own colours.
 * Needs Google Chrome (or Edge) installed; writes docs/guides/*.html and *.pdf.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { GUIDES } = require('./guides');

const BLUE = ['#0055D3', '#1D76FA'];
const ICON = (name) => `<i class="fa-solid fa-${name}"></i>`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** One element of a drawn phone screen. */
function el(e) {
  switch (e.t) {
    case 'header':
      return `<div class="m-head" style="background:linear-gradient(135deg,${(e.g || BLUE).join(',')})">
        ${e.back ? `<span class="m-back">${ICON('chevron-left')}</span>` : `<span class="m-logo">${ICON(e.icon || 'shapes')}</span>`}
        <div><div class="m-title">${esc(e.title)}</div>${e.sub ? `<div class="m-sub">${esc(e.sub)}</div>` : ''}</div></div>`;
    case 'card':
      return `<div class="m-card" ${e.c ? `style="border-color:${e.c}55;background:${e.c}0F"` : ''}>
        <span class="m-ic" style="background:${e.c || BLUE[0]}">${ICON(e.icon || 'circle')}</span>
        <div><b>${esc(e.title)}</b>${e.text ? `<div class="m-muted">${esc(e.text)}</div>` : ''}</div>${e.right ? `<span class="m-pill" style="background:${e.rc || BLUE[0]}">${esc(e.right)}</span>` : ''}</div>`;
    case 'grid':
      return `<div class="m-grid">${e.items
        .map((i) => `<div class="m-way" style="background:linear-gradient(135deg,${i.g.join(',')})"><span class="m-way-ic">${ICON(i.icon)}</span><i class="fa-solid fa-${i.icon} m-way-big"></i><b>${esc(i.text)}</b><small>${esc(i.sub || '')}</small></div>`)
        .join('')}</div>`;
    case 'btn':
      return `<div class="m-btn" style="background:${e.c ? e.c : `linear-gradient(90deg,${BLUE.join(',')})`}">${e.icon ? ICON(e.icon) + ' ' : ''}${esc(e.text)}</div>`;
    case 'btns':
      return `<div class="m-btns">${e.items.map((b) => `<div class="m-btn" style="background:${b.c || `linear-gradient(90deg,${BLUE.join(',')})`};${b.outline ? `background:#fff;color:${b.outline};border:1.5px solid ${b.outline}` : ''}">${esc(b.text)}</div>`).join('')}</div>`;
    case 'chips':
      return `<div class="m-chips">${e.items.map((c, i) => `<span class="${i === (e.active ?? -1) || (e.multi || []).includes(i) ? 'on' : ''}">${esc(c)}</span>`).join('')}</div>`;
    case 'input':
      return `<div class="m-input">${e.icon ? ICON(e.icon) + ' ' : ''}<span>${esc(e.text)}</span></div>`;
    case 'row':
      return `<div class="m-row">${ICON(e.icon || 'circle')}<span>${esc(e.text)}</span>${e.right ? `<b>${esc(e.right)}</b>` : ''}</div>`;
    case 'note':
      return `<div class="m-note" style="${e.c ? `border-color:${e.c}66;background:${e.c}14` : ''}">${ICON(e.icon || 'circle-info')} <span>${esc(e.text)}</span></div>`;
    case 'pin':
      return `<div class="m-pin">${String(e.digits).split('').map((d) => `<span>${d}</span>`).join('')}</div>`;
    case 'map':
      return `<div class="m-map"><span class="m-dot a"></span><span class="m-dot b"></span><span class="m-line"></span><small>${esc(e.text || 'Live map')}</small></div>`;
    case 'voice':
      return `<div class="m-voice"><span class="m-play">${ICON('play')}</span><div class="m-wave">${Array.from({ length: 22 }, (_, i) => `<i style="height:${6 + ((i * 37) % 16)}px"></i>`).join('')}</div><small>${esc(e.time || '0:12')}</small></div>`;
    case 'photos':
      return `<div class="m-photos">${Array.from({ length: e.n || 3 }, () => `<span>${ICON('image')}</span>`).join('')}</div>`;
    case 'stars':
      return `<div class="m-stars">${'★★★★★'.slice(0, e.n || 5)}<span>${'★★★★★'.slice(e.n || 5)}</span></div>`;
    case 'tabs':
      return `<div class="m-tabs">${e.items.map((x, i) => `<span class="${i === e.active ? 'on' : ''}">${ICON(x)}</span>`).join('')}</div>`;
    case 'slider':
      return `<div class="m-slider"><div>${ICON('rectangle-ad')} ${esc(e.text || 'Sponsored')}</div><small>16 : 9</small></div>`;
    case 'popup':
      return `<div class="m-popup"><b>${esc(e.title)}</b><div class="m-muted">${esc(e.text)}</div><div class="m-btns"><div class="m-btn" style="background:#fff;color:#dc2626;border:1.5px solid #dc2626">Later</div><div class="m-btn" style="background:#16A34A">Accept</div></div></div>`;
    default:
      return '';
  }
}

function phone(screen) {
  return `<div class="phone"><div class="notch"></div><div class="screen">${screen.map(el).join('')}</div></div>`;
}

function render(guide) {
  const toc = guide.chapters.map((c, i) => `<li><b>${i + 1}.</b> ${esc(c.title)}</li>`).join('');
  const chapters = guide.chapters
    .map(
      (c, ci) => `<section class="chapter">
      <h2><span>${ci + 1}</span>${esc(c.title)}</h2>${c.intro ? `<p class="intro">${esc(c.intro)}</p>` : ''}
      ${c.steps
        .map(
          (s, si) => `<div class="step">
          <div class="text"><div class="num">Step ${si + 1}</div><h3>${esc(s.title)}</h3>
            ${(s.points || []).map((p) => `<p class="pt">${esc(p)}</p>`).join('')}
            ${s.tip ? `<div class="tip">${ICON('lightbulb')} ${esc(s.tip)}</div>` : ''}
          </div>${s.screen ? phone(s.screen) : ''}</div>`,
        )
        .join('')}
    </section>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(guide.title)}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:14mm 12mm}
*{box-sizing:border-box}body{font-family:Poppins,Arial,sans-serif;color:#0f172a;margin:0;font-size:12.5px;line-height:1.55}
.cover{height:265mm;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:0 14mm;background:linear-gradient(140deg,${guide.color.join(',')});color:#fff;border-radius:18px;page-break-after:always;position:relative;overflow:hidden}
.cover .big{position:absolute;right:-30px;bottom:-40px;font-size:340px;opacity:.12}
.cover h1{font-size:40px;margin:0 0 8px;line-height:1.15}.cover p{font-size:16px;opacity:.95;max-width:120mm;margin:0 0 6px}
.cover .badge{background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);padding:6px 14px;border-radius:999px;margin-bottom:22px;font-weight:600}
.toc{page-break-after:always}.toc h2{font-size:22px}.toc ol{list-style:none;padding:0;columns:2;font-size:14px}.toc li{padding:7px 0;border-bottom:1px solid #e2e8f0;break-inside:avoid}
.chapter{page-break-before:always}.chapter h2{font-size:22px;display:flex;align-items:center;gap:12px;margin:0 0 6px}
.chapter h2 span{background:linear-gradient(135deg,${guide.color.join(',')});color:#fff;border-radius:12px;width:38px;height:38px;display:inline-flex;align-items:center;justify-content:center;font-size:18px}
.intro{color:#475569;margin:0 0 14px;font-size:13px}
.step{display:flex;gap:18px;align-items:flex-start;padding:14px 0;border-top:1px solid #e2e8f0;break-inside:avoid}
.step .text{flex:1}.num{color:${guide.color[0]};font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.step h3{margin:2px 0 6px;font-size:15.5px}.pt{margin:0 0 5px;padding-left:16px;position:relative}.pt:before{content:'•';position:absolute;left:3px;color:${guide.color[0]};font-weight:700}
.tip{margin-top:8px;background:#fef9c3;border:1px solid #fde68a;border-radius:10px;padding:8px 10px;font-size:12px}.tip i{color:#ca8a04}
.phone{width:58mm;flex-shrink:0;border:6px solid #0f172a;border-radius:22px;background:#f9fcff;overflow:hidden;position:relative;box-shadow:0 6px 18px rgba(15,23,42,.18)}
.notch{position:absolute;top:0;left:50%;transform:translateX(-50%);width:18mm;height:9px;background:#0f172a;border-radius:0 0 8px 8px;z-index:2}
.screen{padding-bottom:8px;font-size:9px;min-height:80mm}
.m-head{color:#fff;padding:14px 8px 9px;display:flex;gap:6px;align-items:center}.m-title{font-weight:600;font-size:10.5px}.m-sub{font-size:7.5px;opacity:.9}
.m-back,.m-logo{width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.5);display:inline-flex;align-items:center;justify-content:center;font-size:8px;flex-shrink:0}
.m-card{margin:6px 7px 0;background:#fff;border:1px solid #e2e8f0;border-radius:9px;padding:6px;display:flex;gap:6px;align-items:center}
.m-ic{width:18px;height:18px;border-radius:50%;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:8px;flex-shrink:0}
.m-card>div{flex:1}.m-muted{color:#64748b;font-size:7.5px}.m-pill{color:#fff;border-radius:999px;padding:2px 6px;font-size:7px;font-weight:600}
.m-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:6px 7px 0}
.m-way{border-radius:9px;color:#fff;padding:6px;height:52px;position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end}
.m-way-ic{position:absolute;top:5px;left:5px;width:15px;height:15px;border-radius:50%;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-size:7px}
.m-way-big{position:absolute;right:-4px;bottom:-6px;font-size:30px;opacity:.18;transform:rotate(-12deg)}.m-way b{font-size:8px}.m-way small{font-size:6.5px;opacity:.9}
.m-btn{margin:7px 7px 0;color:#fff;border-radius:8px;text-align:center;padding:6px;font-weight:600;font-size:8.5px}
.m-btns{display:flex;gap:5px;margin:0 7px}.m-btns .m-btn{flex:1;margin:7px 0 0}
.m-chips{margin:6px 7px 0;display:flex;flex-wrap:wrap;gap:4px}.m-chips span{border:1px solid #cbd5e1;border-radius:999px;padding:2px 6px;font-size:7.5px;background:#fff}.m-chips .on{background:${BLUE[0]};color:#fff;border-color:${BLUE[0]}}
.m-input{margin:6px 7px 0;border:1px solid ${BLUE[0]}40;background:#fff;border-radius:8px;padding:6px;color:#64748b;font-size:8px}
.m-row{margin:5px 7px 0;display:flex;gap:6px;align-items:center;font-size:8px;border-bottom:1px solid #eef2f7;padding-bottom:4px}.m-row i{color:${BLUE[0]};width:10px}.m-row span{flex:1}
.m-note{margin:6px 7px 0;border:1px solid #cbd5e1;background:#f1f5f9;border-radius:8px;padding:5px;font-size:7.5px;display:flex;gap:5px}
.m-pin{display:flex;gap:5px;justify-content:center;margin:8px 0}.m-pin span{width:18px;height:22px;border:1.5px solid ${BLUE[0]};border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;background:#fff}
.m-map{margin:6px 7px 0;height:60px;border-radius:9px;background:repeating-linear-gradient(45deg,#e0ecff,#e0ecff 8px,#eef4ff 8px,#eef4ff 16px);position:relative}
.m-map small{position:absolute;bottom:3px;left:5px;font-size:7px;color:#334155}.m-dot{position:absolute;width:9px;height:9px;border-radius:50%;border:2px solid #fff}
.m-dot.a{background:#16A34A;left:20%;top:30%}.m-dot.b{background:${BLUE[0]};right:22%;top:55%}.m-line{position:absolute;left:24%;top:38%;width:52%;height:2px;background:${BLUE[0]};transform:rotate(14deg);transform-origin:left}
.m-voice{margin:6px 7px 0;border:1px solid ${BLUE[0]}33;background:${BLUE[0]}0D;border-radius:9px;padding:5px;display:flex;align-items:center;gap:5px}
.m-play{width:18px;height:18px;border-radius:50%;background:${BLUE[0]};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:7px}
.m-wave{flex:1;display:flex;align-items:center;gap:2px}.m-wave i{width:2px;background:${BLUE[0]}88;border-radius:1px;display:block}.m-voice small{font-size:7px;color:#64748b}
.m-photos{display:flex;gap:4px;margin:6px 7px 0}.m-photos span{width:24px;height:24px;border-radius:6px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:9px}
.m-stars{margin:6px 7px 0;color:#FBBF24;font-size:13px;text-align:center}.m-stars span{color:#cbd5e1}
.m-tabs{margin:9px 7px 0;background:#fff;border:1px solid #e2e8f0;border-radius:999px;display:flex;justify-content:space-around;padding:5px;color:#94a3b8;font-size:9px}.m-tabs .on{color:${BLUE[0]}}
.m-slider{margin:6px 7px 0;aspect-ratio:16/9;border-radius:9px;background:linear-gradient(135deg,#fde68a,#fb923c);color:#7c2d12;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:600;font-size:8px}
.m-popup{margin:8px 7px 0;background:#fff;border-radius:10px;padding:7px;box-shadow:0 4px 12px rgba(0,0,0,.2);border:1px solid #e2e8f0}
.foot{margin-top:20px;color:#64748b;font-size:11px;text-align:center}
</style></head><body>
<div class="cover"><i class="fa-solid fa-${guide.icon} big"></i><span class="badge">${esc(guide.badge)}</span><h1>${esc(guide.title)}</h1>
${guide.cover.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
<div class="toc"><h2>What's inside</h2><ol>${toc}</ol>${guide.help ? `<p class="intro">${esc(guide.help)}</p>` : ''}</div>
${chapters}
<p class="foot">Triolo · Help: support@triolo.in · Privacy, Terms and Refunds: triolo-web.vercel.app</p>
</body></html>`;
}

const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) =>
  fs.existsSync(p),
);
for (const guide of GUIDES) {
  const html = path.join(__dirname, `${guide.file}.html`);
  const pdf = path.join(__dirname, `${guide.file}.pdf`);
  fs.writeFileSync(html, render(guide));
  execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    '--virtual-time-budget=15000',
    `--print-to-pdf=${pdf}`,
    `file:///${html.replace(/\\/g, '/')}`,
  ]);
  console.log('wrote', pdf);
}
