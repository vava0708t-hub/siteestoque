export function parseCSV(text) {
  const rows = []; let row = [], field = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); if (row.some(v => v.trim())) rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (quoted) throw new Error('A planilha contém um campo CSV com aspas incompletas.');
  row.push(field); if (row.some(v => v.trim())) rows.push(row);
  return rows;
}
export function productsFromCSV(text) {
  const [headers, ...rows] = parseCSV(text);
  const keys = (headers || []).map(h => h.trim().toLowerCase());
  if (!keys.includes('codigo') || !keys.includes('nome')) throw new Error('A planilha precisa das colunas codigo e nome.');
  const seen = new Set();
  return rows.map(row => {
    const product = Object.fromEntries(keys.map((key, i) => [key, (row[i] || '').trim()]));
    if (!product.codigo || !product.nome) throw new Error('Há produtos sem código ou nome na planilha.');
    if (seen.has(product.codigo)) throw new Error(`Código duplicado na planilha: ${product.codigo}`);
    seen.add(product.codigo); return product;
  });
}
export async function loadCatalog(url) {
  if (!url) throw new Error('A planilha de produtos ainda não foi vinculada.');
  const address = new URL(url);
  if (address.protocol !== 'https:' || address.hostname !== 'docs.google.com') throw new Error('Use o link CSV publicado pelo Google Sheets.');
  const response = await fetch(address, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Não foi possível ler a planilha. Confira a publicação e tente novamente.');
  return productsFromCSV(await response.text());
}
