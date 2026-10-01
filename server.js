// ============================================================
//  ⚡ JARVIS BACKEND — server.js (COMPLETE FILE)
//  Sirf API hai — frontend isme NAHI hai
//
//  Deploy: Render.com (free)
//  Start command: node server.js
// ============================================================

const http = require('http');
const fs = require('fs');
const path = require('path');

// ---------- OPTIONAL FIREBASE (real database) ----------
// serviceAccountKey.json daaloge to auto Firestore connect ho jayega
let admin = null, db = null, FB = false;
try {
  admin = require('firebase-admin');
  admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });
  db = admin.firestore(); FB = true;
  console.log('🔥 Firebase Firestore CONNECTED');
} catch (e) {
  console.log('⚠️  DEMO MODE — data.json file mein save hoga');
}

// ---------- DEMO STORAGE (data.json) ----------
const DATA_FILE = path.join(__dirname, 'data.json');
function loadData(){ try{ return JSON.parse(fs.readFileSync(DATA_FILE,'utf8')); }catch(e){ return {messages:[],downloads:[]}; } }
function saveData(d){ try{ fs.writeFileSync(DATA_FILE, JSON.stringify(d,null,2)); }catch(e){} }

// ---------- HELPERS ----------
function readBody(req){ return new Promise(function(res){ let b=''; req.on('data',function(c){b+=c;}); req.on('end',function(){ try{res(JSON.parse(b||'{}'));}catch(e){res({});} }); }); }
function sendJSON(res,code,obj){
  res.writeHead(code,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
  res.end(JSON.stringify(obj));
}

// ---------- API SERVER ----------
const server = http.createServer(async function(req, res){
  const url = req.url.split('?')[0];

  // CORS preflight — GitHub Pages se requests allow karne ke liye ZAROORI
  if(req.method==='OPTIONS'){
    res.writeHead(204,{
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Methods':'GET,POST',
      'Access-Control-Allow-Headers':'Content-Type,Authorization'
    });
    return res.end();
  }

  // 📡 Health check — GET / ya /api/health
  if(req.method==='GET' && (url==='/' || url==='/api/health')){
    return sendJSON(res,200,{status:'JARVIS Backend ONLINE ⚡', mode: FB?'firebase':'demo', time:new Date().toISOString()});
  }

  // 📬 Contact form save — POST /api/contact
  if(req.method==='POST' && url==='/api/contact'){
    const b = await readBody(req);
    if(!b.name || !b.email || !b.message) return sendJSON(res,400,{error:'Name, email aur message required hain'});
    if(FB){
      const doc = await db.collection('messages').add({name:b.name, email:b.email, message:b.message, read:false, createdAt:admin.firestore.FieldValue.serverTimestamp()});
      return sendJSON(res,200,{success:true, id:doc.id});
    }
    const d = loadData();
    d.messages.push({name:b.name, email:b.email, message:b.message, read:false, createdAt:new Date().toISOString()});
    saveData(d);
    return sendJSON(res,200,{success:true, id:d.messages.length});
  }

  // ⬇ Download tracking — POST /api/download
  if(req.method==='POST' && url==='/api/download'){
    let uid='guest', email='';
    const token = (req.headers.authorization||'').replace('Bearer ','');
    if(FB && token){
      try{ const dec = await admin.auth().verifyIdToken(token); uid=dec.uid; email=dec.email||''; }
      catch(e){ return sendJSON(res,401,{error:'Invalid token'}); }
    }
    if(FB){ await db.collection('downloads').add({uid:uid, email:email, at:admin.firestore.FieldValue.serverTimestamp()}); }
    else{ const d=loadData(); d.downloads.push({uid:uid, email:email, at:new Date().toISOString()}); saveData(d); }
    return sendJSON(res,200,{success:true});
  }

  // 📊 Stats — GET /api/stats
  if(req.method==='GET' && url==='/api/stats'){
    if(FB){
      const m = await db.collection('messages').get();
      const dl = await db.collection('downloads').get();
      return sendJSON(res,200,{totalMessages:m.size, totalDownloads:dl.size, mode:'firebase'});
    }
    const d = loadData();
    return sendJSON(res,200,{totalMessages:d.messages.length, totalDownloads:d.downloads.length, mode:'demo'});
  }

  // 📥 Saare messages — GET /api/messages
  if(req.method==='GET' && url==='/api/messages'){
    if(FB){
      const s = await db.collection('messages').orderBy('createdAt','desc').limit(50).get();
      return sendJSON(res,200,{messages: s.docs.map(function(x){ return Object.assign({id:x.id}, x.data()); })});
    }
    return sendJSON(res,200,{messages: loadData().messages.slice().reverse()});
  }

  // 404
  sendJSON(res,404,{error:'Not found'});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, function(){
  console.log('');
  console.log('⚡ JARVIS Backend RUNNING on port ' + PORT);
  console.log('📡 Health  : /api/health');
  console.log('📊 Stats   : /api/stats');
  console.log('📥 Messages: /api/messages');
  console.log('');
});