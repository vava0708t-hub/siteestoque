import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleUsers } from '../dist/users-ui.js';
const users=[{id:'1',name:'Zé Silva',username:'ze',role:'vendedor',active:true},{id:'2',name:'Ana Lúcia',username:'ana',role:'estoquista',active:true},{id:'3',name:'Bruno',username:'bruno',role:'vendedor',active:false},{id:'4',name:'Saiu',username:'removido-4',role:'vendedor',active:false,removed_at:'2026-01-01'}];
test('equipe oculta removidos e mostra quem aguarda acesso primeiro',()=>{assert.deepEqual(visibleUsers(users).map(u=>u.id),['3','2','1']);});
test('filtros de busca, situação e perfil',()=>{
 assert.deepEqual(visibleUsers(users,{search:'lucia'}).map(u=>u.id),['2']);
 assert.deepEqual(visibleUsers(users,{search:'BRU'}).map(u=>u.id),['3']);
 assert.deepEqual(visibleUsers(users,{status:'active'}).map(u=>u.id),['2','1']);
 assert.deepEqual(visibleUsers(users,{status:'inactive'}).map(u=>u.id),['3']);
 assert.deepEqual(visibleUsers(users,{role:'vendedor'}).map(u=>u.id),['3','1']);
});
