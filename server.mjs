import http from 'node:http';
import {randomInt} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createRoom,joinRoom,authenticate,action,tick,view} from './engine.mjs';
import {catastrophes,profiles,validatePack} from './content.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)), data=path.resolve(process.env.DATA_DIR||path.join(root,'data'));
mkdirSync(data,{recursive:true});const db=path.join(data,'rooms.json');let rooms={};
if(existsSync(db)){try{rooms=JSON.parse(readFileSync(db,'utf8'));validateSave(rooms);}catch(e){console.error('Не удалось прочитать сохранение. Сервер остановлен, файл не перезаписан.',e.message);process.exit(1);}}
// Reject malformed saves before any request/timer can overwrite the file.
function validateSave(saved){
if(!saved||typeof saved!=='object'||Array.isArray(saved))throw Error('Сохранение должно содержать объект комнат');
const states=new Set(['LOBBY','INTRO','SPECIAL_BEFORE_REVEAL','CHARACTER_REVEAL','DISCUSSION','SPECIAL_PRE_VOTE','VOTING','SPECIAL_POST_VOTE','SPECIAL_AFTER_ELIMINATION','INTERVOTE_DISCUSSION','SPECIAL_FINALE','FINISHED']);
for(const [code,r] of Object.entries(saved)){
if(!/^[A-Z2-9]{6}$/.test(code)||!r||r.code!==code||!states.has(r.state)||!Array.isArray(r.players)||!Array.isArray(r.log)||!Number.isInteger(r.phaseId)||!Number.isInteger(r.rev)||!Number.isInteger(r.rng)||!(r.deadline===null||Number.isFinite(r.deadline)))throw Error('Некорректная комната в сохранении');
if(r.players.some(p=>!p||typeof p.id!=='string'||typeof p.name!=='string'||typeof p.tokenHash!=='string'||!['active','withdrawn','eliminated'].includes(p.status))||new Set(r.players.map(p=>p.id)).size!==r.players.length)throw Error('Некорректные игроки в сохранении');
if(r.state!=='LOBBY'){
if(!Number.isInteger(r.initialCount)||r.initialCount<4||r.initialCount>16||r.capacity!==Math.floor(r.initialCount/2)||!Array.isArray(r.order)||!Array.isArray(r.bunkerDeck)||!Array.isArray(r.bunkerRevealed)||!Array.isArray(r.capabilities)||!r.resources||!Array.isArray(r.catastrophe?.checks)||r.catastrophe.checks.length!==3||!r.profile||r.players.some(p=>!Array.isArray(p.revealed)||!p.cards||!p.special))throw Error('Неполная начатая партия в сохранении');
if(r.round>0&&(!Array.isArray(r.turnOrder)||!Array.isArray(r.protected)||!Array.isArray(r.bonus)||!Array.isArray(r.queue)))throw Error('Неполный раунд в сохранении');
if(['VOTING','SPECIAL_POST_VOTE'].includes(r.state)&&(!r.ballots||typeof r.ballots!=='object'||Array.isArray(r.ballots)))throw Error('Нет бюллетеней в сохранении');
}
}
}
validatePack();
function save(){writeFileSync(db+'.tmp',JSON.stringify(rooms),{mode:0o600});renameSync(db+'.tmp',db);}
const limits=new Map();function limited(key,max,window=60000){const now=Date.now();let l=limits.get(key);if(!l||now>l.until){l={n:0,until:now+window};limits.set(key,l);}return ++l.n>max;}
function code(){let c;const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';do{c=Array.from({length:6},()=>a[randomInt(a.length)]).join('');}while(rooms[c]);return c;}
function json(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(payload));}
async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192){throw Error('Запрос слишком большой');}}let parsed;try{parsed=JSON.parse(raw||'{}');}catch{throw Error('Некорректный JSON');}if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Тело запроса должно быть объектом');return parsed;}
const server=http.createServer(async(req,res)=>{try{
res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
const u=new URL(req.url,'http://localhost'),ip=req.socket.remoteAddress;
if(u.pathname.startsWith('/api/')){
if(req.headers.origin&&req.headers.origin!==`${req.headers['x-forwarded-proto']||'http'}://${req.headers.host}`){json(res,403,{error:'Другой источник запроса запрещён'});return;}
if(limited('api:'+ip,2400)){json(res,429,{error:'Слишком много запросов. Подождите минуту'});return;}
if(u.pathname==='/api/content'&&req.method==='GET'){json(res,200,{catastrophes:catastrophes.map(({id,title})=>({id,title})),profiles:profiles.map(({id,title})=>({id,title}))});return;}
if(u.pathname==='/api/create'&&req.method==='POST'){if(limited('create:'+ip,20,3600000)){json(res,429,{error:'Лимит создания комнат: 20 в час'});return;}if(Object.keys(rooms).length>=500){json(res,503,{error:'Сервер заполнен. Обратитесь к администратору'});return;}const b=await body(req);if(Object.keys(rooms).length>=500){json(res,503,{error:'Сервер заполнен. Обратитесь к администратору'});return;}const result=createRoom(code(),b.name);rooms[result.room.code]=result.room;save();json(res,201,{code:result.room.code,token:result.token,playerId:result.playerId});return;}
const match=u.pathname.match(/^\/api\/rooms\/([A-Z2-9]{6})(?:\/(join|action))?$/);if(!match){json(res,404,{error:'Неизвестный адрес API'});return;}const [,c,operation]=match,r=rooms[c];if(!r){json(res,404,{error:'Комната не найдена'});return;}
if(tick(r)){r.updatedAt=Date.now();save();}
if(operation==='join'&&req.method==='POST'){if(limited('join:'+ip,60)){json(res,429,{error:'Слишком много подключений'});return;}const b=await body(req),result=joinRoom(r,b.name);r.updatedAt=Date.now();save();json(res,201,{code:c,...result});return;}
const token=req.headers.authorization?.replace(/^Bearer /,''),p=authenticate(r,token);if(!p){json(res,401,{error:'Доступ к этому игроку отсутствует. Войдите в комнату'});return;}
if(!operation&&req.method==='GET'){json(res,200,view(r,p));return;}
if(operation==='action'&&req.method==='POST'){const b=await body(req),currentPlayer=authenticate(r,token);if(!currentPlayer){json(res,401,{error:'Доступ к этому игроку отсутствует. Войдите в комнату'});return;}action(r,currentPlayer,b);r.updatedAt=Date.now();save();json(res,200,r.players.includes(currentPlayer)?view(r,currentPlayer):{left:true});return;}
json(res,405,{error:'Метод не поддерживается'});return;}
if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/style.css':'style.css','/favicon.svg':'favicon.svg'};const f=files[u.pathname];if(!f){res.writeHead(404);res.end('Not found');return;}
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml'};res.setHeader('Content-Type',types[f.split('.').pop()]);res.setHeader('Cache-Control','no-cache');res.end(req.method==='HEAD'?undefined:readFileSync(path.join(root,'public',f)));
}catch(e){if(!res.headersSent)json(res,400,{error:e.message});else res.end();}});
const timer=setInterval(()=>{try{let dirty=false;for(const r of Object.values(rooms))if(tick(r)){r.updatedAt=Date.now();dirty=true;}if(dirty)save();for(const [k,v]of limits)if(v.until<Date.now())limits.delete(k);}catch(e){console.error('Ошибка сохранения/таймера:',e);}},500);timer.unref();
server.listen(Number(process.env.PORT||3000),process.env.HOST||'0.0.0.0',()=>console.log(`BUNKER 42: http://localhost:${process.env.PORT||3000}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{save();server.close(()=>process.exit(0));});
