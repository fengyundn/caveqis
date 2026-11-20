const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {JSDOM} = require("jsdom");
const root=path.resolve(__dirname,"..");

function workspace({history=[],hash="",graph}={}) {
  const dom=new JSDOM(fs.readFileSync(path.join(root,"static/index.html"),"utf8"),{url:"http://127.0.0.1:8765/"+hash,runScripts:"outside-only",pretendToBeVisual:true});
  const {window}=dom, requests=[];
  window.matchMedia=()=>({matches:false});
  window.fetch=async(url,options)=>{
    if (options) requests.push(JSON.parse(options.body));
    return {json:async()=>options ? {ok:true,items:[{label:"result",text:"1",latex:"1"}],notes:[],...(graph ? {graph} : {})} : {ok:true,timeout:12}};
  };
  window.localStorage.setItem("shuyan-history-v1",JSON.stringify(history));
  window.eval(fs.readFileSync(path.join(root,"static/math-input.js"),"utf8"));
  window.eval(["locale.js","examples.js","guide.js","units.js","utility-tools.js","graph-math.js","graph-canvas.js","graph-state.js","graph-library.js","graph-tool.js","formula-builder.js","app.js"].map(script => fs.readFileSync(path.join(root,"static",script),"utf8")).join("\n"));
  const $=selector=>window.document.querySelector(selector);
  const change=value=>{const select=$("#operation");select.value=value;select.dispatchEvent(new window.Event("change",{bubbles:true}));};
  const chooseType=value=>{
    if (!$("#calculation-type")) $('[data-category="calculate"]').click();
    const select=$("#calculation-type"); select.value=value; select.dispatchEvent(new window.Event("change",{bubbles:true}));
  };
  const setLanguage=value=>{const select=$("#language-select");select.value=value;select.dispatchEvent(new window.Event("change",{bubbles:true}));};
  return {window,$,requests,change,chooseType,setLanguage,close:()=>window.close()};
}

test("science has one math input and a shared operation selector",()=>{
  const app=workspace();
  try {
    assert.equal(app.$("#tool-fields").querySelectorAll("input,textarea").length,1);
    assert.ok(app.$("#expression"));
    assert.equal(app.$("#input-card-heading").hidden,true);
    assert.equal(app.$("#advanced-settings").hidden,true);
    assert.deepEqual([...app.window.document.querySelectorAll(".nav-item[data-category]")].map(button => button.dataset.category),
      ["calculate","equations","date","converter","graph"]);
    const guide = app.$("#help-sidebar");
    assert.equal(guide.previousElementSibling.dataset.category,"graph");
    app.$("#help-dialog").showModal = () => { app.$("#help-dialog").open = true; };
    guide.click();
    assert.equal(app.$("#help-dialog").open,true);
    assert.equal(app.$(".top-actions [aria-haspopup='dialog']"),null);
    assert.ok(app.$("#calculation-type"));
    assert.equal(app.$('#operation option[value="equation_auto"]'),null);
    assert.ok(app.$('#operation option[value="factor"]'));
    assert.equal(app.$('#operation option[value="equation_ode"]'),null);
    assert.equal(app.$('#operation option[value="equation_integral"]'),null);
  } finally {app.close();}
});

test("graphing loads example curves, updates its table with a slider and preserves expressions",()=>{
  const app=workspace({hash:"#graph"});
  try {
    const change=(selector,value,type="change")=>{
      const field=app.$(selector);
      field.value=value;
      field.dispatchEvent(new app.window.Event(type,{bubbles:true}));
    };
    assert.equal(app.$("#graph-panel").hidden,false);
    assert.equal(app.$("#page-title").textContent,"Graphing");
    assert.equal(app.$("#graph-table-body tr").textContent,"-37");
    const library=app.$("#graph-library");
    library.showModal=()=>library.open=true;
    library.close=()=>library.open=false;
    app.$("#graph-examples").click();
    app.$('[data-graph-example-group="trigonometry"]').click();
    assert.equal(app.$('[data-graph-example="histogram"]'),null);
    app.$('[data-graph-example="sliders"]').click();
    assert.equal(library.open,false);
    assert.deepEqual([...app.window.document.querySelectorAll("[data-parameter]")].map(row=>row.dataset.parameter),["a","b","c"]);
    change("#graph-table-start","1","input");
    const before=app.$("#graph-table-body tr td:last-child").textContent;
    change('[data-parameter="a"] input[type="number"]',"2","input");
    const after=app.$("#graph-table-body tr td:last-child").textContent;
    assert.ok(Math.abs(Number(after)-2*Number(before))<1e-6);
    app.$('.graph-visibility').click();
    assert.equal(app.$('.graph-visibility').getAttribute("aria-pressed"),"false");
    assert.equal(JSON.parse(app.window.localStorage.getItem("shuyan-graph-v1")).sliders.a,2);
    app.setLanguage("zh");
    assert.equal(app.$("#page-title").textContent,"图表");
    app.$('[data-category="converter"]').click();
    app.$('[data-category="graph"]').click();
    assert.equal(app.$(".graph-formula").value,"y = a*sin(b*x)");
    app.$("#graph-restore").click();
    assert.equal(app.$(".graph-formula").value,"y = x² - 2");
    assert.equal(app.requests.length,0);
  } finally {app.close();}
});

test("graph symbols edit the current expression selection without exposing digit keys",()=>{
  const app=workspace({hash:"#graph"});
  try {
    const inputs=[...app.window.document.querySelectorAll(".graph-formula")];
    for (const group of app.$("#graph-key-category").options) {
      app.$("#graph-key-category").value=group.value;
      app.$("#graph-key-category").dispatchEvent(new app.window.Event("change"));
      assert.ok([...app.$("#graph-key-grid").children].every(button=>!/^\d$/.test(button.textContent)));
    }
    const input=inputs[1];
    input.focus();
    input.setSelectionRange(4,9);
    app.$("#graph-key-category").value="trig";
    app.$("#graph-key-category").dispatchEvent(new app.window.Event("change"));
    [...app.$("#graph-key-grid").children].find(button=>button.textContent==="sin").click();
    assert.equal(input.value,"y = sin(x + 1)");
    assert.equal(inputs[0].value,"y = x² - 2");
    app.$('[data-graph-edit="left"]').click();
    app.$('[data-graph-edit="backspace"]').click();
    assert.equal(input.value,"y = sin(x + )");
    app.$('[data-graph-edit="enter"]').click();
    assert.equal(app.$(".graph-row.is-active input").value,"");
  } finally { app.close(); }
});

test("graphable results append to a graph and named saves restore independent axes",async()=>{
  const app=workspace({graph:["y = x**2 + 2"]});
  try {
    app.$("#expression").value = "x^2+2";
    app.$("#calculation-form").dispatchEvent(new app.window.Event("submit",{bubbles:true,cancelable:true}));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(app.$("#send-result-graph").hidden,false);
    app.$("#send-result-graph").click();
    assert.equal(app.$("#graph-panel").hidden,false);
    assert.equal(app.$(".graph-row.is-active input").value,"y = x**2 + 2");
    for (const [axis,value] of [["x-min",-3],["x-max",9],["y-min",-1],["y-max",5]]) app.$("#graph-"+axis).value=value;
    app.$("#graph-apply-range").click();
    const saved = app.$("#graph-saves");
    saved.showModal=()=>saved.open=true;
    saved.close=()=>saved.open=false;
    app.$("#graph-open-saves").click();
    app.$("#graph-save-name").value="Saved plot";
    app.$("#graph-save-form").dispatchEvent(new app.window.Event("submit",{cancelable:true}));
    const [entry]=JSON.parse(app.window.localStorage.getItem("shuyan-graph-library-v1"));
    assert.equal(entry.name,"Saved plot");
    assert.equal(entry.state.title,"Saved plot");
    assert.equal(JSON.parse(app.window.localStorage.getItem("shuyan-graph-v1")).title,"Saved plot");
    assert.equal(entry.state.view.xSpan,12);
    assert.equal(entry.state.view.ySpan,6);
    app.$("#graph-close-saves").click();
    app.$("#graph-restore").click();
    assert.equal(app.window.document.querySelectorAll(".graph-formula").length,2);
    app.$("#graph-open-saves").click();
    app.$('[data-saved-action="open"]').click();
    assert.equal(app.$("#graph-x-max").value,"9");
    assert.equal(app.window.document.querySelectorAll(".graph-formula").length,3);
  } finally {app.close();}
});

test("visual formula templates insert valid text at the current selection",()=>{
  const app=workspace({hash:"#graph"});
  try {
    const dialog=app.$("#formula-builder");
    dialog.showModal=()=>dialog.open=true;
    dialog.close=()=>dialog.open=false;
    const input=app.$(".graph-formula");
    input.focus();
    input.setSelectionRange(4,6);
    app.$('[data-formula-builder="graph"]').click();
    assert.equal(app.$('[name="top"]').value,"x²");
    app.$('[name="bottom"]').value="2";
    app.$("#formula-builder-form").dispatchEvent(new app.window.Event("submit",{cancelable:true}));
    assert.equal(input.value,"y = ((x²)/(2)) - 2");
    assert.equal(input.getAttribute("aria-invalid"),"false");
  } finally {app.close();}
});

test("two touch pointers zoom about their midpoint and keep the viewport saveable",async()=>{
  const app=workspace({hash:"#graph"});
  try {
    const canvas=app.$("#graph-canvas"), overlay=app.$("#graph-cursor-layer");
    Object.defineProperties(canvas,{clientWidth:{value:600},clientHeight:{value:400}});
    const ctx=Object.fromEntries("setTransform fillRect beginPath moveTo lineTo stroke fill fillText arc clearRect setLineDash".split(" ").map(name=>[name,()=>{}]));
    ctx.measureText=text=>({width:text.length*8});
    canvas.getContext=overlay.getContext=()=>ctx;
    await new Promise(resolve=>app.window.requestAnimationFrame(resolve));
    const pointer=(name,id,x)=>{
      const event=new app.window.MouseEvent(name,{clientX:x,clientY:200,button:0});
      Object.defineProperties(event,{pointerType:{value:"touch"},pointerId:{value:id}});
      canvas.dispatchEvent(event);
    };
    pointer("pointerdown",1,250);
    pointer("pointerdown",2,350);
    pointer("pointermove",2,450);
    pointer("pointerup",2,450);
    pointer("pointerup",1,250);
    const saved=app.$("#graph-saves");
    saved.showModal=()=>saved.open=true;
    app.$("#graph-open-saves").click();
    app.$("#graph-save-name").value="Pinched view";
    app.$("#graph-save-form").dispatchEvent(new app.window.Event("submit",{cancelable:true}));
    const [entry]=JSON.parse(app.window.localStorage.getItem("shuyan-graph-library-v1"));
    assert.equal(entry.state.view.span,6.5);
    assert.ok(Math.abs(entry.state.view.x+0.8125)<1e-9);
    assert.equal(entry.state.view.y,0);
  } finally {app.close();}
});

test("converter changes units, swaps direction, and works without calling the math engine",()=>{
  const app=workspace({hash:"#converter"});
  try {
    const update = (selector,value,event="change") => {
      const control = app.$(selector);
      control.value = value;
      control.dispatchEvent(new app.window.Event(event,{bubbles:true}));
    };
    assert.equal(app.$("#math-workspace").hidden,true);
    assert.equal(app.$("#converter-panel").hidden,false);
    assert.equal(app.$("#converter-category").options.length,12);
    assert.equal(app.$('#converter-category option[value="currency"]'),null);
    update("#converter-category","data");
    update("#converter-from","GiB");
    update("#converter-to","MiB");
    update("#converter-value","２","input");
    assert.equal(app.$("#converter-result").textContent,"2,048");
    app.$("#converter-swap").click();
    assert.equal(app.$("#converter-from").value,"MiB");
    assert.equal(app.$("#converter-value").value,"2048");
    assert.equal(app.$("#converter-result").textContent,"2");
    update("#converter-category","temperature");
    update("#converter-from","°F");
    update("#converter-to","°C");
    update("#converter-value","−40","input");
    assert.equal(app.$("#converter-result").textContent,"-40");
    app.setLanguage("zh");
    assert.equal(app.$("#page-title").textContent,"转换器");
    assert.equal(app.$("#converter-value").value,"−40");
    assert.equal(app.requests.length,0);
    app.$('[data-category="calculate"]').click();
    assert.equal(app.$("#math-workspace").hidden,false);
    assert.equal(app.$("#converter-panel").hidden,true);
  } finally {app.close();}
});

test("date calculator handles leap days, calendar offsets, reversed dates and range limits",()=>{
  const app=workspace({hash:"#date"});
  try {
    const set = (id,value) => {
      const control=app.$("#"+id);
      control.value=value;
      control.dispatchEvent(new app.window.Event("change",{bubbles:true}));
    };
    assert.equal(app.$("#date-panel").hidden,false);
    set("date-from","2024-03-01");
    set("date-to","2024-02-28");
    assert.equal(app.$("#date-result").textContent,"2 days");
    set("date-from","2024-03-09");
    set("date-to","2024-03-11");
    assert.equal(app.$("#date-result").textContent,"2 days");
    set("date-mode","offset");
    set("date-start","2024-01-31");
    set("date-months","1");
    assert.equal(app.$("#date-detail").textContent,"2024-02-29");
    set("date-days","1");
    assert.equal(app.$("#date-detail").textContent,"2024-03-01");
    set("date-direction","subtract");
    set("date-start","2024-03-31");
    assert.equal(app.$("#date-detail").textContent,"2024-02-29");
    set("date-start","1601-01-01");
    assert.match(app.$("#date-error").textContent,/outside the supported range/);
    assert.equal(app.requests.length,0);
  } finally {app.close();}
});

test("every workspace uses a select and other workspace settings remain available",()=>{
  const app=workspace();
  try {
    for (const category of ["determinant","matrix","integral","derivative","analysis","series"]) {
      app.chooseType(category);
      assert.equal(app.$("#operation").tagName,"SELECT");
      assert.equal(app.$(".operation-tab"),null);
      assert.equal(app.$("#input-card-heading").hidden,false);
      assert.equal(app.$("#advanced-settings").hidden,false);
    }
    app.chooseType("derivative");
    app.change("partial");
    assert.equal(app.$("#variables").value,"x:1,y:1");
    app.change("hessian");
    assert.equal(app.$("#variables").value,"x,y");
  } finally {app.close();}
});

test("variable palettes contain only letters and the backspace symbol",()=>{
  const app=workspace();
  try {
    for (const category of ["integral","derivative","analysis"]) {
      app.chooseType(category);
      if (category==="derivative") app.change("partial");
      const labels=[...app.$('[data-for="variables"]').querySelectorAll("button")].map(button=>button.textContent);
      assert.ok(labels.every(label=>/^[A-Za-zαβθ⌫]+$/.test(label)),labels.join(","));
      assert.ok(!labels.includes("力")&&!labels.includes("温度"));
    }
    app.chooseType("matrix");
    assert.equal(app.$('#operation option[value="solve"]'),null);
  } finally {app.close();}
});

test("equation examples stay in their selected mode and submit only the single document",async()=>{
  const app=workspace();
  try {
    app.$('[data-category="equations"]').click();
    app.change("equation_integral");
    app.$('[data-example="0"]').click();
    assert.equal(app.$("#operation").value,"equation_integral");
    assert.equal(app.$("#expression").value,"y(x)=1+integrate(y(t),t,0,x)");
    app.$("#calculate-button").click();
    await new Promise(setImmediate);
    assert.equal(app.requests.length,1);
    assert.equal(app.requests[0].operation,"equation_integral");
    assert.equal(app.requests[0].category,"equations");
    assert.ok(!Object.hasOwn(app.requests[0],"substitutions"));
    assert.ok(!Object.hasOwn(app.requests[0],"variables"));
    assert.equal(app.$("#copy-result").hidden,false);
  } finally {app.close();}
});

test("matrix form discovers factors, keeps entered matrices, and submits the chosen unknown",async()=>{
  const app = workspace();
  try {
    assert.equal(app.window.document.documentElement.lang,"en");
    assert.deepEqual([...app.$("#precision").options].map(option => option.value),["2","3","4","6","31"]);
    app.$('[data-category="equations"]').click();
    app.change("equation_matrix");
    const formula = app.$("#matrix-equation");
    const type = text => {
      formula.value = text;
      formula.dispatchEvent(new app.window.Event("input",{bubbles:true}));
    };
    type("ABC=D");
    const unknown = app.$("#matrix-equation-unknown");
    assert.deepEqual([...unknown.options].map(option => option.value),["","A","B","C","D"]);
    unknown.value = "B";
    unknown.dispatchEvent(new app.window.Event("change",{bubbles:true}));
    app.$("#matrix-equation-A").value = "1, 2\n0, 1";
    type("A×B×C=D");
    assert.equal(app.$("#matrix-equation-A").value,"1, 2\n0, 1");
    app.$('[data-example="0"]').click();
    assert.equal(app.$("#matrix-equation-unknown").value,"B");
    assert.equal(app.$("#matrix-equation-B"),null);
    assert.equal(app.$("#matrix-equation-D").value,"24, 10\n10, 4");
    app.$("#precision").value = "2";
    app.$("#calculate-button").click();
    await new Promise(setImmediate);
    const request = app.requests.at(-1);
    assert.equal(request.operation,"equation_matrix");
    assert.equal(request.precision,"2");
    assert.deepEqual(JSON.parse(request.matrixEquation),{
      equation:"ABC=D",unknown:"B",matrices:{A:"1, 2\n0, 1",C:"2, 0\n1, 1",D:"24, 10\n10, 4"}
    });
  } finally {app.close();}
});

test("legacy AX=B history restores in the matrix equation form",()=>{
  const entry={category:"matrix",data:{operation:"solve",matrixA:"1,0\n0,1",matrixB:"2\n3",precision:"12"},
    result:{ok:true,items:[{label:"result",text:"2",latex:"2"}],notes:[]},time:1};
  const app=workspace({history:[entry]});
  try {
    app.$(".history-entry").click();
    assert.equal(app.$("#operation").value,"equation_matrix");
    assert.equal(app.$("#matrix-equation").value,"A*X=B");
    assert.equal(app.$("#matrix-equation-unknown").value,"X");
    assert.equal(app.$("#matrix-equation-B").value,"2\n3");
    assert.equal(app.$("#precision").value,"6");
  } finally {app.close();}
});

test("calculus buttons wrap the chosen expression and retain cursor behavior",()=>{
  const app=workspace();
  try {
    app.$('[data-category="equations"]').click();
    app.change("equation_auto");
    app.$("#expression").value="x^3";
    app.$("#expression").setSelectionRange(0,3);
    app.$('[data-for="expression"] details').open=true;
    app.$('[data-for="expression"] [data-insert="diff(,x)"]').click();
    assert.equal(app.$("#expression").value,"diff(x^3,x)");
  } finally {app.close();}
});

test("each calculation type shows its own operators and examples",()=>{
  const app=workspace();
  try {
    assert.equal(app.$(".operator-buttons"),null);
    for (const [category,own,other] of [["integral","∫","∂"],["derivative","∂","∫"],["analysis","lim","∑"],["series","∑","lim"],["determinant","det","∑"]]) {
      app.chooseType(category);
      assert.ok(app.$(`[data-operator="${own}"]`));
      assert.equal(app.$(`[data-operator="${other}"]`),null);
      assert.ok(app.$("#examples").querySelectorAll("button").length>=3);
    }
    app.$('[data-category="equations"]').click();
    for (const symbol of ["∫","∂","df","lim","∑","Tₙ","det"]) assert.ok(app.$(`[data-operator="${symbol}"]`));
    assert.equal(app.$('[data-operator="[A]"]'),null);
    assert.ok(app.$('#operation option[value="equation_ode"]'));
    assert.ok(app.$('#operation option[value="equation_integral"]'));
  } finally {app.close();}
});

test("each preset fills the math input and every field visible for its operation",()=>{
  const app = workspace();
  try {
    const categories = [...app.$("#calculation-type").options].map(option => option.value);
    for (const category of categories) {
      app.chooseType(category);
      const operations = [...app.$("#operation").options].map(option => option.value);
      for (const operation of operations) {
        app.change(operation);
        for (const field of app.window.document.querySelectorAll("#tool-fields input, #tool-fields textarea")) field.value = "stale";
        app.$('[data-example="0"]').click();
        assert.equal(app.$("#operation").value,operation);
        for (const field of app.window.document.querySelectorAll("#tool-fields input, #tool-fields textarea")) {
          assert.ok(field.value && field.value !== "stale",`${category}/${operation} did not fill ${field.name}`);
        }
      }
    }
  } finally {app.close();}
});

test("triangle example loads and submits the displayed integrand and inner-to-outer bounds",async()=>{
  const app = workspace();
  try {
    app.chooseType("integral");
    app.change("multiple");
    const bounds = "x,0,y\ny,0,1";
    assert.equal(app.$('[data-example="0"] code').textContent,bounds);
    app.$("#bounds").value = "y,0,x\n1,0,y";
    app.$('[data-example="0"]').click();
    assert.equal(app.$("#expression").value,"x+y");
    assert.equal(app.$("#bounds").value,bounds);
    app.$("#calculate-button").click();
    await new Promise(setImmediate);
    assert.equal(app.requests.at(-1).bounds,bounds);
  } finally {app.close();}
});

test("guide opens to the current category and names each function before its signature",()=>{
  const app = workspace();
  try {
    app.setLanguage("zh");
    app.chooseType("integral");
    const types = [...app.$("#calculation-type").options].map(option => option.textContent);
    assert.ok(types.includes("积分") && types.includes("矩阵"));
    app.$("#help-dialog").showModal = () => { app.$("#help-dialog").open = true; };
    app.$("#help-sidebar").click();
    const select = app.$("#help-category");
    assert.equal(select.value,"integral");
    const indefinite = app.$("#help-content section");
    assert.equal(indefinite.firstElementChild.textContent,"不定积分");
    assert.match(indefinite.querySelector("code").textContent,/∫\(f,x\)/u);
    assert.match(indefinite.querySelector("p").textContent,/被积函数 f 按变量 x/u);
    select.value = "common";
    select.dispatchEvent(new app.window.Event("change"));
    assert.match(app.$("#help-content").textContent,/四象限反正切/u);
    app.setLanguage("en");
    assert.equal(select.value,"common");
    assert.match(app.$("#help-content").textContent,/atan2\(y,x\)/u);
  } finally {app.close();}
});

test("old calculus equation histories reopen in the unified equation workspace",()=>{
  const cases=[
    ["equation_integral","y(x)=1+integrate(y(t),t,0,x)","integral"],
    ["equation_ode","diff(y(x),x)=y(x)","derivative"],
    ["equation_auto","limit(sin(a*x)/x,x,0)=2","analysis"],
    ["equation_numeric","integrate(exp(t),t,0,x)=2\nguess: 1","integral"],
  ];
  for (const [operation,expression,destination] of cases) {
    const history=[{category:"calculate",data:{operation,expression},result:{ok:true,items:[{label:"result",text:"1",latex:"1"}],notes:[]},time:1}];
    const app=workspace({history});
    try {
      app.$(".history-entry").click();
      assert.ok(app.$('[data-category="equations"]').classList.contains("active"));
      assert.equal(app.$("#operation").value,operation);
      assert.equal(app.$("#expression").value,expression);
    } finally {app.close();}
  }
});

test("old equation histories and bookmarks open in the equation workspace",()=>{
  const entry={category:"equations",data:{operation:"numeric",equations:"cos(x)=x",variables:"x",guesses:"1",domain:"real"},result:{ok:true,items:[{label:"x",text:"0.739",latex:"0.739"}],notes:[]},time:1};
  const app=workspace({history:[entry],hash:"#equations"});
  try {
    assert.equal(app.$("#operation").value,"equation_auto");
    app.$(".history-entry").click();
    assert.equal(app.$("#operation").value,"equation_numeric");
    assert.equal(app.$("#expression").value,"cos(x)=x\nvars: x\nguess: 1\ndomain: real");
    assert.equal(app.$("#copy-result").hidden,false);
  } finally {app.close();}
});

test("old substitution history is moved into the same expression without being lost",()=>{
  const entry={category:"calculate",data:{operation:"evaluate",expression:"x^2",substitutions:"x=2",precision:"20",assumption:"real"},result:{ok:true,items:[{label:"result",text:"4",latex:"4"}],notes:[]},time:1};
  const app=workspace({history:[entry]});
  try {
    app.$(".history-entry").click();
    assert.equal(app.$("#expression").value,"x^2\nx=2\ndigits: 20\nassume: real");
    assert.equal(app.$("#substitutions"),null);
  } finally {app.close();}
});

test("matrix operations preserve their input and swap actions",()=>{
  const app=workspace();
  try {
    app.chooseType("matrix");
    app.$("#matrixA").value="1,2\n3,4";
    app.$("#matrixB").value="5,6\n7,8";
    app.$("#swap-matrices").click();
    app.change("add");
    assert.equal(app.$("#matrixA").value,"5,6\n7,8");
    assert.equal(app.$("#matrixB").value,"1,2\n3,4");
  } finally {app.close();}
});

test("primary integral and derivative symbols are visible and wrap the function once",async()=>{
  const app=workspace();
  try {
    app.chooseType("integral");
    app.$("#variables").value="t";
    app.$("#expression").value="t^2";
    app.$("#expression").setSelectionRange(3,3);
    const integral=app.$('.operator-buttons [data-operator="∫"]');
    assert.ok(integral && !integral.closest("details"));
    integral.click();
    assert.equal(app.$("#operation").value,"formula");
    assert.equal(app.$("#expression").value,"∫(t^2,t)");
    assert.equal(app.$("#variables"),null);
    app.$("#calculate-button").click();
    await new Promise(setImmediate);
    assert.equal(app.requests.at(-1).operation,"formula");
    app.chooseType("derivative");
    app.$("#expression").value="x^3";
    app.$('.operator-buttons [data-operator="∂"]').click();
    assert.equal(app.$("#operation").value,"formula");
    assert.equal(app.$("#expression").value,"∂(x^3,x)");
  } finally {app.close();}
});

test("definite integral symbol uses the currently edited bounds",()=>{
  const app=workspace();
  try {
    app.chooseType("integral");
    app.change("definite");
    app.$("#expression").value="x";
    app.$("#lower").value="1";
    app.$("#upper").value="3";
    app.$('.operator-buttons [data-operator="∫ₐᵇ"]').click();
    assert.equal(app.$("#expression").value,"∫(x,x,1,3)");
  } finally {app.close();}
});

test("limit and series symbols appear in separate calculation categories",()=>{
  const app=workspace();
  try {
    app.chooseType("analysis");
    assert.ok(app.$('.operator-buttons [data-operator="lim"]'));
    assert.equal(app.$('#operation option[value="series"]'),null);
    app.chooseType("series");
    for (const name of ["∑","∑∞","Tₙ"]) assert.ok(app.$(`.operator-buttons [data-operator="${name}"]`));
    assert.equal(app.$('.operator-buttons [data-operator="lim"]'),null);
    assert.equal(app.$('#operation option[value="limit"]'),null);
    app.$('.operator-buttons [data-operator="∑∞"]').click();
    assert.equal(app.$("#operation").value,"formula");
    assert.equal(app.$("#expression").value,"∑(,n,1,oo)");
    assert.equal(app.$("#expression").selectionStart,2);
    app.$("#reset-form").click();
    assert.equal(app.$("#operation").value,"series");
    assert.equal(app.$("#examples").querySelectorAll("button").length,3);
  } finally {app.close();}
});

test("older determinant and series history opens in the corresponding calculation category",()=>{
  const result = {ok:true,items:[{label:"result",text:"1",latex:"1"}],notes:[]};
  for (const [category, data, destination] of [
    ["matrix", {operation:"det", matrixA:"1,0\n0,1"}, "determinant"],
    ["analysis", {operation:"summation", expression:"1/n", variables:"n"}, "series"],
    ["analysis", {operation:"formula", expression:"∑(n,n,0,1)"}, "series"],
    ["analysis", {operation:"formula", expression:"lim(x,x,1)"}, "analysis"],
  ]) {
    const app = workspace({history:[{category, data, result, time:1}]});
    try {
      app.$(".history-entry").click();
      assert.equal(app.$("#calculation-type").value,destination);
      assert.equal(app.$("#operation").value,data.operation);
    } finally {app.close();}
  }
});

test("series expansion and series summation have separate working entries",()=>{
  const app=workspace();
  try {
    app.chooseType("series");
    assert.ok(app.$('#operation option[value="series"]').textContent.includes("expansion"));
    assert.ok(app.$('#operation option[value="summation"]').textContent.includes("summation"));
    app.change("summation");
    assert.equal(app.$("#variables").value,"n");
    assert.ok(app.$("#lower")&&app.$("#upper"));
    app.$('[data-example="1"]').click();
    assert.equal(app.$("#operation").value,"summation");
    assert.equal(app.$("#expression").value,"1/n^2");
    assert.equal(app.$("#upper").value,"oo");
    app.change("series");
    assert.equal(app.$("#variables").value,"x");
    assert.ok(app.$("#order"));
  } finally {app.close();}
});

test("operator insertion within equation mode keeps the equation solver",()=>{
  const app=workspace();
  try {
    app.$('[data-category="equations"]').click();
    app.change("equation_auto");
    app.$("#expression").value="x^3=12";
    app.$("#expression").setSelectionRange(0,3);
    app.$('.operator-buttons [data-operator="∂"]').click();
    assert.equal(app.$("#operation").value,"equation_auto");
    assert.equal(app.$("#expression").value,"∂(x^3,x)=12");
  } finally {app.close();}
});

test("language changes immediately, preserves drafts, and persists",()=>{
  const app=workspace();
  try {
    assert.equal(app.window.document.documentElement.lang,"en");
    assert.equal(app.$("#page-title").textContent,"Calculations");
    app.chooseType("integral");
    const first=app.$("#expression").placeholder;
    app.change("definite");
    assert.notEqual(app.$("#expression").placeholder,first);
    app.$("#expression").value="x^2";
    app.setLanguage("zh");
    assert.equal(app.window.document.documentElement.lang,"zh-CN");
    assert.equal(app.$("#page-title").textContent,"计算");
    assert.equal(app.$("#operation").selectedOptions[0].textContent,"定积分");
    assert.equal(app.$("#expression").value,"x^2");
    assert.equal(app.window.localStorage.getItem("shuyan-language"),'"zh"');
    app.setLanguage("en");
    assert.equal(app.$("#operation").selectedOptions[0].textContent,"Definite integral");
  } finally {app.close();}
});

test("determinants have a separate category and still insert into an equation",()=>{
  const app=workspace();
  try {
    app.chooseType("matrix");
    assert.equal(app.$('#operation option[value="det"]'),null);
    const matrix = app.$('#calculation-type option[value="matrix"]');
    assert.equal(matrix.previousElementSibling.value,"determinant");
    app.chooseType("determinant");
    assert.equal(app.$("#operation").selectedOptions[0].textContent,"Evaluate a determinant");
    app.$('[data-example="0"]').click();
    assert.equal(app.$("#matrixA").value,"a, 2\n3, a");
    assert.equal(app.$("#matrixB"),null);
    app.change("expand_column");
    assert.ok(app.$("#column"));
    assert.equal(app.$("#row"),null);
    app.change("product");
    assert.ok(app.$("#matrixB"));
    app.$('[data-category="equations"]').click();
    const input=app.$("#expression");
    input.value="x=2";
    input.setSelectionRange(0,1);
    app.$('[data-operator="det"]').click();
    assert.equal(input.value,"det([x,2],[3,4])=2");
  } finally {app.close();}
});
