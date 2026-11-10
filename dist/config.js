// Somente configurações públicas. Nunca coloque sb_secret ou service_role aqui.
export const config = Object.freeze({
  supabaseUrl: 'https://nldknkqukenyqkxnutaf.supabase.co',
  supabasePublishableKey: 'sb_publishable_Hmk8ftD93CmlZYK3N3DSKg_MECpjsy8',
  // Google Sheets: Arquivo > Compartilhar > Publicar na Web > CSV.
  // Colunas obrigatórias: codigo,nome. Opcionais: unidade,categoria.
  googleSheetsCsvUrl: 'https://docs.google.com/spreadsheets/d/1Rmel0Zn__nKtCOfAv1dCfs_YlFE9WkW8YDeEXnUF4zE/export?format=csv&gid=300918174',
  googleSheetsLayout: 'estoque-sem-cabecalho',
});
