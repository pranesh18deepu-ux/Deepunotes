const DB_NAME="DeepuNotesDB", DB_VERSION=1, STORE="app";
let db, state, currentNotebookId=null, currentPageId=null;
let tool="pen", drawing=false, currentStroke=null, activePointerId=null, undoStack=[], redoStack=[];
const $=id=>document.getElementById(id);

function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random()}
function now(){return new Date().toISOString()}
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>{db=r.result;resolve()};r.onerror=()=>reject(r.error)})}
function getDB(){return new Promise((res,rej)=>{const r=db.transaction(STORE,"readonly").objectStore(STORE).get("state");r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function putDB(v){return new Promise((res,rej)=>{const r=db.transaction(STORE,"readwrite").objectStore(STORE).put(v,"state");r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
async function save(){state.updatedAt=now();$("saveStatus").textContent="Saving…";try{await putDB(state);$("saveStatus").textContent="Saved locally"}catch(e){console.error(e);$("saveStatus").textContent="Save error"}}
function snapshot(){return JSON.stringify(state)}
function pushUndo(){undoStack.push(snapshot());if(undoStack.length>40)undoStack.shift();redoStack=[]}
async function undo(){if(!undoStack.length)return;redoStack.push(snapshot());state=JSON.parse(undoStack.pop());syncSelection();await save();render()}
async function redo(){if(!redoStack.length)return;undoStack.push(snapshot());state=JSON.parse(redoStack.pop());syncSelection();await save();render()}
function freshState(){const n={id:uid(),name:"Zoology",createdAt:now(),updatedAt:now(),sections:[]};const s={id:uid(),name:"General",pages:[]};const p={id:uid(),title:"Welcome",createdAt:now(),updatedAt:now(),background:"ruled",elements:[]};s.pages.push(p);n.sections.push(s);return {notebooks:[n],currentNotebookId:n.id,currentPageId:p.id,updatedAt:now()}}
function currentNotebook(){return state?.notebooks.find(n=>n.id===currentNotebookId)}
function currentSection(){return currentNotebook()?.sections?.[0]}
function currentPage(){for(const n of state?.notebooks||[])for(const s of n.sections||[]){const p=(s.pages||[]).find(p=>p.id===currentPageId);if(p)return p}return null}
function syncSelection(){currentNotebookId=state.currentNotebookId;currentPageId=state.currentPageId}
function normalizeState(){if(!state||!Array.isArray(state.notebooks))return freshState();for(const n of state.notebooks){n.sections=n.sections||[];if(!n.sections.length)n.sections.push({id:uid(),name:"General",pages:[]});for(const s of n.sections){s.pages=s.pages||[];for(const p of s.pages){p.elements=p.elements||[];p.background=p.background||"blank";}}}if(!state.currentNotebookId||!state.notebooks.some(n=>n.id===state.currentNotebookId))state.currentNotebookId=state.notebooks[0]?.id;const n=state.notebooks.find(n=>n.id===state.currentNotebookId);const pages=n?.sections?.[0]?.pages||[];if(!state.currentPageId||!pages.some(p=>p.id===state.currentPageId))state.currentPageId=pages[0]?.id||null;syncSelection();return state}

function render(){
 $("notebookList").innerHTML="";
 (state.notebooks||[]).forEach(n=>{const b=document.createElement("button");b.className="notebook "+(n.id===currentNotebookId?"active":"");b.textContent="📓 "+n.name;b.onclick=()=>{currentNotebookId=n.id;state.currentNotebookId=n.id;const s=n.sections?.[0];currentPageId=s?.pages?.[0]?.id||null;state.currentPageId=currentPageId;render();save()};$("notebookList").appendChild(b)});
 const n=currentNotebook(),s=currentSection(),p=currentPage();
 $("breadcrumbs").textContent=n?(n.name+(s?" / "+s.name:"")):"DeepuNotes";
 $("sectionName").textContent=s?.name||"General";
 $("pageList").innerHTML="";
 (s?.pages||[]).forEach(x=>{const b=document.createElement("button");b.className="pageItem "+(x.id===currentPageId?"active":"");b.textContent="📄 "+(x.title||"Untitled Page");b.onclick=()=>{currentPageId=x.id;state.currentPageId=x.id;render();save()};$("pageList").appendChild(b)});
 $("emptyState").hidden=!!p;$("pageView").hidden=!p;
 if(p){$("pageTitle").value=p.title||"Untitled Page";applyBackground(p.background||"blank");setupCanvas();renderCanvas();renderText();setTimeout(()=>$("pencilHint").style.opacity=".35",2500)}
}
function applyBackground(bg){const wrap=$("canvasWrap");wrap.className="canvasWrap "+bg;document.querySelectorAll(".bgBtn").forEach(b=>b.classList.toggle("active",b.dataset.bg===bg))}
function resizeCanvas(){
 const wrap=$("canvasWrap"),c=$("noteCanvas"),dpr=Math.max(1,window.devicePixelRatio||1);
 const w=Math.max(wrap.clientWidth,900),h=Math.max(wrap.clientHeight,1200);
 c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);c.style.width=w+"px";c.style.height=h+"px";
 const ctx=c.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
 $("textLayer").style.width=w+"px";$("textLayer").style.height=h+"px";
}
function setupCanvas(){resizeCanvas()}
function ctx2d(){return $("noteCanvas").getContext("2d")}
function renderCanvas(){
 const c=$("noteCanvas"),ctx=ctx2d(),dpr=Math.max(1,window.devicePixelRatio||1);ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,c.width,c.height);ctx.setTransform(dpr,0,0,dpr,0,0);
 const page=currentPage();if(!page)return;(page.elements||[]).filter(e=>e.type==="stroke").forEach(drawStroke)
}
function drawStroke(e){
 const pts=e.points||[];if(!pts.length)return;const ctx=ctx2d();ctx.save();ctx.lineCap="round";ctx.lineJoin="round";ctx.globalAlpha=e.tool==="highlighter"?.28:1;ctx.strokeStyle=e.color||"#111827";ctx.lineWidth=e.width||3;
 ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];ctx.lineTo((a.x+b.x)/2,(a.y+b.y)/2)}ctx.lineTo(pts[pts.length-1].x,pts[pts.length-1].y);ctx.stroke();ctx.restore()
}
function renderText(){
 $("textLayer").innerHTML="";const page=currentPage();if(!page)return;
 (page.elements||[]).filter(e=>e.type==="text").forEach(e=>{const d=document.createElement("div");d.className="textBox";d.contentEditable=true;d.textContent=e.text||"";d.style.left=(e.x||0)+"px";d.style.top=(e.y||0)+"px";d.style.width=(e.w||220)+"px";d.style.minHeight=(e.h||40)+"px";d.oninput=()=>{e.text=d.textContent;e.updatedAt=now();save()};d.onpointerdown=ev=>ev.stopPropagation();$("textLayer").appendChild(d)})
}
function point(ev){const r=$("noteCanvas").getBoundingClientRect();return{x:ev.clientX-r.left,y:ev.clientY-r.top,p:typeof ev.pressure==="number"&&ev.pressure>0?ev.pressure:.5}}
function pressureWidth(base,p){return Math.max(1,base*(.75+.55*Math.min(1,Math.max(.05,p))))}
function drawSegment(a,b,e){
 const ctx=ctx2d();ctx.save();ctx.lineCap="round";ctx.lineJoin="round";ctx.globalAlpha=e.tool==="highlighter"?.28:1;ctx.strokeStyle=e.color;ctx.lineWidth=e.tool==="highlighter"?e.width:pressureWidth(e.width,b.p);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore()
}
function addPoint(ev){if(!currentStroke)return;const pt=point(ev),pts=currentStroke.points;const last=pts[pts.length-1];pts.push(pt);if(last)drawSegment(last,pt,currentStroke);else{const ctx=ctx2d();ctx.save();ctx.fillStyle=currentStroke.color;ctx.globalAlpha=currentStroke.tool==="highlighter"?.28:1;ctx.beginPath();ctx.arc(pt.x,pt.y,Math.max(1,currentStroke.width/2),0,Math.PI*2);ctx.fill();ctx.restore()}}
function eraseAt(pt){const page=currentPage();if(!page)return;const before=page.elements.length;page.elements=page.elements.filter(e=>e.type!=="stroke"||!e.points.some(q=>Math.hypot(q.x-pt.x,q.y-pt.y)<Math.max(14,(e.width||3)*2.5)));if(page.elements.length!==before)renderCanvas()}
function startDrawing(ev){
 ev.preventDefault();if(!currentPage())return;
 if(tool==="text"){const pt=point(ev),page=currentPage();pushUndo();page.elements.push({id:uid(),type:"text",x:pt.x,y:pt.y,w:220,h:40,text:"Type here"});renderText();save();return}
 drawing=true;activePointerId=ev.pointerId;try{$("noteCanvas").setPointerCapture(ev.pointerId)}catch(e){}
 if(tool==="eraser"){pushUndo();eraseAt(point(ev));return}
 const base=Number($("size").value)||3;currentStroke={id:uid(),type:"stroke",tool,points:[],color:tool==="highlighter"?"#facc15":$("color").value,width:tool==="highlighter"?Math.max(10,base*3):base};pushUndo();currentPage().elements.push(currentStroke);addPoint(ev)
}
function moveDrawing(ev){if(!drawing||ev.pointerId!==activePointerId)return;ev.preventDefault();const list=typeof ev.getCoalescedEvents==="function"?ev.getCoalescedEvents():[ev];for(const e of list){if(tool==="eraser")eraseAt(point(e));else addPoint(e)}}
async function finishDrawing(ev){if(!drawing||ev.pointerId!==activePointerId)return;ev.preventDefault();drawing=false;activePointerId=null;currentStroke=null;try{$("noteCanvas").releasePointerCapture(ev.pointerId)}catch(e){}await save()}
const canvas=$("noteCanvas");
canvas.addEventListener("pointerdown",startDrawing,{passive:false});
canvas.addEventListener("pointermove",moveDrawing,{passive:false});
canvas.addEventListener("pointerup",finishDrawing,{passive:false});
canvas.addEventListener("pointercancel",finishDrawing,{passive:false});
canvas.addEventListener("lostpointercapture",async ev=>{if(drawing&&ev.pointerId===activePointerId){drawing=false;activePointerId=null;currentStroke=null;await save()}});
canvas.addEventListener("contextmenu",ev=>ev.preventDefault());

document.querySelectorAll("[data-tool]").forEach(b=>b.onclick=()=>{tool=b.dataset.tool;document.querySelectorAll("[data-tool]").forEach(x=>x.classList.toggle("active",x===b))});
document.querySelectorAll(".bgBtn").forEach(b=>b.onclick=()=>{const p=currentPage();if(!p)return;pushUndo();p.background=b.dataset.bg;applyBackground(p.background);save()});
$("undo").onclick=undo;$("redo").onclick=redo;
$("pageTitle").oninput=()=>{const p=currentPage();if(p){p.title=$("pageTitle").value||"Untitled Page";p.updatedAt=now();render();save()}};
$("clearPage").onclick=()=>{const p=currentPage();if(!p)return;if(!confirm("Clear all handwriting and text on this page?"))return;pushUndo();p.elements=[];renderCanvas();renderText();save()};
function newNotebook(){
 $("dialogTitle").textContent="New Notebook";$("dialogOK").textContent="Create";$("nameInput").value="";$("nameDialog").showModal();setTimeout(()=>$("nameInput").focus(),50);
 $("nameForm").onsubmit=async ev=>{ev.preventDefault();const name=$("nameInput").value.trim();if(!name)return;const n={id:uid(),name,createdAt:now(),updatedAt:now(),sections:[]};const s={id:uid(),name:"General",pages:[]};const p={id:uid(),title:"Untitled Page",createdAt:now(),updatedAt:now(),background:"blank",elements:[]};s.pages.push(p);n.sections.push(s);state.notebooks.push(n);currentNotebookId=n.id;currentPageId=p.id;state.currentNotebookId=n.id;state.currentPageId=p.id;$("nameDialog").close();await save();render()}
}
$("newNotebook").onclick=newNotebook;$("emptyNew").onclick=newNotebook;
$("newPage").onclick=async()=>{const s=currentSection();if(!s)return;pushUndo();const p={id:uid(),title:"Untitled Page",createdAt:now(),updatedAt:now(),background:"blank",elements:[]};s.pages.push(p);currentPageId=p.id;state.currentPageId=p.id;await save();render()};
$("sidebarToggle").onclick=()=>$("sidebar").classList.toggle("open");
$("focusMode").onclick=async()=>{document.body.classList.toggle("focusMode");if(document.body.classList.contains("focusMode")){try{if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen()}catch(e){}}else{try{if(document.fullscreenElement)await document.exitFullscreen()}catch(e){}}setTimeout(()=>{if(currentPage()){setupCanvas();renderCanvas()}},100)};
document.addEventListener("fullscreenchange",()=>{if(!document.fullscreenElement&&document.body.classList.contains("focusMode"))document.body.classList.remove("focusMode")});
$("exportAll").onclick=()=>{const blob=new Blob([JSON.stringify(state)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="DeepuNotes-Backup.deepunotes";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
$("importAll").onclick=()=>$("backupInput").click();
$("backupInput").onchange=async ev=>{const f=ev.target.files[0];if(!f)return;try{const x=JSON.parse(await f.text());if(!x.notebooks)throw Error("Invalid backup");state=normalizeState(x);undoStack=[];redoStack=[];await save();render();alert("Notebook restored successfully.")}catch(e){alert("Could not restore this backup.")}ev.target.value=""};
document.addEventListener("keydown",ev=>{if((ev.metaKey||ev.ctrlKey)&&ev.key.toLowerCase()==="z"){ev.preventDefault();ev.shiftKey?redo():undo()}});
window.addEventListener("resize",()=>{if(currentPage()){setupCanvas();renderCanvas()}});
(async()=>{try{await openDB();state=await getDB();if(!state)state=freshState();state=normalizeState();syncSelection();await save();render()}catch(e){console.error(e);alert("DeepuNotes could not initialize local storage.")}})();
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
