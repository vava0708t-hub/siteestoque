// Gera código de barras em SVG: EAN-13/UPC-A/EAN-8 quando o número é válido,
// senão Code 128 (B). Sem bibliotecas externas.
const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
const PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
export const CODE128 = ['212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212','112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131','311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321','112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121','313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111','314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114','122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212','124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113','114311','411113','411311','113141','114131','311141','411131','211412','211214','211232'];
const STOP = '2331112';

function checkDigit(digits) {
 // Pesos 3,1,3,1… contando da direita (vale para EAN-8, EAN-13 e UPC-A).
 let sum = 0;
 for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += Number(digits[i]) * w;
 return (10 - sum % 10) % 10;
}
export const validGtin = code => /^\d{8}$|^\d{12,13}$/.test(code) && checkDigit(code.slice(0, -1)) === Number(code.at(-1));

export function ean13Modules(code) {
 const first = Number(code[0]), parity = PARITY[first];
 let bits = '101';
 for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === 'L' ? L : G)[Number(code[i])];
 bits += '01010';
 for (let i = 7; i <= 12; i++) bits += R[Number(code[i])];
 return bits + '101';
}
export function ean8Modules(code) {
 let bits = '101';
 for (let i = 0; i < 4; i++) bits += L[Number(code[i])];
 bits += '01010';
 for (let i = 4; i < 8; i++) bits += R[Number(code[i])];
 return bits + '101';
}
export function code128Modules(text) {
 const values = [104];
 for (const char of text) { const c = char.charCodeAt(0); if (c < 32 || c > 126) throw new Error('Código com caractere não suportado.'); values.push(c - 32); }
 values.push(values.reduce((sum, v, i) => sum + v * (i || 1), 0) % 103);
 let bits = '';
 for (const pattern of [...values.map(v => CODE128[v]), STOP]) [...pattern].forEach((w, i) => { bits += (i % 2 ? '0' : '1').repeat(Number(w)); });
 return bits;
}

export function barcodeModules(raw) {
 const code = String(raw || '').trim();
 if (!code) return null;
 if (/^\d{12}$/.test(code) && validGtin(code)) return { type: 'EAN-13', text: '0' + code, bits: ean13Modules('0' + code) };
 if (/^\d{13}$/.test(code) && validGtin(code)) return { type: 'EAN-13', text: code, bits: ean13Modules(code) };
 if (/^\d{8}$/.test(code) && validGtin(code)) return { type: 'EAN-8', text: code, bits: ean8Modules(code) };
 if (code.length > 40) return null;
 try { return { type: 'Code 128', text: code, bits: code128Modules(code) }; } catch { return null; }
}

// SVG com zonas de silêncio; a altura é definida pelo CSS.
export function barcodeSvg(raw) {
 const result = barcodeModules(raw);
 if (!result) return '';
 const quiet = 10, width = result.bits.length + quiet * 2;
 let rects = '', x = 0;
 while (x < result.bits.length) {
  if (result.bits[x] === '1') { let w = 1; while (result.bits[x + w] === '1') w++; rects += '<rect x="' + (x + quiet) + '" width="' + w + '" height="40"/>'; x += w; }
  else x++;
 }
 return '<svg class="pl-barcode" viewBox="0 0 ' + width + ' 40" preserveAspectRatio="none" role="img" aria-label="Código de barras ' + result.text + '"><rect width="' + width + '" height="40" fill="#fff"/><g fill="#000">' + rects + '</g></svg>';
}
