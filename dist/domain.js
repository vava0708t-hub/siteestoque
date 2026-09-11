export const roles = ['vendedor', 'repositor', 'estoquista', 'admin'];
export const units = ['und', 'cx', 'pct', 'fardo', 'kg', 'lt'];
export const canRequest = role => ['vendedor', 'repositor'].includes(role);
export const canComplete = role => ['estoquista', 'admin'].includes(role);
export const validUsername = value => /^[a-z0-9][a-z0-9._-]{2,29}$/.test(value);
export function findProduct(products, code) {
  code = code.trim();
  return products.find(p => p.codigo === code || p.codigo_barras === code);
}
