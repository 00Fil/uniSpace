// Legge tools/*/tool.json e genera:
//   <out>/site/tools.json        elenco tool per la home
//   <out>/routes/<id>.caddy      una rotta Caddy per tool
//   <out>/static/<id>/           file dei tool statici (cartella public/)
// Le cartelle che iniziano con "_" o "." vengono ignorate (es. _templates).
import fs from 'node:fs';
import path from 'node:path';

const [toolsDir = 'tools', outDir = 'dist'] = process.argv.slice(2);
const fail = msg => { console.error(`\n✖ ${msg}\n`); process.exit(1); };
const ID = /^[a-z0-9][a-z0-9-]{0,40}$/;
const RESERVED = new Set(['tools.json', 'healthz', 'assets', 'index.html']);

const categories = JSON.parse(fs.readFileSync(path.join(toolsDir, 'categories.json'), 'utf8'));
const catIds = new Set(categories.map(c => c.id));

fs.rmSync(outDir, { recursive: true, force: true });
for (const d of ['site', 'routes', 'static']) fs.mkdirSync(path.join(outDir, d), { recursive: true });

const tools = [];
for (const dir of fs.readdirSync(toolsDir, { withFileTypes: true })) {
  if (!dir.isDirectory() || /^[_.]/.test(dir.name)) continue;
  const file = path.join(toolsDir, dir.name, 'tool.json');
  if (!fs.existsSync(file)) { console.warn(`! ${dir.name}: tool.json mancante, ignorato`); continue; }
  let t;
  try { t = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { fail(`${file}: JSON non valido (${e.message})`); }

  if (t.enabled === false) { console.log(`- ${t.id || dir.name} disattivato`); continue; }
  if (!ID.test(t.id || '')) fail(`${file}: "id" mancante o non valido (solo a-z, 0-9, -)`);
  if (t.id !== dir.name) fail(`${file}: "id" (${t.id}) deve essere uguale al nome della cartella (${dir.name})`);
  if (RESERVED.has(t.id)) fail(`${file}: "id" ${t.id} è riservato`);
  if (tools.some(x => x.id === t.id)) fail(`id duplicato: ${t.id}`);
  for (const k of ['name', 'description', 'category']) if (!t[k]) fail(`${file}: campo "${k}" obbligatorio`);
  if (!catIds.has(t.category)) fail(`${file}: categoria "${t.category}" non esiste in categories.json`);
  const type = t.type || 'static';
  if (!['static', 'service', 'link'].includes(type)) fail(`${file}: "type" deve essere static, service o link`);

  const p = `/${t.id}/`;
  const auth = t.auth ? '\timport hub_auth\n' : '';
  let route = `# ${t.name} (${type})\nredir /${t.id} ${p} 308\n`;
  if (type === 'service') {
    if (!/^[\w.-]+:\d+$/.test(t.upstream || '')) fail(`${file}: "upstream" obbligatorio per i service (es. "mio-tool:8000")`);
    route += `handle_path ${p}* {\n${auth}` +
      (t.maxUpload ? `\trequest_body {\n\t\tmax_size ${t.maxUpload}\n\t}\n` : '') +
      `\treverse_proxy ${t.upstream} {\n\t\tflush_interval -1\n\t}\n}\n`;
  } else if (type === 'static') {
    const pub = path.join(toolsDir, t.id, 'public');
    if (!fs.existsSync(path.join(pub, 'index.html'))) fail(`${t.id}: i tool statici devono avere public/index.html`);
    fs.cpSync(pub, path.join(outDir, 'static', t.id), { recursive: true });
    route += `handle_path ${p}* {\n${auth}\troot * /srv/tools/${t.id}\n\tfile_server\n}\n`;
  } else {
    if (!/^https?:\/\//.test(t.url || '')) fail(`${file}: "url" obbligatorio per i link`);
    route = '';
  }
  if (route) fs.writeFileSync(path.join(outDir, 'routes', `${t.id}.caddy`), route);

  tools.push({
    id: t.id, name: t.name, cat: t.category, icon: t.icon || 'box', iconSvg: t.iconSvg || null,
    desc: t.description, tags: t.tags || [], kw: t.keywords || '',
    url: type === 'link' ? t.url : p, external: type === 'link',
    isNew: !!t.isNew, order: t.order ?? 100, featured: t.featured || null,
  });
  console.log(`+ ${t.id.padEnd(16)} ${type.padEnd(8)} ${type === 'link' ? t.url : p}${t.auth ? '  (password)' : ''}`);
}
tools.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
fs.writeFileSync(path.join(outDir, 'site', 'tools.json'),
  JSON.stringify({ categories: categories.map(c => ({ id: c.id, name: c.name, c: c.color })), tools }, null, 1));
// almeno un file, così "import routes/*.caddy" non resta mai vuoto
fs.writeFileSync(path.join(outDir, 'routes', '_.caddy'), '# rotte generate da scripts/build-registry.mjs\n');
console.log(`\n${tools.length} tool registrati`);
