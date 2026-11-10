import Dexie from './vendor/dexie.mjs';
export function createOfflineStore(name='repoe-offline-lists'){
 const db=new Dexie(name);db.version(1).stores({drafts:'id'});
 return {read:()=>db.table('drafts').get('current'),save:draft=>db.table('drafts').put({...draft,id:'current'}),clear:()=>db.table('drafts').delete('current'),close:()=>db.close()};
}
