const DB_NAME="DeepuNotesDB", DB_VERSION=1, STORE="app";
let db, state, currentNotebookId=null, currentPageId=null;
let tool="pen", drawing=false, currentStroke=null, undoStack=[], redoStack=[];
const $=id=>document.getElementById(id);

function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random()}
function now(){return new Date().toISOString()}

function openDB(){
 return new Promise((resolve,reject)=>{
  const r=indexedDB.open(DB_NAME,DB_VERSION);
  r.onupgradeneeded=()=>r.result.createObjectStore(STORE);
  r.onsuccess=()=>{db=r.result;resolve()};
  r.onerror=()=>reject(r.error);
 })
}
function getDB(){return new Promise((res,rej)=>{const r=db.transaction(STORE,"readonly").objectStore(STORE).get("state");r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function putDB(v){return new Promise((res,rej)=>{const r=db.transaction(STORE,"readwrite").objectStore(STORE).put(v,"state");r.onsuccess=res;r.onerror=()=>rej(r.error)})}
async function save(){
 state.updatedAt=now(); $("saveStatus").textContent="Saving…";
 await putDB(state); setTimeout(()=>$("saveStatus").textContent="Saved locally",150);
}
function snapshot(){return JSON.stringify(state)}
function pushUndo(){undoStack.push(snapshot());if(undoStack.length>40)undoStack.shift();redoStack=[]}
async function undo(){if(!undoStack.length)return;redoStack.push(snapshot());state=JSON.parse(undoStack.pop());currentNotebookId=state.currentNotebookId;currentPageId=state.currentPageId;await save();render()}
async function redo(){if(!redoStack.length)return;undoStack.push(snapshot());state=JSON.parse(redoStack.pop());currentNotebookId=state.currentNotebookId;currentPageId=state.currentPageId;await save();render()}

function freshState(){
 const n={id:uid(),name:"Zoology",createdAt:now(),updatedAt:now(),sections:[]};
 const s={id:uid(),name:"General",pages:[]}; const p={id:uid(),title:"Welcome",createdAt:now(),updatedAt:now(),background:"ruled",elements:[]};
 s.pages.push(p);n.sections.push(s);
 return {notebooks:[n],currentNotebookId:n.id,currentPageId:p.id,updatedAt:now()};
}
function currentNotebook(){return state.notebooks.find(n=>n.id===currentNotebookId)}
function currentSection(){return currentNotebook()?.sections[0]}
function currentPage(){for(const n of state.notebooks)for(const s of n.sections){const p=s.pages.find(p=>p.id===currentPageId);if(p)return p}}
function render(){
 $("notebookList").innerHTML="";
 state.notebooks.forEach(n=>{
  const b=document.createElement("button");b.className="notebook "+(n.id===currentNotebookId?"active":"");b.textContent="📓 "+n.name;
  b.onclick=()=>{currentNotebookId=n.id;const s=n.sections[0];currentPageId=s?.pages[0]?.id||null;state.currentNotebookId=n.id;state.currentPageId=currentPageId;render();save()};
  $("notebookList").appendChild(b);
 });
 const n=currentNotebook(), s=currentSection(), p=currentPage();
 $("breadcrumbs").textContent=n?(n.name+(s?" / "+s.name:"")):"DeepuNotes";
 $("sectionName").textContent=s?.name||"Pages";
 $("pageList").innerHTML="";
 (s?.pages||[]).forEach(x=>{const b=document.createElement("button");b.className="pageItem "+(x.id===currentPageId?"active":"");b.textContent="📄 "+x.title;b.onclick=()=>{currentPageId=x.id;state.currentPageId=x.id;render();save()};$("pageList").appendChild(b)});
 $("emptyState").hidden=!!p; $("pageView").hidden=!p;
 if(p){$("pageTitle").value=p.title;$("backgroundSelect").value=p.background||"blank";setupCanvas();renderCanvas()}
}
function resizeCanvas(){
 const wrap=$("canvasWrap"), c=$("noteCanvas"), dpr=devicePixelRatio||1;
 const w=Math.max(wrap.clientWidth,1000),h=Math.max(wrap.clientHeight,1400);
 c.width=w*dpr;c.height=h*dpr;c.style.width=w+"px";c.style.height=h+"px";
 const ctx=c.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
}
function setupCanvas(){
 const wrap=$("canvasWrap");wrap.className="canvasWrap "+(currentPage()?.background||"blank");
 resizeCanvas(); window.onresize=()=>{resizeCanvas();renderCanvas()};
}
function ctx2d(){return $("noteCanvas").getContext("2d")}
function renderCanvas(){
 const c=$("noteCanvas"),ctx=ctx2d(),dpr=devicePixelRatio||1;
 ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,c.width,c.height);ctx.setTransform(dpr,0,0,dpr,0,0);
 const page=currentPage(); if(!page)return;
 page.elements.filter(e=>e.type==="stroke").forEach(drawStroke);
 renderText();
}
function drawStroke(e){
 const pts=e.points;if(!pts.length)return;const ctx=ctx2d();ctx.save();ctx.lineCap="round";ctx.lineJoin="round";
 ctx.globalAlpha=e.tool==="highlighter"?.28:1;ctx.strokeStyle=e.color;ctx.lineWidth=e.width;
 ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
 for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];ctx.lineTo((a.x+b.x)/2,(a.y+b.y)/2)}ctx.lineTo(pts.at(-1).x,pts.at(-1).y);ctx.stroke();ctx.restore();
}
function renderText(){
 $("textLayer").innerHTML="";const page=currentPage();if(!page)return;
 page.elements.filter(e=>e.type==="text").forEach(e=>{
  const d=document.createElement("div");d.className="textBox";d.contentEditable=true;d.textContent=e.text;d.style.left=e.x+"px";d.style.top=e.y+"px";d.style.width=(e.w||180)+"px";d.style.minHeight=(e.h||35)+"px";
  d.oninput=()=>{e.text=d.textContent;e.updatedAt=now();save()};d.onpointerdown=ev=>ev.stopPropagation();$("textLayer").appendChild(d);
 });
}
function point(ev){const r=$("noteCanvas").getBoundingClientRect();return {x:ev.clientX-r.left,y:ev.clientY-r.top,p:ev.pressure||.5}}
$("noteCanvas").addEventListener("pointerdown",ev=>{
 if(ev.pointerType!=="pen" && tool!=="text")return;
 if(tool==="text"){const pt=point(ev),page=currentPage();pushUndo();page.elements.push({id:uid(),type:"text",x:pt.x,y:pt.y,w:220,h:40,text:"Type here"});renderText();save();return}
 drawing=true;ev.currentTarget.setPointerCapture(ev.pointerId);const pt=point(ev);
 if(tool==="eraser"){eraseAt(pt);return}
 currentStroke={id:uid(),type:"stroke",tool,points:[pt],color:tool==="highlighter"?"#facc15":$("color").value,width:tool==="highlighter"?Math.max(10,Number($("size").value)*3):Number($("size").value)};
 pushUndo();currentPage().elements.push(currentStroke);drawStroke(currentStroke);
});
$("noteCanvas").addEventListener("pointermove",ev=>{
 if(!drawing||ev.pointerType!=="pen")return;const pt=point(ev);
 if(tool==="eraser"){eraseAt(pt);return}
 currentStroke.points.push(pt);renderCanvas();
});
$("noteCanvas").addEventListener("pointerup",async ev=>{if(!drawing)return;drawing=false;currentStroke=null;await save()});
function eraseAt(pt){
 const page=currentPage();if(!page)return;
 const before=page.elements.length;
 page.elements=page.elements.filter(e=>e.type!=="stroke"||!e.points.some(q=>Math.hypot(q.x-pt.x,q.y-pt.y)<Math.max(12,e.width*2)));
 if(page.elements.length!==before){renderCanvas();save()}
}
document.querySelectorAll("[data-tool]").forEach(b=>b.onclick=()=>{tool=b.dataset.tool;document.querySelectorAll("[data-tool]").forEach(x=>x.classList.toggle("active",x===b))});
$("undo").onclick=undo;$("redo").onclick=redo;
$("pageTitle").oninput=()=>{const p=currentPage();if(p){p.title=$("pageTitle").value;p.updatedAt=now();render();save()}};
$("backgroundSelect").onchange=()=>{const p=currentPage();p.background=$("backgroundSelect").value;setupCanvas();save()};
$("clearPage").onclick=()=>{if(!confirm("Clear all handwriting and text on this page?"))return;pushUndo();currentPage().elements=[];renderCanvas();renderText();save()};
function newNotebook(){
 $("dialogTitle").textContent="New Notebook";$("dialogOK").textContent="Create";$("nameInput").value="";
 $("nameDialog").showModal();$("nameInput").focus();
 $("nameForm").onsubmit=async ev=>{ev.preventDefault();const name=$("nameInput").value.trim();if(!name)return;
  const n={id:uid(),name,createdAt:now(),updatedAt:now(),sections:[]};const s={id:uid(),name:"General",pages:[]};const p={id:uid(),title:"Untitled Page",createdAt:now(),updatedAt:now(),background:"blank",elements:[]};s.pages.push(p);n.sections.push(s);state.notebooks.push(n);currentNotebookId=n.id;currentPageId=p.id;state.currentNotebookId=n.id;state.currentPageId=p.id;$("nameDialog").close();await save();render();
 }
}
$("newNotebook").onclick=newNotebook;$("emptyNew").onclick=newNotebook;
$("newPage").onclick=async()=>{const s=currentSection();if(!s)return;pushUndo();const p={id:uid(),title:"Untitled Page",createdAt:now(),updatedAt:now(),background:"blank",elements:[]};s.pages.push(p);currentPageId=p.id;state.currentPageId=p.id;await save();render()};
$("sidebarToggle").onclick=()=>$("sidebar").classList.toggle("open");
$("exportAll").onclick=()=>{const blob=new Blob([JSON.stringify(state)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="DeepuNotes-Backup.deepunotes";a.click();URL.revokeObjectURL(a.href)};
$("importAll").onclick=()=>$("backupInput").click();
$("backupInput").onchange=async ev=>{const f=ev.target.files[0];if(!f)return;try{const x=JSON.parse(await f.text());if(!x.notebooks)throw Error("Invalid backup");state=x;currentNotebookId=state.currentNotebookId;currentPageId=state.currentPageId;await save();render();alert("Notebook restored successfully.")}catch(e){alert("Could not restore this backup.")}ev.target.value=""};
document.addEventListener("keydown",ev=>{if((ev.metaKey||ev.ctrlKey)&&ev.key.toLowerCase()==="z"){ev.preventDefault();ev.shiftKey?redo():undo()}});
(async()=>{await openDB();state=await getDB();if(!state){state=freshState();await save()}currentNotebookId=state.currentNotebookId;currentPageId=state.currentPageId;render()})().catch(e=>{console.error(e);alert("DeepuNotes could not initialize local storage.")});
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));