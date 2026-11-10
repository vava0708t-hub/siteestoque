import {setupNavigation} from './navigation.js';
import {setupQuote} from './quote-ui.js';
import {setupReports} from './reports.js';
import {setupHelp} from './help.js';
import {playBeep} from './beep.js';
import './hero-scanner.js';
import { setupLookup } from './lookup.js';
import { setupCamera } from './camera.js';
import { stockLabel, itemBarcode, itemStockLabel, isNegativeStock, itemStockNegative } from './stock.js';
import { createCatalogSettings } from './settings-ui.js';
import { createListController } from './lists-ui.js';
import { config } from './config.js';
import { loadCatalog } from './catalog.js';
import { toast } from './toast.js';
import { roles, units, canRequest, canComplete, validUsername, matchingProducts, productKey, searchProducts } from './domain.js';
const $ = id => document.getElementById(id);
let client, session, profile, products = [], requests = [], signup = false;
const listController = createListController(() => ({client,session,profile,barcodeFor:item=>itemBarcode(products,item),stockFor:item=>itemStockLabel(products,item),stockNegative:item=>itemStockNegative(products,item),hasProducts:()=>products.length>0,brands:()=>catalogSettings.brands(),aisles:()=>catalogSettings.aisles()}));
const catalogSettings=createCatalogSettings(()=>({client,profile,notify:toast}),()=>listController.render());
const navigation=setupNavigation();
const quote=setupQuote();
const reports=setupReports(()=>({client,session,profile}));
const help=setupHelp(view=>{history.replaceState(null,'','#'+view);navigation.show(view);});
const lookup=setupLookup(()=>products,product=>quote.select(product));
const busy = value => $('loading').classList.toggle('finished', !value);
const fail = error => toast(error.message || 'Não foi possível concluir.', 'error');
function mode(value) {
 signup = value; $('signup-fields').hidden = !value; $('name').required = value; $('password').minLength = value ? 6 : 1; $('password').placeholder = value ? 'Pelo menos 6 caracteres' : 'Sua senha';
 for (const [id, active] of [['login-tab', !value], ['signup-tab', value]]) { $(id).classList.toggle('active', active); $(id).setAttribute('aria-pressed', String(active)); }
 $('auth-title').textContent = value ? 'Faça parte da equipe.' : 'Bom ter você por aqui.';
 $('auth-submit').textContent = value ? 'Criar minha conta →' : 'Entrar na minha conta →';
 $('password').autocomplete = value ? 'new-password' : 'current-password';
}
$('login-tab').onclick = () => mode(false); $('signup-tab').onclick = () => mode(true);
function clearSession() { camera.close(); navigation.configure(null);quote.configure(null,null);reports.configure(null,null); listController.reset(); session = profile = null; requests = []; products = []; lookup.reset(); $('requests').replaceChildren(); $('admin-users').replaceChildren(); $('workspace').hidden = true; $('auth').hidden = false; $('logout').hidden = true; $('settings-toggle').hidden = true; $('account-panel').open = false; $('profile-form').reset(); $('password-form').reset(); }
async function showSession(next) {
 if (!next) { clearSession(); return; } session = next;
 const { data, error } = await client.from('profiles').select('*').eq('id', next.user.id).single();
 if (error) throw new Error('Não foi possível carregar seu perfil. Confira a instalação do banco.');
 profile = data; listController.activate(); $('auth').hidden = true; $('workspace').hidden = false; $('logout').hidden = false; $('settings-toggle').hidden = false; $('account-name').value = profile.name; $('account-username').value = profile.username;
 $('identity').textContent = profile.name + ' / ' + profile.role.toUpperCase();
 $('account-role-note').textContent='Seu cargo: '+profile.role+'. A mudança de cargo é feita pelo administrador.';
 $('pending-role').hidden = !!profile.active;
 $('request-panel').hidden = !profile.active || !canRequest(profile.role);
 $('work-grid').classList.toggle('single-column', $('request-panel').hidden);
 $('admin-panel').hidden = !profile.active || profile.role !== 'admin';
 quote.configure(profile,session.user.id);reports.configure(profile,session.user.id);help.configure(profile);navigation.configure(profile);
 await refresh();
}
async function refresh() {
 $('refresh').disabled = true;
 try { await Promise.all([fetchRequests(), fetchProducts(), fetchUsers(), catalogSettings.load()]); } finally { $('refresh').disabled = false; }
}
async function fetchProducts() {
 $('request-submit').disabled = true;
 try {
 products = await loadCatalog(config.googleSheetsCsvUrl, config.googleSheetsLayout);
 $('catalog-updated').textContent='Planilha consultada em '+new Date().toLocaleString('pt-BR');
 if(!$('barcode').value.trim()&&!$('product-search').value.trim())renderProductOptions(searchProducts(products, ''));
 $('product-count').textContent = products.length;
 $('catalog-status').textContent = products.length ? 'Bipe o código ou selecione um produto da planilha.' : 'A planilha ainda não tem produtos.';
 } catch(error) { $('catalog-updated').textContent='Falha na leitura da planilha. Atualize para tentar novamente.'; products = []; $('product').value='';closeSuggestions(); $('product-count').textContent = '—'; $('catalog-status').textContent = error.message; }
 $('request-submit').disabled = !products.length; listController.renderDraft(); listController.render(); lookup.reset();quote.select(null);
}
async function fetchRequests() { await listController.load(); }
function el(tag, text, css) { const node = document.createElement(tag); node.textContent = text; if (css) node.className = css; return node; }
function renderRequests() { listController.render(); }
$('filter').onchange = () => listController.filterChanged().catch(fail); $('aisle-filter').oninput = renderRequests;
$('refresh').onclick = () => showSession(session).catch(fail);
$('auth-form').onsubmit = async event => {
 event.preventDefault(); if (!client) { toast('Conexão indisponível. Atualize a página.', 'error'); return; }
 $('auth-submit').disabled = true; busy(true);
 try {
 const username = $('username').value.trim().toLowerCase();
 if (!validUsername(username)) throw new Error('Usuário deve ter de 3 a 30 caracteres: letras, números, ponto, hífen ou sublinhado.');
 let result;
 if (signup) {
 const response = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: $('password').value, name: $('name').value.trim(), role: $('role').value }), signal: AbortSignal.timeout(30000) });
 const body = await response.json().catch(() => ({}));
 if (!response.ok) throw new Error(body.error || 'Não foi possível cadastrar.');
 result = { data: { session: null } };
 }
 else {
 const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: $('password').value }), signal: AbortSignal.timeout(30000) });
 const body = await response.json().catch(() => ({}));
 if (!response.ok) throw new Error(body.error || 'Serviço de login indisponível.');
 result = await client.auth.setSession(body);
 }
 if (result.error) throw result.error;
 $('password').value = '';
 if (result.data.session) { await showSession(result.data.session); toast('Você entrou.'); }
 else { toast('Conta criada. Entre com seu usuário e senha. O administrador liberará as solicitações.'); mode(false); }
 } catch(error) { fail(error); } finally { $('auth-submit').disabled = false; busy(false); }
};
$('logout').onclick = async () => { $('logout').disabled = true; try { const { error } = await client.auth.signOut(); if (error) throw error; clearSession(); } catch(error) { fail(error); } finally { $('logout').disabled = false; } };
const productDialog=$('product-confirm');
let addingProduct=false;
document.querySelectorAll('[data-quantity-step]').forEach(button=>button.onclick=()=>{
 if(addingProduct||$('quantity').disabled)return;
 const value=Number($('quantity').value),base=Number.isFinite(value)&&value>=1?Math.round(value):1;
 $('quantity').value=String(Math.max(1,Math.min(99999,base+Number(button.dataset.quantityStep))));
 $('quantity').dispatchEvent(new Event('change',{bubbles:true}));
});
function closeProductDialog(){if(addingProduct)return;productDialog.close();$('barcode').focus();$('barcode').select();}
$('product-confirm-close').onclick=closeProductDialog;$('product-confirm-cancel').onclick=closeProductDialog;
productDialog.addEventListener('cancel',event=>{event.preventDefault();closeProductDialog();});
document.addEventListener('app:view-change',()=>{if(productDialog.open&&!addingProduct)productDialog.close();});
$('request-form').onsubmit = async event => {
 event.preventDefault();
 if(addingProduct)return;
 const product = products.find(p => productKey(p) === $('product').value);
 if(!profile?.active || !canRequest(profile.role)||!product){toast('Selecione um produto para adicionar.','error');return;}
 addingProduct=true;$('product-confirm-close').disabled=$('product-confirm-cancel').disabled=true;
 try {
 const added=await listController.add({product_code:product.codigo,product_name:product.nome,unit:$('unit').value,quantity:Number($('quantity').value),aisle:$('aisle').value.trim(),priority:$('customer-waiting').checked?'urgente':'normal',notes:$('notes').value.trim()});
 if(!added)return;
 const aisle=$('aisle').value;
 $('request-form').reset();$('unit').value='';$('aisle').value=aisle;
 productDialog.close();renderProductOptions(searchProducts(products,''));$('barcode').focus();
 toast('Item adicionado à lista.');
 }catch(error){fail(error);}finally{addingProduct=false;$('product-confirm-close').disabled=$('product-confirm-cancel').disabled=false;}
};
document.querySelectorAll('[name="package-choice"]').forEach(input=>input.onchange=()=>{$('unit').value=input.value;});
function selectUnit(product) { const stock=$('product-stock'),balance=String(product?.estoque??'').trim();stock.replaceChildren();stock.append(el('span','ESTOQUE NA PLANILHA','stock-caption'),el('strong',balance?balance+' '+(product.unidade_original||product.unidade||''):'Não informado','stock-balance')); $('product-stock').classList.toggle('stock-negative',isNegativeStock(product)); $('product').classList.toggle('stock-negative',isNegativeStock(product)); const unit = product?.unidade?.toLowerCase(); $('unit').value = units.includes(unit) ? unit : ''; document.querySelectorAll('[name="package-choice"]').forEach(input=>input.checked=input.value===$('unit').value); if (product && !units.includes(unit)) toast('Unidade na planilha: ' + (product.unidade_original || unit || 'não informada') + '. Escolha a unidade da solicitação.'); }
function scanFeedback(message=''){$('scan-feedback').textContent=message;$('scan-feedback').hidden=!message;}
function scan() {
 scanFeedback();
 const matches = matchingProducts(products, $('barcode').value);
 if (matches.length > 1) { renderProductOptions(matches,true); toast('Esse código corresponde a mais de um item. Escolha o produto na lista.', 'error'); $('product-search').focus(); return; }
 const product = matches[0];
 if (!product) { $('product').value = ''; scanFeedback(products.length ? 'Produto não encontrado. Confira o código ou busque pela descrição.' : 'A planilha ainda não está disponível. Aguarde o carregamento.'); $('barcode').select(); return; }
 chooseProduct(product); playBeep();
}
$('barcode').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Tab') { if(!$('barcode').value.trim())return;e.preventDefault();setTimeout(scan,0); } });
$('barcode').oninput = () => { $('product').value = ''; scanFeedback(); };
$('scan').onclick = scan;
$('aisle').addEventListener('change',()=>{const selected=products.find(p=>productKey(p)===$('product').value);if(selected&&!productDialog.open)chooseProduct(selected);});
const camera=setupCamera(code=>{$('barcode').value=code;scan();},toast);
document.addEventListener('app:view-change',()=>camera.close());
let suggested=[],suggestionIndex=-1;
function closeSuggestions(){ $('product-suggestions').hidden=true;$('product-search').setAttribute('aria-expanded','false');$('product-search').removeAttribute('aria-activedescendant');suggestionIndex=-1; }
function chooseProduct(product){
 scanFeedback();
 $('product').value=productKey(product);$('product-search').value=product.nome;$('barcode').value=product.codigo_barras||product.codigo;
 selectUnit(product);closeSuggestions();$('search-status').textContent='Selecionado: '+product.codigo+' · '+product.nome;
 if(!$('aisle').value){scanFeedback('Selecione o corredor para continuar com este produto.');$('aisle').focus();return;}
 $('product-confirm-name').textContent=product.nome;$('product-confirm-code').textContent='Código '+product.codigo+' · Corredor '+$('aisle').value;
 $('quantity').value='1';$('notes').value='';if(!productDialog.open)productDialog.showModal();
 if(matchMedia('(max-width:760px), (pointer:coarse)').matches){$('product-confirm-title').focus({preventScroll:true});productDialog.scrollTop=0;requestAnimationFrame(()=>{productDialog.scrollTop=0;});}else{$('quantity').focus({preventScroll:true});$('quantity').select();productDialog.scrollTop=0;}
}
function renderProductOptions(matches,force=false){
 $('product').value='';$('product-stock').textContent='Selecione um produto para consultar o estoque.';$('product-stock').classList.remove('stock-negative');
 suggested=matches;suggestionIndex=-1;const target=$('product-suggestions');target.replaceChildren();
 matches.forEach((product,index)=>{
  const option=el('div','','product-suggestion');option.id='suggestion-'+index;option.setAttribute('role','option');option.setAttribute('aria-selected','false');
  option.append(el('strong',product.nome),el('span',product.codigo+' · '+stockLabel(product),isNegativeStock(product)?'stock-negative':''));
  option.onpointerdown=event=>event.preventDefault();option.onclick=()=>chooseProduct(product);target.append(option);
 });
 const show=force||!!$('product-search').value.trim();target.hidden=!show;$('product-search').setAttribute('aria-expanded',String(show));$('product-search').removeAttribute('aria-activedescendant');
 if(!matches.length)target.append(el('p','Nenhum produto encontrado.','muted'));
 $('search-status').textContent=show?(matches.length?matches.length+' resultados. Selecione um produto.':'Nenhum produto encontrado.'):'Busque pela descrição, marca ou código.';
}
$('product-search').oninput=()=>{$('barcode').value='';renderProductOptions(searchProducts(products,$('product-search').value));};
$('product-search').onkeydown=event=>{
 if(event.key==='Escape'){closeSuggestions();return;}
 if(['ArrowDown','ArrowUp'].includes(event.key)){
  event.preventDefault();if($('product-suggestions').hidden)renderProductOptions(searchProducts(products,$('product-search').value),true);
  if(!suggested.length)return;
  suggestionIndex=(suggestionIndex+(event.key==='ArrowDown'?1:-1)+suggested.length)%suggested.length;
  [...$('product-suggestions').children].forEach((option,index)=>option.setAttribute('aria-selected',String(index===suggestionIndex)));
  const option=$('suggestion-'+suggestionIndex);$('product-search').setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'});
 }else if(event.key==='Enter'){event.preventDefault();if(!$('product-suggestions').hidden&&suggestionIndex>=0)chooseProduct(suggested[suggestionIndex]);}
};
$('product-search').addEventListener('blur',closeSuggestions);
document.addEventListener('click',event=>{if(!event.target.closest('.product-autocomplete'))closeSuggestions();});
async function fetchUsers() {
 $('admin-users').replaceChildren();
 if (!profile?.active || profile.role !== 'admin') return;
 const { data, error } = await client.from('profiles').select('*').order('name'); if (error) throw error;
 data.forEach(user => {
 const row = el('article', '', 'user-row'), info = el('div', '');
 info.append(el('strong', user.name), el('p', '@' + user.username + ' · Solicitou: ' + user.requested_role, 'muted'));
 const label = el('label', 'Perfil'), select = document.createElement('select'); roles.forEach(role => select.add(new Option(role, role))); select.value = user.role; label.append(select);
 const access = el('label', 'Acesso'), active = document.createElement('select'); active.add(new Option('Aprovado', 'true')); active.add(new Option('Pendente / bloqueado', 'false')); active.value = String(user.active); access.append(active);
 const save = el('button', 'Salvar acesso', 'secondary');
 select.disabled = active.disabled = save.disabled = user.id === session.user.id;
 save.onclick = async () => { save.disabled = true; try { const { error } = await client.rpc('admin_set_access', { target_id: user.id, new_role: select.value, new_active: active.value === 'true' }); if (error) throw error; toast('Acesso atualizado.'); await fetchUsers(); } catch(error) { fail(error); } finally { save.disabled = false; } };
 row.append(info, label, access, save);
 const editor=el('details','','admin-user-editor');editor.append(el('summary','Editar nome, login e senha'));
 const form=document.createElement('form'),nameLabel=el('label','Nome'),nameInput=document.createElement('input'),loginLabel=el('label','Login'),loginInput=document.createElement('input');
 nameInput.value=user.name;nameInput.required=true;nameInput.maxLength=100;nameLabel.append(nameInput);loginInput.value=user.username;loginInput.required=true;loginInput.minLength=3;loginInput.maxLength=30;loginInput.autocapitalize='none';loginLabel.append(loginInput);const profileSave=el('button','Salvar cadastro','primary');profileSave.type='submit';form.append(nameLabel,loginLabel,profileSave);
 form.onsubmit=async event=>{event.preventDefault();profileSave.disabled=true;try{const result=await accountRequest({action:'admin-profile',targetId:user.id,name:nameInput.value.trim(),username:loginInput.value.trim()});toast(result.message);if(user.id===session.user.id){profile.name=nameInput.value.trim();profile.username=loginInput.value.trim().toLowerCase();$('identity').textContent=profile.name+' / '+profile.role.toUpperCase();}await fetchUsers();}catch(error){fail(error);}finally{profileSave.disabled=false;}};
 const passwordForm=document.createElement('form'),pwLabel=el('label','Nova senha'),pw=document.createElement('input'),confirmLabel=el('label','Confirmar nova senha'),confirmation=document.createElement('input');for(const input of [pw,confirmation]){input.type='password';input.autocomplete='new-password';input.minLength=6;input.maxLength=128;input.required=true;}pwLabel.append(pw);confirmLabel.append(confirmation);const reset=el('button','Redefinir senha','secondary');reset.type='submit';passwordForm.append(pwLabel,confirmLabel,reset);
 passwordForm.onsubmit=async event=>{event.preventDefault();if(pw.value!==confirmation.value)return toast('As senhas não conferem.','error');reset.disabled=true;try{const result=await accountRequest({action:'admin-password',targetId:user.id,newPassword:pw.value});passwordForm.reset();toast(result.message);}catch(error){fail(error);}finally{reset.disabled=false;}};
 editor.append(form,passwordForm);row.append(editor);$('admin-users').append(row);
 });
}
async function accountRequest(body) {
 const { data, error } = await client.auth.getSession();
 if (error || !data.session) throw new Error('Entre novamente para editar sua conta.');
 const response = await fetch('/api/account', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session.access_token }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
 const result = await response.json().catch(() => ({}));
 if (!response.ok) throw new Error(result.error || 'Não foi possível salvar as alterações.');
 return result;
}
$('settings-toggle').onclick = () => {history.replaceState(null,'','#settings');navigation.show('settings');$('account-name').focus({preventScroll:true});};
$('profile-form').onsubmit = async event => {
 event.preventDefault();
 const username = $('account-username').value.trim().toLowerCase(), name = $('account-name').value.trim();
 if (!validUsername(username) || !name) { toast('Confira o nome e o usuário.', 'error'); return; }
 $('profile-save').disabled = true;
 try {
 const result = await accountRequest({ action: 'profile', name, username });
 profile.name = name; profile.username = username;
 $('identity').textContent = name + ' / ' + profile.role.toUpperCase();
 $('account-username').value = username;
 toast(result.message);
 await fetchUsers();
 } catch(error) { fail(error); } finally { $('profile-save').disabled = false; }
};
$('password-form').onsubmit = async event => {
 event.preventDefault();
 if ($('new-password').value !== $('confirm-password').value) { toast('A confirmação da nova senha não confere.', 'error'); return; }
 $('password-save').disabled = true;
 try {
 const result = await accountRequest({ action: 'password', currentPassword: $('current-password').value, newPassword: $('new-password').value });
 $('password-form').reset();
 await client.auth.signOut({ scope: 'local' }); clearSession();
 toast(result.message);
 } catch(error) { fail(error); } finally { $('password-save').disabled = false; }
};
async function init() {
 try {
 if (!config.supabaseUrl) { $('config-notice').hidden = false; return; }
 const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
 client = createClient(config.supabaseUrl, config.supabasePublishableKey);
 client.auth.onAuthStateChange((event, next) => { if (event === 'SIGNED_OUT') clearSession(); if (event === 'TOKEN_REFRESHED') session = next; });
 const { data, error } = await client.auth.getSession(); if (error) throw error; await showSession(data.session);
 } catch(error) { fail(error); } finally { busy(false); }
}
export const appReady=init();
