const $ = (s) => document.querySelector(s);
const lista = $('#lista');
let datos = [];
let filtro = 'todos';
let texto = '';

const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => MAP[c]);
const ETIQ = { video: 'Video', imagen: 'Imagen', musica: 'Música', enlace: 'Enlace' };

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('show'), 2200);
}
function ytId(u) {
  try {
    const x = new URL(u);
    if (x.hostname.includes('youtu.be')) return x.pathname.slice(1);
    if (x.hostname.includes('youtube.com')) return x.searchParams.get('v') || x.pathname.split('/').pop();
  } catch (e) {}
  return null;
}
function spotifyEmbed(u) {
  try {
    const x = new URL(u);
    if (x.hostname === 'open.spotify.com') return 'https://open.spotify.com/embed' + x.pathname;
  } catch (e) {}
  return null;
}
function media(r) {
  if (r.tipo === 'imagen') return `<img src="${esc(r.url)}" alt="${esc(r.titulo)}" loading="lazy">`;
  if (r.tipo === 'video') {
    const id = ytId(r.url);
    if (id) return `<div class="ratio"><iframe src="https://www.youtube.com/embed/${esc(id)}" title="${esc(r.titulo)}" allowfullscreen loading="lazy"></iframe></div>`;
  }
  if (r.tipo === 'musica') {
    const e = spotifyEmbed(r.url);
    if (e) return `<div class="spot"><iframe src="${esc(e)}" allow="encrypted-media" loading="lazy" title="${esc(r.titulo)}"></iframe></div>`;
  }
  return `<div class="link-ph">🔗</div>`;
}
function pintar() {
  const t = texto.toLowerCase();
  const vis = datos.filter((r) => (filtro === 'todos' || r.tipo === filtro) &&
    (!t || (r.titulo + ' ' + (r.descripcion || '')).toLowerCase().includes(t)));
  lista.innerHTML = vis.map((r, i) => `
    <article class="item" style="animation-delay:${Math.min(i, 8) * 60}ms">${media(r)}
      <div class="body">
        <span class="tag">${ETIQ[r.tipo] || r.tipo}</span>
        <h3>${esc(r.titulo)}</h3>
        <p>${esc(r.descripcion)}</p>
        <div class="actions">
          <a href="${esc(r.url)}" target="_blank" rel="noopener">Abrir ›</a>
          <span>
            <button class="chip like" data-like="${r.id}">♥ ${r.me_gusta}</button>
            <button class="chip del" data-del="${r.id}">Eliminar</button>
          </span>
        </div>
      </div>
    </article>`).join('');
  $('#vacio').hidden = vis.length > 0;
  const c = (k) => datos.filter((r) => r.tipo === k).length;
  $('#stats').innerHTML = [['Recursos', datos.length], ['Videos', c('video')], ['Imágenes', c('imagen')], ['Música', c('musica')]]
    .map(([n, v]) => `<div class="stat"><b>${v}</b><span>${n}</span></div>`).join('');
}
async function cargar() {
  try {
    datos = await (await fetch('/api/recursos')).json();
    pintar();
  } catch (e) { toast('No se pudo cargar la galería'); }
}
$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  const res = await fetch('/api/recursos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) return toast('Datos inválidos');
  e.target.reset();
  toast('Guardado ✓');
  await cargar();
  location.hash = '#galeria';
});
lista.addEventListener('click', async (e) => {
  const like = e.target.dataset.like, del = e.target.dataset.del;
  if (like) {
    await fetch(`/api/recursos/${like}/like`, { method: 'PUT' });
    cargar();
  } else if (del && confirm('¿Eliminar este recurso?')) {
    await fetch('/api/recursos/' + del, { method: 'DELETE' });
    toast('Eliminado');
    cargar();
  }
});
$('#filtros').addEventListener('click', (e) => {
  if (!e.target.dataset.f) return;
  filtro = e.target.dataset.f;
  document.querySelectorAll('#filtros button').forEach((b) => b.classList.toggle('on', b === e.target));
  pintar();
});
$('#buscar').addEventListener('input', (e) => { texto = e.target.value; pintar(); });
cargar();
