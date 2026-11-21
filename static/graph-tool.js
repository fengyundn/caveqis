"use strict";

const graphElement = id => document.getElementById(id);
const graphCanvas = graphElement("graph-canvas");
const graphCursorLayer = graphElement("graph-cursor-layer");
const graphDefaults = ["y = x² - 2","y = x + 1"];
const graphSettings = {...graphRangeDefaults};
const graphView = {...graphViewDefaults};
const graphSliderValues = {};
let graphRows, graphCompiled, graphFrame, graphGeometry, graphViewport;
let graphSequence = 0, graphDrag = null, graphCursor = null;
let lastSliderKeys = "";
let graphActiveRow, graphKeyboardGroup = "basic", graphGalleryGroup = "all", graphBeforeLoad;
let graphSaveTimer, graphRefineTimer, graphMoving = false, graphTableValues = [];
let graphLandmarks = [], graphLandmarkSelection = null;
let graphTitle = "";
const graphPointers = new Map();

function makeGraphRow(text="", visible=true) {
  return {id:++graphSequence,text,visible};
}

function graphSnapshot() {
  return {
    version:graphStateVersion,title:graphTitle,
    rows:graphRows.map(({text,visible})=>({text,visible})),sliders:{...graphSliderValues},view:{...graphView},
    settings:{...graphSettings},options:Object.fromEntries(["grid","intersections","trace"].map(key=>[key,graphElement("graph-"+key).checked])),
  };
}

function persistGraph() {
  clearTimeout(graphSaveTimer);
  storage.set("shuyan-graph-v1",graphSnapshot());
}

function graphScope() {
  const scope = Object.assign(Object.create(null),graphSliderValues);
  for (const [name,value] of graphCompiled.bindings) scope[name] = value;
  return scope;
}

function graphColor(index, dark=document.body.classList.contains("dark")) {
  const palette = dark ? graphDarkPalette : graphPalette;
  return palette[index%palette.length];
}

function renderGraphTool() {
  if (!graphRows) {
    const saved = graphStateFrom(storage.get("shuyan-graph-v1",{}));
    if (saved) setGraphState(saved);
    else graphRows = graphDefaults.map(text=>makeGraphRow(text));
  }
  renderGraphRanges();
  renderGraphRows();
  renderGraphKeyboard();
  compileGraph();
}

function renderGraphRows(focusId) {
  const container = graphElement("graph-rows");
  container.innerHTML = graphRows.map((row,index)=>`<div class="graph-row" data-graph-row="${row.id}">
    <div class="graph-row-controls">
      <button type="button" class="graph-visibility" data-graph-action="toggle" aria-label="${tr("显示或隐藏表达式")} ${index+1}" aria-pressed="${row.visible}"><span></span></button>
      <input type="text" class="graph-formula mono" value="${escapeHTML(row.text)}" maxlength="${graphTextLimit}" placeholder="y = sin(x)" autocomplete="off" spellcheck="false" aria-label="${tr("表达式")} ${index+1}" aria-describedby="graph-row-error-${row.id}">
      <button type="button" class="graph-remove" data-graph-action="remove" aria-label="${tr("删除表达式")} ${index+1}">×</button>
    </div><p id="graph-row-error-${row.id}" class="graph-row-error"></p>
  </div>`).join("");
  graphElement("graph-add").disabled = graphRows.length>=16;
  graphElement("graph-edit-keys").querySelector('[data-graph-edit="enter"]')?.toggleAttribute("disabled",graphRows.length>=16);
  selectGraphRow(focusId ?? (graphRows.some(row=>row.id===graphActiveRow) ? graphActiveRow : graphRows[0].id));
  lastSliderKeys = "";
  if (focusId) container.querySelector(`[data-graph-row="${focusId}"] input`)?.focus();
}

function selectGraphRow(id) {
  graphActiveRow = id;
  for (const row of graphElement("graph-rows").children) {
    row.classList.toggle("is-active",Number(row.dataset.graphRow)===id);
  }
}

function renderGraphKeyboard() {
  const select = graphElement("graph-key-category");
  select.replaceChildren(...Object.entries(graphKeyGroups).map(([key,group])=>new Option(bilingual(...group.name),key)));
  select.value = graphKeyboardGroup;
  const editKeys = [
    ["←","left","Move cursor left","光标左移"],["→","right","Move cursor right","光标右移"],
    ["⌫","backspace","Backspace","退格"],["↵","enter","Add expression","添加表达式"],
  ];
  graphElement("graph-edit-keys").replaceChildren(...editKeys.map(([label,action,en,zh])=>{
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.graphEdit = action;
    button.textContent = label;
    button.title = bilingual(en,zh);
    button.setAttribute("aria-label",button.title);
    button.disabled = action==="enter" && graphRows.length>=16;
    return button;
  }));
  renderGraphKeys();
}

function renderGraphKeys() {
  graphElement("graph-key-grid").replaceChildren(...graphKeyGroups[graphKeyboardGroup].keys.map(key=>{
    const [label,template] = typeof key==="string" ? [key,key] : key;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.graphKey = template;
    button.textContent = label==="x range" ? bilingual("x range","x 范围") : label;
    button.classList.toggle("graph-key-wide",label.length>5);
    button.title = template.replace("□","");
    return button;
  }));
}

function graphKeyboardClick(event) {
  const button = event.target.closest("[data-graph-key],[data-graph-edit]");
  if (!button) return;
  const action = button.dataset.graphEdit;
  if (action==="enter") { addGraphRow(); return; }
  const input = document.querySelector(`[data-graph-row="${graphActiveRow}"] input`);
  if (!input) return;
  const {value,selectionStart:start,selectionEnd:end} = input;
  const refocus = event.detail>0 && !window.matchMedia?.("(pointer: coarse)").matches;
  if (refocus) input.focus({preventScroll:true});
  if (action==="left" || action==="right") {
    const caret = action==="left" ? Math.max(0,start-Number(start===end)) : Math.min(value.length,end+Number(start===end));
    input.setSelectionRange(caret,caret);
    return;
  }
  const template = button.dataset.graphKey;
  const edit = action==="backspace" ? mathInput.backspace(value,start,end)
    : mathInput.insertTemplate(value,start,end,template==="!" && start!==end ? "(□)!" : template);
  if (edit.value.length>input.maxLength) return;
  input.value = edit.value;
  input.setSelectionRange(edit.start,edit.end);
  input.dispatchEvent(new Event("input",{bubbles:true}));
}

function drawGraphExample(canvas, example) {
  if (!canvas.clientWidth) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const {width,height} = canvas;
  const view = graphProjection(width,height,{x:example.x ?? 0,y:example.y ?? 0,span:example.span});
  const dark = document.body.classList.contains("dark");
  ctx.strokeStyle = dark ? "#343b54" : "#e9eaf3";
  ctx.beginPath();
  for (let x=0;x<=width;x+=16) { ctx.moveTo(x,0); ctx.lineTo(x,height); }
  for (let y=0;y<=height;y+=16) { ctx.moveTo(0,y); ctx.lineTo(width,y); }
  ctx.stroke();
  const [ox,oy] = view.toScreen(0,0);
  ctx.strokeStyle = dark ? "#687594" : "#a9b2c8";
  ctx.beginPath(); ctx.moveTo(ox,0); ctx.lineTo(ox,height); ctx.moveTo(0,oy); ctx.lineTo(width,oy); ctx.stroke();
  const compiled = compileGraphRows(example.rows.map(text=>({text,visible:true})));
  const scope = Object.assign(Object.create(null),Object.fromEntries(compiled.bindings),example.params);
  const geometry = {segments:[],points:[]};
  compiled.results.forEach(({plot},index)=>{
    if (!plot || plot.kind==="binding") return;
    ctx.strokeStyle = ctx.fillStyle = graphColor(index,dark);
    ctx.lineWidth = 2;
    if (plot.kind==="implicit") graphImplicit(ctx,plot,view,scope,4,geometry);
    else graphSample(ctx,plot,view,scope,{...graphRangeDefaults,...example.settings},geometry);
  });
}

function renderGraphExamples() {
  const examples = graphExamples.filter(example=>graphGalleryGroup==="all" || example.group===graphGalleryGroup);
  const grid = graphElement("graph-example-grid");
  grid.replaceChildren(...examples.map(example=>{
    const card = document.createElement("button");
    card.type = "button";
    card.className = "graph-example-card";
    card.dataset.graphExample = example.id;
    const preview = document.createElement("canvas");
    preview.width=192; preview.height=112;
    preview.setAttribute("aria-hidden","true");
    const name = document.createElement("span");
    name.textContent = bilingual(...example.title);
    const formula = document.createElement("code");
    formula.textContent = example.rows[0];
    card.append(preview,name,formula);
    return card;
  }));
  for (const button of graphElement("graph-example-groups").children) {
    button.setAttribute("aria-pressed",String(button.dataset.graphExampleGroup===graphGalleryGroup));
  }
  grid.scrollTop = 0;
  const canvases = grid.querySelectorAll("canvas");
  examples.forEach((example,i)=>drawGraphExample(canvases[i],example));
}

function setGraphState({rows,sliders,view,settings,options,title=""}) {
  graphRows = rows.map(row=>makeGraphRow(row.text,row.visible));
  graphTitle = title;
  graphActiveRow = graphRows[0].id;
  graphLandmarkSelection = null;
  for (const name of Object.keys(graphSliderValues)) delete graphSliderValues[name];
  Object.assign(graphSliderValues,sliders);
  Object.assign(graphView,view);
  Object.assign(graphSettings,settings);
  for (const [key,enabled] of Object.entries(options)) graphElement("graph-"+key).checked = enabled;
}

function applyGraphState(state,undoable=true) {
  if (undoable) graphBeforeLoad = graphSnapshot();
  setGraphState(state);
  renderGraphRanges();
  renderGraphRows();
  compileGraph();
  graphElement("graph-restore").hidden = !undoable;
}

function renderGraphRanges() {
  for (const [key,id] of Object.entries({tMin:"t-min",tMax:"t-max",thetaMin:"theta-min",thetaMax:"theta-max"})) {
    graphElement("graph-"+id).value = graphSettings[key]===2*Math.PI ? "2*pi" : graphSettings[key];
  }
  renderGraphAxes();
  graphElement("graph-range-error").textContent = "";
}

function renderGraphAxes() {
  const {clientWidth:width,clientHeight:height} = graphCanvas;
  const {toWorld} = graphProjection(width || 1,height || 1,graphView);
  const [xmin,ymax] = toWorld(0,0);
  const [xmax,ymin] = toWorld(width || 1,height || 1);
  for (const [id,value] of [["x-min",xmin],["x-max",xmax],["y-min",ymin],["y-max",ymax]]) {
    graphElement("graph-"+id).value = graphDisplayNumber(value,13);
  }
}

function loadGraphExample(example) {
  applyGraphState({
    rows:example.rows.map(text=>({text,visible:true})),sliders:example.params ?? {},
    view:{...graphViewDefaults,x:example.x ?? 0,y:example.y ?? 0,span:example.span},
    settings:{...graphRangeDefaults,...example.settings},options:graphSnapshot().options,
  });
  graphElement("graph-library").close();
}

function updateGraphSwatches() {
  graphRows.forEach((row,index)=>{
    const swatch = document.querySelector(`[data-graph-row="${row.id}"] .graph-visibility span`);
    if (swatch) swatch.style.backgroundColor = graphColor(index);
  });
}

function compileGraph() {
  graphCompiled = compileGraphRows(graphRows);
  for (const name of graphCompiled.parameters) {
    if (!Number.isFinite(graphSliderValues[name])) graphSliderValues[name] = 1;
  }
  graphLandmarkSelection = null;
  renderGraphIssues();
  updateGraphSwatches();
  renderGraphSliders();
  renderGraphTableOptions();
  persistGraph();
  scheduleGraphDraw();
}

function renderGraphIssues() {
  const scope = graphScope();
  graphCompiled.results.forEach((item,i)=>{
    const issue = item.error || graphDatasetIssue(item.plot,scope);
    const id = graphRows[i].id;
    const input = document.querySelector(`[data-graph-row="${id}"] input`);
    graphElement("graph-row-error-"+id).textContent = issue ? tr(issue) : "";
    input.setAttribute("aria-invalid",String(Boolean(issue)));
  });
}

function renderGraphSliders() {
  const params = graphCompiled.parameters;
  const container = graphElement("graph-sliders");
  const keys = params.join(",") + "/" + language;
  graphElement("graph-parameters").hidden = !params.length;
  if (keys === lastSliderKeys) return;
  lastSliderKeys = keys;
  container.innerHTML = params.map(name=>{
    const value = graphSliderValues[name], range = Math.max(10,Math.ceil(Math.abs(value)));
    return `<div class="graph-slider" data-parameter="${name}">
      <label for="graph-slider-${name}">${name}</label>
      <input type="range" id="graph-slider-${name}" min="${-range}" max="${range}" step="any" value="${value}">
      <input type="number" value="${value}" min="-1000000" max="1000000" step="any" aria-label="${tr("参数值")} ${name}">
    </div>`;
  }).join("");
}

function graphTablePlot() {
  const id = Number(graphElement("graph-table-select").value);
  return graphCompiled.results[graphRows.findIndex(row=>row.id===id)]?.plot;
}

function renderGraphTableOptions() {
  const select = graphElement("graph-table-select");
  const choice = select.value;
  const options = graphRows.flatMap((row,i)=>graphCompiled.results[i].plot?.kind==="y" && !graphCompiled.results[i].error
    ? [new Option(row.text,row.id)] : []);
  select.replaceChildren(...options);
  if (options.some(option=>option.value===choice)) select.value = choice;
  graphElement("graph-table-fields").hidden = !options.length;
  graphElement("graph-table-empty").hidden = !!options.length;
  renderGraphTable();
}

function renderGraphTable() {
  const plot = graphTablePlot();
  const startInput = graphElement("graph-table-start").value, stepInput = graphElement("graph-table-step").value;
  const start = Number(startInput), step = Number(stepInput);
  const valid = startInput!=="" && stepInput!=="" && Number.isFinite(start) && Number.isFinite(step) && step>0;
  graphElement("graph-table-error").textContent = plot && !valid ? tr("请填写起点和正的步长。") : "";
  graphTableValues = plot && valid ? Array.from({length:7},(_,i)=>{
    const x = start+i*step;
    const y = graphCoordinate(graphScope(),plot,x)?.[1];
    return [x,y];
  }) : [];
  graphElement("graph-table-export").disabled = !graphTableValues.length;
  graphElement("graph-table-body").innerHTML = graphTableValues.map(([x,y])=>
    `<tr><td>${graphDisplayNumber(x)}</td><td>${graphDisplayNumber(y)}</td></tr>`).join("");
}

function graphCurrentPlots() {
  return graphCompiled.results.flatMap((item,index)=>item.enabled && !item.error && item.plot && item.plot.kind!=="binding"
    ? [{plot:item.plot,index}] : []);
}

function scheduleGraphDraw() {
  if (graphFrame || graphElement("graph-panel").hidden) return;
  graphFrame = requestAnimationFrame(()=>{
    graphFrame = null;
    drawGraph();
  });
}

function drawGraph() {
  if (graphElement("graph-panel").hidden || !graphCompiled) return;
  const width = graphCanvas.clientWidth, height = graphCanvas.clientHeight;
  if (!width || !height) return;
  const ratio = Math.min(window.devicePixelRatio || 1,2);
  graphCanvas.width = Math.round(width*ratio);
  graphCanvas.height = Math.round(height*ratio);
  if (graphCursorLayer.width!==graphCanvas.width || graphCursorLayer.height!==graphCanvas.height) {
    graphCursorLayer.width=graphCanvas.width;
    graphCursorLayer.height=graphCanvas.height;
  }
  const ctx = graphCanvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(ratio,0,0,ratio,0,0);
  graphViewport = graphProjection(width,height,graphView);
  graphGeometry = {segments:[],points:[]};
  const dark = document.body.classList.contains("dark");
  const colors = dark ? {background:"#1d2235",axes:"#8691ad",major:"#424a62",minor:"#343a50",labels:"#b6c0db"}
    : {background:"#fff",axes:"#8993aa",major:"#dce2ee",minor:"#eef1f8",labels:"#58647e"};
  graphGrid(ctx,graphViewport,colors,graphElement("graph-grid").checked);

  const plots = graphCurrentPlots();
  const implicitCount = plots.filter(({plot})=>plot.kind==="implicit").length;
  const spacing = Math.max(graphMoving?9:4,Math.sqrt(width*height*Math.max(1,implicitCount)/(graphMoving?9000:36000)));
  const scope = graphScope();
  for (const {plot,index} of plots) {
    ctx.strokeStyle = ctx.fillStyle = graphColor(index,dark);
    ctx.lineJoin = ctx.lineCap = "round";
    ctx.lineWidth = 2.15;
    const plotScope = Object.assign(Object.create(null),scope);
    if (plot.kind === "implicit") graphImplicit(ctx,plot,graphViewport,plotScope,spacing,graphGeometry);
    else graphSample(ctx,plot,graphViewport,plotScope,graphSettings,graphGeometry,graphMoving);
  }
  if (!graphMoving) {
    graphLandmarks = graphElement("graph-intersections").checked
      ? graphIntersections(plots.map(({plot})=>plot),graphViewport,scope,true) : [];
    renderGraphLandmarks();
    for (const {screen:point} of graphLandmarks) {
      ctx.beginPath();
      ctx.arc(...point,4.3,0,Math.PI*2);
      ctx.fillStyle = colors.axes;
      ctx.fill();
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = colors.background;
      ctx.stroke();
      graphGeometry.points.push(point);
    }
  }
  renderGraphCursor();
}

const graphLandmarkName = {root:"零点",intersection:"交点",maximum:"极大值",minimum:"极小值","y-intercept":"纵截距"};

function graphLandmarkLabel(point) {
  return point.kinds.map(kind=>tr(graphLandmarkName[kind])).join(" / ") +
    `  (${graphDisplayNumber(point.x)}, ${graphDisplayNumber(point.y)})`;
}

function renderGraphLandmarks() {
  const select = graphElement("graph-landmarks");
  const selected = graphLandmarkSelection;
  const nearest = selected ? graphLandmarks.findIndex(point=>{
    const [x,y] = graphViewport.toScreen(selected.x,selected.y);
    return Math.hypot(x-point.screen[0],y-point.screen[1])<7;
  }) : -1;
  graphLandmarkSelection = nearest>=0 ? graphLandmarks[nearest] : null;
  select.replaceChildren(new Option(tr("选择关键点"),""),...graphLandmarks.map((point,i)=>new Option(graphLandmarkLabel(point),String(i))));
  select.value = graphLandmarkSelection ? String(nearest) : "";
  graphElement("graph-landmark-field").hidden = !graphLandmarks.length;
}

function selectGraphLandmark(index) {
  graphLandmarkSelection = graphLandmarks[index] ?? null;
  graphElement("graph-landmarks").value = graphLandmarkSelection ? String(index) : "";
  renderGraphCursor();
}

graphElement("graph-landmarks").addEventListener("change",event=>selectGraphLandmark(event.target.value==="" ? -1 : Number(event.target.value)));

function closestGraphPoint(x,y) {
  let closest = null, limit = 14**2;
  function consider(px,py) {
    const distance = (x-px)**2+(y-py)**2;
    if (distance<limit) { closest=[px,py]; limit=distance; }
  }
  for (const [px,py] of graphGeometry.points) consider(px,py);
  if (closest && limit<8**2) return closest;
  for (const [[ax,ay],[bx,by]] of graphGeometry.segments) {
    const dx=bx-ax, dy=by-ay, square=dx*dx+dy*dy;
    if (!square) continue;
    const portion=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/square));
    consider(ax+portion*dx,ay+portion*dy);
  }
  return closest;
}

function renderGraphCursor() {
  if (!graphViewport || !graphGeometry) return;
  const ctx = graphCursorLayer.getContext("2d");
  if (!ctx) return;
  const ratio = graphCursorLayer.width / graphViewport.width;
  ctx.setTransform(ratio,0,0,ratio,0,0);
  ctx.clearRect(0,0,graphViewport.width,graphViewport.height);
  const display=graphElement("graph-coordinate");
  if (graphLandmarkSelection) {
    const point = graphLandmarkSelection;
    display.textContent = graphLandmarkLabel(point);
    ctx.beginPath();
    ctx.arc(...graphViewport.toScreen(point.x,point.y),6.5,0,2*Math.PI);
    ctx.fillStyle = document.body.classList.contains("dark") ? "#ded8ff" : "#5144c9";
    ctx.fill();
    return;
  }
  if (!graphCursor || !graphElement("graph-trace").checked) {
    display.textContent = tr("移动指针可查看坐标");
    return;
  }
  const point = closestGraphPoint(...graphCursor);
  const [x,y] = graphViewport.toWorld(...(point || graphCursor));
  display.textContent = `x = ${graphDisplayNumber(x)}    y = ${graphDisplayNumber(y)}` + (point ? "  ·  " + tr("曲线上") : "");
  if (!point) return;
  ctx.beginPath();
  ctx.arc(...point,5.2,0,2*Math.PI);
  ctx.fillStyle = document.body.classList.contains("dark") ? "#eef0ff" : "#2d3151";
  ctx.fill();
}

function graphPointer(event) {
  const rect = graphCanvas.getBoundingClientRect();
  return [event.clientX-rect.left,event.clientY-rect.top];
}

function changeGraphView(next) {
  Object.assign(graphView,next,{
    x:Math.min(1e8,Math.max(-1e8,next.x)),y:Math.min(1e8,Math.max(-1e8,next.y)),
  });
  graphMoving = true;
  clearTimeout(graphRefineTimer);
  graphRefineTimer = setTimeout(()=>{
    graphMoving = false;
    renderGraphAxes();
    scheduleGraphDraw();
  },120);
  clearTimeout(graphSaveTimer);
  graphSaveTimer = setTimeout(persistGraph,200);
  scheduleGraphDraw();
}

function transformGraphView(view,factor,source,target) {
  const {width,height} = graphViewport;
  const span = size=>size ? Math.min(1e7,Math.max(1e-4,size*factor)) : 0;
  const next = {...view,span:span(view.span),xSpan:span(view.xSpan),ySpan:span(view.ySpan)};
  const origin = graphProjection(width,height,view).toWorld(...source);
  const [x,y] = graphProjection(width,height,next).toWorld(...target);
  changeGraphView({...next,x:view.x+origin[0]-x,y:view.y+origin[1]-y});
}

function zoomGraph(factor,anchor) {
  if (!graphViewport) return;
  const center = anchor ?? [graphViewport.width/2,graphViewport.height/2];
  transformGraphView(graphView,factor,center,center);
}

function graphGesture() {
  const [first,second] = graphPointers.values();
  if (!second) return {center:first,distance:0};
  return {center:[(first[0]+second[0])/2,(first[1]+second[1])/2],distance:Math.hypot(first[0]-second[0],first[1]-second[1])};
}

graphCanvas.addEventListener("wheel",event=>{
  event.preventDefault();
  zoomGraph(Math.exp(Math.max(-180,Math.min(180,event.deltaY))*0.0025),graphPointer(event));
},{passive:false});
graphCanvas.addEventListener("pointerdown",event=>{
  if (!graphViewport || graphPointers.size===2 || (event.pointerType==="mouse" && event.button!==0)) return;
  graphPointers.set(event.pointerId,graphPointer(event));
  graphDrag = {...graphGesture(),view:{...graphView},moved:graphPointers.size>1};
  graphCanvas.setPointerCapture?.(event.pointerId);
});
graphCanvas.addEventListener("pointermove",event=>{
  const point = graphPointer(event);
  if (graphPointers.has(event.pointerId)) {
    graphPointers.set(event.pointerId,point);
    const {center,distance} = graphGesture();
    const shift = Math.hypot(center[0]-graphDrag.center[0],center[1]-graphDrag.center[1]);
    if (graphDrag.moved || shift>4) {
      graphDrag.moved = true;
      const factor = graphDrag.distance && distance ? graphDrag.distance/distance : 1;
      transformGraphView(graphDrag.view,factor,graphDrag.center,center);
    }
  }
  graphCursor = point;
  if (!graphDrag) renderGraphCursor();
});
for (const event of ["pointerup","pointercancel","lostpointercapture"]) graphCanvas.addEventListener(event,e=>{
  if (!graphPointers.has(e.pointerId)) return;
  graphPointers.delete(e.pointerId);
  if (event==="pointerup" && !graphDrag.moved && !graphMoving) {
    const pointer = graphPointer(e);
    selectGraphLandmark(graphLandmarks.findIndex(({screen})=>Math.hypot(screen[0]-pointer[0],screen[1]-pointer[1])<12));
  }
  graphDrag = graphPointers.size ? {...graphGesture(),view:{...graphView},moved:true} : null;
});
graphCanvas.addEventListener("pointerleave",()=>{
  graphCursor=null;
  renderGraphCursor();
});
graphCanvas.addEventListener("keydown",event=>{
  const horizontal = (graphView.xSpan || graphView.span)/12, vertical = (graphView.ySpan || graphView.span)/12;
  if (event.key === "+") zoomGraph(0.8);
  else if (event.key === "-") zoomGraph(1.25);
  else if (event.key === "Home") changeGraphView(graphViewDefaults);
  else if (event.key === "ArrowLeft") changeGraphView({...graphView,x:graphView.x-horizontal});
  else if (event.key === "ArrowRight") changeGraphView({...graphView,x:graphView.x+horizontal});
  else if (event.key === "ArrowUp") changeGraphView({...graphView,y:graphView.y+vertical});
  else if (event.key === "ArrowDown") changeGraphView({...graphView,y:graphView.y-vertical});
  else return;
  event.preventDefault();
});

function addGraphRow() {
  if (graphRows.length>=16) return;
  const row = makeGraphRow();
  graphRows.push(row);
  renderGraphRows(row.id);
  compileGraph();
}
graphElement("graph-add").addEventListener("click",addGraphRow);
graphElement("graph-rows").addEventListener("focusin",event=>{
  if (event.target.matches(".graph-formula")) selectGraphRow(Number(event.target.closest("[data-graph-row]").dataset.graphRow));
});
graphElement("graph-rows").addEventListener("input",event=>{
  if (!event.target.matches("input") || event.isComposing) return;
  const row = graphRows.find(row=>row.id===Number(event.target.closest("[data-graph-row]").dataset.graphRow));
  row.text = event.target.value;
  compileGraph();
});
graphElement("graph-rows").addEventListener("keydown",event=>{
  if (event.key==="Enter" && event.target.matches("input") && !event.isComposing) {
    event.preventDefault();
    addGraphRow();
  }
});
graphElement("graph-rows").addEventListener("click",event=>{
  const action = event.target.closest("[data-graph-action]");
  if (!action) return;
  const id = Number(action.closest("[data-graph-row]").dataset.graphRow);
  const row = graphRows.find(row=>row.id===id);
  if (action.dataset.graphAction==="toggle") {
    row.visible = !row.visible;
    action.setAttribute("aria-pressed",String(row.visible));
  } else {
    graphRows = graphRows.filter(row=>row.id!==id);
    if (!graphRows.length) graphRows.push(makeGraphRow());
    renderGraphRows(graphRows[0].id);
  }
  compileGraph();
});
graphElement("graph-key-category").addEventListener("change",event=>{
  graphKeyboardGroup = event.target.value;
  renderGraphKeys();
});
graphElement("graph-keyboard").addEventListener("mousedown",event=>{
  if (event.target.closest("[data-graph-key],[data-graph-edit]")) event.preventDefault();
});
graphElement("graph-keyboard").addEventListener("click",graphKeyboardClick);
graphElement("graph-examples").addEventListener("click",()=>{
  const groups = graphElement("graph-example-groups");
  groups.replaceChildren(...Object.entries(graphExampleGroups).map(([id,name])=>{
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.graphExampleGroup = id;
    button.textContent = bilingual(...name);
    return button;
  }));
  graphElement("graph-library").showModal();
  renderGraphExamples();
});
graphElement("graph-close-library").addEventListener("click",()=>graphElement("graph-library").close());
graphElement("graph-example-groups").addEventListener("click",event=>{
  const button = event.target.closest("[data-graph-example-group]");
  if (!button) return;
  graphGalleryGroup = button.dataset.graphExampleGroup;
  renderGraphExamples();
});
graphElement("graph-example-grid").addEventListener("click",event=>{
  const card = event.target.closest("[data-graph-example]");
  if (card) loadGraphExample(graphExamples.find(example=>example.id===card.dataset.graphExample));
});
graphElement("graph-restore").addEventListener("click",()=>{
  if (!graphBeforeLoad) return;
  applyGraphState(graphBeforeLoad,false);
  graphBeforeLoad = undefined;
  graphElement("graph-examples").focus();
});
graphElement("graph-sliders").addEventListener("input",event=>{
  const row = event.target.closest("[data-parameter]");
  if (!row || event.target.value==="") return;
  const value = Number(event.target.value);
  if (!Number.isFinite(value) || Math.abs(value)>1e6) return;
  const name = row.dataset.parameter;
  graphSliderValues[name] = value;
  const slider = row.querySelector('input[type="range"]');
  if (event.target===slider) row.querySelector('input[type="number"]').value = graphDisplayNumber(value);
  else if (value<Number(slider.min) || value>Number(slider.max)) {
    const range=Math.ceil(Math.abs(value));
    slider.min=-range; slider.max=range;
  }
  slider.value = value;
  graphLandmarkSelection = null;
  renderGraphIssues();
  persistGraph();
  renderGraphTable();
  scheduleGraphDraw();
});
graphElement("graph-sliders").addEventListener("change",event=>{
  if (event.target.type==="number") event.target.value=graphSliderValues[event.target.closest("[data-parameter]").dataset.parameter];
});
graphElement("graph-table-select").addEventListener("change",renderGraphTable);
for (const id of ["graph-table-start","graph-table-step"]) graphElement(id).addEventListener("input",renderGraphTable);
for (const id of ["graph-grid","graph-intersections","graph-trace"]) graphElement(id).addEventListener("change",()=>{
  persistGraph();
  scheduleGraphDraw();
});
graphElement("graph-zoom-in").addEventListener("click",()=>zoomGraph(0.8));
graphElement("graph-zoom-out").addEventListener("click",()=>zoomGraph(1.25));
graphElement("graph-reset").addEventListener("click",()=>changeGraphView(graphViewDefaults));
graphElement("graph-export").addEventListener("click",()=>{
  if (window.CaveqisPlatform) {
    graphCanvas.toBlob(blob => {
      if (blob) window.CaveqisPlatform.saveFile("caveqis-graph.png", blob);
    }, "image/png");
    return;
  }
  const link=document.createElement("a");
  link.href=graphCanvas.toDataURL("image/png");
  link.download="math-studio-graph.png";
  link.click();
});
graphElement("graph-apply-range").addEventListener("click",()=>{
  try {
    const read = (id,max=1e5) => {
      const expression = normalizeGraphExpression(graphElement(id).value);
      if (expression.length>40) throw graphError("");
      const number = parseGraphNumber(expression,new Map()).evaluate(Object.create(null));
      if (!Number.isFinite(number) || Math.abs(number)>max) throw graphError("");
      return number;
    };
    const tMin=read("graph-t-min"), tMax=read("graph-t-max"), thetaMin=read("graph-theta-min"), thetaMax=read("graph-theta-max");
    const xmin=read("graph-x-min",1e8), xmax=read("graph-x-max",1e8);
    const ymin=read("graph-y-min",1e8), ymax=read("graph-y-max",1e8);
    const xSpan=xmax-xmin, ySpan=ymax-ymin;
    if (tMin>=tMax || thetaMin>=thetaMax || [xSpan,ySpan].some(span=>span<1e-4 || span>1e7)) throw graphError("");
    Object.assign(graphSettings,{tMin,tMax,thetaMin,thetaMax});
    Object.assign(graphView,{x:(xmin+xmax)/2,y:(ymin+ymax)/2,xSpan,ySpan});
    graphElement("graph-range-error").textContent = "";
    persistGraph();
    scheduleGraphDraw();
  } catch {
    graphElement("graph-range-error").textContent=tr("请输入有效范围，且下限小于上限。");
  }
});
const refreshGraphLayout = ()=>{
  if (graphElement("graph-panel").hidden) return;
  if (!graphElement("graph-settings").open) renderGraphAxes();
  scheduleGraphDraw();
};
graphElement("graph-settings").addEventListener("toggle",()=>{
  if (graphElement("graph-settings").open) renderGraphAxes();
});
if (typeof ResizeObserver==="function") new ResizeObserver(refreshGraphLayout).observe(graphCanvas);
window.addEventListener("resize",refreshGraphLayout);

function graphDownload(filename,contents,type) {
  const blob = new Blob([contents],{type});
  if (window.CaveqisPlatform) {
    window.CaveqisPlatform.saveFile(filename, blob);
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function graphSavedDocuments() {
  const entries = storage.get("shuyan-graph-library-v1",[]);
  return Array.isArray(entries) ? entries.flatMap(entry=>{
    const state = graphStateFrom(entry?.state,true);
    return state && typeof entry.name==="string" ? [{name:entry.name,state}] : [];
  }).slice(0,graphSavedLimit) : [];
}

function showGraphSaveStatus(message) {
  graphElement("graph-save-status").textContent = message ? tr(message) : "";
}

function renderSavedGraphs() {
  const container = graphElement("graph-save-list");
  const entries = graphSavedDocuments();
  container.replaceChildren();
  if (!entries.length) {
    container.textContent = tr("尚无已保存的图表。");
    return;
  }
  for (const [index,{name}] of entries.entries()) {
    const row = document.createElement("div");
    const label = document.createElement("span");
    label.textContent = name;
    row.dataset.savedGraph = index;
    row.append(label);
    for (const [action,text] of [["open","打开"],["remove","删除"]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "graph-add";
      button.dataset.savedAction = action;
      button.textContent = tr(text);
      button.setAttribute("aria-label",`${tr(text)} ${name}`);
      row.append(button);
    }
    container.append(row);
  }
}

function saveGraphList(entries) {
  storage.set("shuyan-graph-library-v1",entries);
  return JSON.stringify(storage.get("shuyan-graph-library-v1",null))===JSON.stringify(entries);
}

graphElement("graph-open-saves").addEventListener("click",()=>{
  showGraphSaveStatus("");
  graphElement("graph-save-name").value = graphTitle;
  renderSavedGraphs();
  graphElement("graph-saves").showModal();
});
graphElement("graph-close-saves").addEventListener("click",()=>graphElement("graph-saves").close());
graphElement("graph-save-form").addEventListener("submit",event=>{
  event.preventDefault();
  const name = graphElement("graph-save-name").value.trim();
  const entries = graphSavedDocuments();
  if (!name) { showGraphSaveStatus("请输入图表名称。"); return; }
  const remaining = entries.filter(entry=>entry.name!==name);
  if (remaining.length>=graphSavedLimit) { showGraphSaveStatus("最多可保存 30 张图表。"); return; }
  const saved = saveGraphList([{name,state:{...graphSnapshot(),title:name}},...remaining]);
  if (saved) {
    graphTitle = name;
    persistGraph();
  }
  showGraphSaveStatus(saved ? "图表已保存。" : "浏览器存储不可用。可导出图表文件。");
  renderSavedGraphs();
});
graphElement("graph-save-list").addEventListener("click",event=>{
  const button = event.target.closest("[data-saved-action]");
  if (!button) return;
  const entries = graphSavedDocuments();
  const index = Number(button.closest("[data-saved-graph]").dataset.savedGraph);
  const entry = entries[index];
  if (button.dataset.savedAction==="open") {
    applyGraphState({...entry.state,title:entry.name});
    graphElement("graph-saves").close();
  } else {
    entries.splice(index,1);
    showGraphSaveStatus(saveGraphList(entries) ? "已删除保存的图表。" : "浏览器存储不可用。可导出图表文件。");
    renderSavedGraphs();
  }
});
graphElement("graph-export-state").addEventListener("click",()=>{
  const title = graphElement("graph-save-name").value.trim();
  graphDownload("math-studio-graph.json",JSON.stringify({format:"math-studio-graph",...graphSnapshot(),title},null,2),"application/json");
});
graphElement("graph-import-state").addEventListener("click",()=>graphElement("graph-import-file").click());
graphElement("graph-import-file").addEventListener("change",async event=>{
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    if (file.size>graphFileLimit) throw Error();
    const parsed = JSON.parse(await file.text());
    const state = parsed?.format==="math-studio-graph" && graphStateFrom(parsed,true);
    if (!state) throw Error();
    applyGraphState(state);
    graphElement("graph-saves").close();
  } catch {
    showGraphSaveStatus("无法读取此图表文件。请选择本工具箱导出的 JSON。");
  }
});
graphElement("graph-table-export").addEventListener("click",()=>{
  if (!graphTableValues.length) return;
  const csv = ["x,y",...graphTableValues.map(row=>row.map(value=>Number.isFinite(value)?String(value):"").join(","))].join("\r\n");
  graphDownload("math-studio-values.csv",csv,"text/csv;charset=utf-8");
});

function graphResultRows(result) {
  if (!result?.ok || !Array.isArray(result.graph)) return [];
  return [...new Set(result.graph)].flatMap(text=>{
    if (typeof text!=="string" || text.length>graphTextLimit) return [];
    const row = {text,visible:true};
    const {results:[item]} = compileGraphRows([row]);
    return item.plot && !item.error && !["binding","data"].includes(item.plot.kind) ? [row] : [];
  }).slice(0,graphRowLimit);
}

function sendResultToGraph(result) {
  const added = graphResultRows(result);
  if (!added.length) return;
  navigate("graph");
  const original = graphSnapshot();
  const rows = original.rows.filter(row=>row.text.trim());
  if (rows.length+added.length>graphRowLimit) {
    toast("请在图表中留出足够的表达式位置，再发送结果。");
    return;
  }
  applyGraphState({...original,rows:[...rows,...added]});
  const first = graphRows[rows.length];
  selectGraphRow(first.id);
  document.querySelector(`[data-graph-row="${first.id}"] input`)?.focus({preventScroll:true});
}
