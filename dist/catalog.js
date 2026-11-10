import {saveCatalog} from './catalog-cache.js';
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
export function stockProductsFromCSV(text) {
 const rows = parseCSV(text), seen = new Set(), products = [];
 for (const [index, row] of rows.entries()) {
  if (row.length < 4 || !row[0].trim() || !row[2].trim()) throw new Error('Formato inesperado na linha ' + (index + 1) + ' da planilha.');
  const codigo = row[0].trim(), nome = row[2].trim(), unidade = normalizeUnit(row[3]);
  const rawBarcode = row[1].trim().replace(/^["']+|["']+$/g, '');
  const codigo_barras = /^(sem gtin|sem codigo|0)$/i.test(rawBarcode) ? '' : rawBarcode;
  const signature = JSON.stringify([codigo, codigo_barras, nome, row[3].trim(), (row[4] || '').trim(), (row[5] || '').trim(), (row[6] || '').trim().toUpperCase()]);
  if (seen.has(signature)) continue;
  seen.add(signature);
  products.push({ preco: (row[4] || '').trim(), promocao: (row[6] || '').trim().toUpperCase(), estoque: (row[5] || '').trim(), codigo, codigo_barras, nome, unidade, unidade_original: row[3].trim(), catalogId: 'row-' + index });
 }
 return products;
}
export function normalizeUnit(value) {
 const unit = value.trim().toLowerCase();
 return ({ un: 'und', uni: 'und', unidade: 'und', fd: 'fardo', frd: 'fardo', lts: 'lt' })[unit] || unit;
}
export async function loadCatalog(url, layout) {
  if (!url) throw new Error('A planilha de produtos ainda não foi vinculada.');
  const address = new URL(url);
  if (address.protocol !== 'https:' || address.hostname !== 'docs.google.com') throw new Error('Use o link CSV publicado pelo Google Sheets.');
  const response = await fetch(address, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Não foi possível ler a planilha. Confira a publicação e tente novamente.');
  const text = await response.text();
  if (/^\s*<!doctype html|^\s*<html/i.test(text)) throw new Error('A planilha pediu login. Libere a leitura da aba para o site.');
  const products=layout === 'estoque-sem-cabecalho' ? stockProductsFromCSV(text) : productsFromCSV(text);
  await saveCatalog(products);
  return products;
}
