"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const defaultPrecision = "6";
const precisionOptions = new Set([...$("#precision").options].map(option => option.value));
const storage = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private mode or full storage. */ } },
};

const tools = {
  calculate: {
    name: "科学计算", art: "f(x)",
    operations: [["evaluate","表达式计算"],["simplify","符号化简"],["expand","展开"],["factor","因式分解"],["cancel","分式约分"],["trigsimp","三角化简"]],
    defaults: {expression:"", operation:"evaluate", angle:"rad"},
  },
  determinant: {
    name:"行列式", art:"| A |",
    operations:[["det","计算行列式"],["minor","余子式"],["cofactor","代数余子式"],["expand_row","按行展开"],["expand_column","按列展开"],["transpose","转置的行列式"],["product","乘积的行列式"],["scale","数乘的行列式"],["power","矩阵幂的行列式"],["inverse","逆矩阵的行列式"],["formula","行列式表达式"]],
    defaults:{operation:"det",matrixA:"",matrixB:"",expression:"",scalar:"2",power:"2",row:"1",column:"1"},
  },
  matrix: {
    name:"矩阵", art:"[ A ]",
    operations:[["add","A + B"],["subtract","A − B"],["multiply","A × B"],["divide","A · B⁻¹"],["scale","数乘"],["power","矩阵幂"],["inverse","逆矩阵"],["transpose","转置"],["adjoint","共轭转置"],["rank","秩"],["trace","迹"],["rref","行最简形"],["eigen","特征分析"],["charpoly","特征多项式"],["nullspace","零空间"],["lu","LU 分解"],["hadamard","逐元素乘"]],
    defaults:{operation:"multiply",matrixA:"",matrixB:"",scalar:"2",power:"2"},
  },
  integral:{
    name:"积分", art:"∫ f dx",
    operations:[["indefinite","不定积分"],["definite","定积分"],["multiple","多重积分"],["formula","符号表达式计算（∫）"]],
    defaults:{operation:"indefinite",expression:"",variables:"x",lower:"0",upper:"1",bounds:""},
  },
  derivative:{
    name:"微分与求导", art:"∂f / ∂x",
    operations:[["differentiate","普通 / 高阶导数"],["partial","混合偏导"],["differential","全微分"],["gradient","梯度"],["hessian","Hessian 矩阵"],["formula","符号表达式计算（∂）"]],
    defaults:{operation:"differentiate",expression:"",variables:"x",order:"1",substitutions:""},
  },
  analysis:{
    name:"极限", art:"lim f(x)",
    operations:[["limit","函数极限"],["formula","极限表达式"]],
    defaults:{operation:"limit",expression:"",variables:"x",point:"0",direction:"+-"},
  },
  series:{
    name:"级数", art:"∑ aₙ",
    operations:[["series","级数展开（Taylor / Laurent）"],["summation","级数求和（有限 / 无穷）"],["formula","级数表达式"]],
    defaults:{operation:"series",expression:"",variables:"x",point:"0",order:"6",lower:"1",upper:"10"},
  },
  equations:{
    name:"方程", art:"Ax = b",
    operations:[["equation_auto","自动求解"],["equation_solve","单变量符号求根"],["equation_linear","线性方程组"],["equation_system","非线性方程组"],["equation_numeric","数值求根"],["equation_matrix","矩阵方程"],["equation_ode","常微分方程"],["equation_integral","积分方程（Volterra 型）"]],
    defaults:{operation:"equation_auto",expression:""},
  },
};

function currentExamples() {
  const groups = calculationExamples[category];
  const operation = drafts[category].operation;
  const withOperation = (key, examples) => examples.map(example => ({...example, data: {...example.data, operation:key}}));
  const selected = withOperation(operation, groups[operation]);
  const related = Object.keys(groups).filter(key => key !== operation).map(key => [key,groups[key]])
    .flatMap(([key, examples]) => withOperation(key, examples));
  return [...selected, ...related].slice(0, Math.max(3, selected.length));
}

function migrateEntry(entry) {
  if (!entry?.data) return entry;
  const data = {...entry.data};
  let destination = entry.category;
  if (entry.category === "equations" || String(data.operation).startsWith("equation_")) {
    destination = "equations";
    if (!String(data.operation).startsWith("equation_")) data.operation = "equation_" + (data.operation || "auto");
    if (data.equations) {
      const settings = [];
      if (data.variables) settings.push("vars: " + data.variables);
      if (data.guesses && data.operation === "equation_numeric") settings.push("guess: " + data.guesses);
      if (data.domain) settings.push("domain: " + data.domain);
      data.expression = [data.equations, ...settings].join("\n");
    }
  } else if (destination === "calculate" && data.substitutions) {
    const lines = [data.expression, data.substitutions];
    if (data.precision && String(data.precision) !== "12") lines.push("digits: " + data.precision);
    if (data.assumption && data.assumption !== "complex") lines.push("assume: " + data.assumption);
    data.expression = lines.join("\n");
    delete data.substitutions;
  } else if (destination === "matrix" && data.operation === "det") {
    destination = "determinant";
  } else if (destination === "matrix" && data.operation === "solve") {
    destination = "equations";
    data.operation = "equation_matrix";
    data.matrixEquation = JSON.stringify({equation:"A*X=B", unknown:"X", matrices:{A:data.matrixA, B:data.matrixB}});
  } else if (destination === "analysis") {
    const label = entry.result?.items?.[0]?.label || "";
    const seriesOperation = ["series","summation"].includes(data.operation);
    const seriesFormula = data.operation === "formula" && (/^(级数|截断级数)/u.test(label) || /^\s*(?:sum|series|trunc|[∑Σ]|求和|级数|截断级数)/u.test(data.expression || ""));
    if (seriesOperation || seriesFormula) destination = "series";
  }
  if (destination === "equations") {
    if (!tools.equations.operations.some(([value]) => value === data.operation)) data.operation = "equation_auto";
    for (const key of ["equations","variables","guesses","domain","substitutions"]) delete data[key];
  }
  data.category = destination;
  return {...entry, category: destination, data};
}

const initialRoute = location.hash.slice(1);
let category = Object.hasOwn(tools, initialRoute) ? initialRoute : "calculate";
let utilityPage = null;
let lastCalculation = category === "equations" ? "calculate" : category;
const drafts = Object.fromEntries(Object.entries(tools).map(([name, tool]) => [name, {...tool.defaults}]));
let matrixEquationDraft = {equation:"", unknown:"", matrices:{}};
let history = storage.get("shuyan-history-v1", []);
if (!Array.isArray(history)) history = [];
history = history.map(migrateEntry).filter(entry => entry && Object.hasOwn(tools, entry.category) && entry.data && Array.isArray(entry.result?.items)).slice(0,20);
let latestResult = null;
let busy = false;
let revision = 0;
let toastTimer;
let serviceState = "connecting";

function toast(message) {
  $("#toast").textContent = tr(message);
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").hidden = true, 2200);
}
function closeNavigation() {
  $("#sidebar").classList.remove("open");
  $("#mobile-menu").setAttribute("aria-expanded","false");
}
function math(element, latex, displayMode=false) {
  if (window.katex) {
    try { window.katex.render(latex, element, {displayMode, throwOnError:false, trust:false, strict:"ignore", maxExpand:800, maxSize:40}); return; } catch { /* Text fallback. */ }
  }
  element.textContent = latex;
}
function input(name, label, value="", options={}) {
  return `<div class="field"><label class="field-label" for="${name}">${escapeHTML(tr(label))}</label><input id="${name}" name="${name}" value="${escapeHTML(value)}" type="text" ${options.type==="number" ? 'inputmode="numeric"' : ""} class="mono" placeholder="${escapeHTML(options.placeholder || "")}" autocomplete="off" spellcheck="false"></div>`;
}
function select(name,label,values,value) {
  return `<div class="field"><label class="field-label" for="${name}">${tr(label)}</label><select id="${name}" name="${name}">${values.map(([key,text])=>`<option value="${key}" ${key===value ? "selected" : ""}>${tr(text)}</option>`).join("")}</select></div>`;
}
function expression(d, label, example) {
  const angle = category === "calculate" ? `<span class="angle-switch" aria-label="${tr("三角函数角度单位")}">${["rad","deg"].map(unit=>`<button type="button" data-angle="${unit}" class="${d.angle===unit ? "active" : ""}" aria-pressed="${d.angle===unit}">${unit.toUpperCase()}</button>`).join("")}</span>` : "";
  return `<div class="field"><div class="field-label"><label id="expression-label" for="expression">${tr(label)}</label><span class="formula-heading-actions">${angle}<button type="button" class="text-button" data-formula-builder="expression">${tr("插入公式模板")}</button></span></div><textarea id="expression" name="expression" class="expression-input" placeholder="${escapeHTML(example)}" rows="${category === "equations" ? 5 : 3}" spellcheck="false" autocomplete="off">${escapeHTML(d.expression)}</textarea></div>`;
}
function keypad(target, kind="math", compact=false) {
  const common = [["x²","^2"],["xʸ","^"],["√","sqrt()"],["exp","exp()"],["ln","ln()"],["logₐ","log(,2)"],["(","("],[")",")"],["sin","sin()"],["cos","cos()"],["tan","tan()"],["π","pi"],["e","e"],["|x|","abs()"],["÷","/"],["×","*"],["+","+"],["−","-"],["∞","oo"],["I","I"],["x","x"],["y","y"],["z","z"],["ⁿ√","root(,3)"]];
  const extra = [["asin","asin()"],["acos","acos()"],["atan","atan()"],["atan2","atan2(,1)"],["sinh","sinh()"],["cosh","cosh()"],["tanh","tanh()"],["sec","sec()"],["csc","csc()"],["cot","cot()"],["asinh","asinh()"],["acosh","acosh()"],["atanh","atanh()"],["n!","factorial()"],["log₁₀","log10()"],["gamma","gamma()"],["erf","erf()"],["floor","floor()"],["ceil","ceil()"],["conj","conjugate()"],["sign","sign()"],["re","re()"],["im","im()"]];
  const names = ["x","y","z","a","b","c","u","v","w","α","β","θ"].map(letter=>[letter,letter]);
  if (category==="equations") extra.push(["at","at(,x,0)"],["f(x)","f()"],["y(x)","y()"]);
  common.splice(8,0,["[","["],["]","]"],["{","{"],["}","}"]);
  const structure = [[",",","],[";",";"],["=","="],["( )","()"],["[ ]","[]"],["{ }","{}"]];
  if (["matrixA","matrixB","bounds"].includes(target) || target.startsWith("matrix-equation-") || (["calculate","equations"].includes(category) && target==="expression")) structure.push(["换行","\n"]);
  const buttons = (entries) => entries.map(([label,value])=>`<button type="button" data-insert="${escapeHTML(value)}" data-target="${target}" aria-label="${tr("插入")} ${escapeHTML(tr(label))}" title="${escapeHTML(value)}" class="${value.includes("(") ? "accent-key" : ""}">${escapeHTML(tr(label))}</button>`).join("");
  const digits = ["1","2","3","4","5","6","7","8","9","0","−"].map(v=>[v,v==="−" ? "-" : v]);
  let visible = kind === "integer" ? digits : kind === "symbol" || kind === "variables" ? names : common;
  let more = kind === "math" ? extra : [];
  if (compact && kind === "math") { visible = common.slice(0,6); more = [...common.slice(6),...extra]; }
  const fieldLabel = document.querySelector(`label[for="${target}"]`).textContent.trim();
  const backspace = `<button type="button" data-edit="backspace" data-target="${target}" aria-label="${tr("退格")}">⌫</button>`;
  const options = kind === "math" ? `<details class="more-math"><summary>${tr("更多函数与符号")}</summary><div class="keypad">${buttons(more)}</div></details>` : "";
  const hasOperators = target === "expression" || category === "determinant" && ["matrixA","matrixB"].includes(target);
  return `<div class="math-keypad" data-for="${target}" role="group" aria-label="${escapeHTML(fieldLabel)} ${tr("输入按钮")}">${hasOperators ? operatorButtons(target) : ""}<div class="keypad">${buttons(visible)}</div><div class="keypad-structure">${kind === "math" ? buttons(structure) : ""}${backspace}</div>${options}</div>`;
}
function operatorTemplates() {
  const d=drafts[category];
  const candidate=String(d.variables || "x").normalize("NFKC").trim();
  const variable=/^[\p{L}][\p{L}\p{N}_]{0,23}$/u.test(candidate) ? candidate : "x";
  const index=d.operation==="summation" ? variable : "n";
  const presets={
    integral:[["∫",`∫(,${variable})`,"不定积分"],["∫ₐᵇ",`∫(,${variable},${d.lower || "0"},${d.upper || "1"})`,"定积分"]],
    derivative:[["d/dx",`diff(,${variable})`,"一阶导数"],["∂",`∂(,${variable})`,"偏导数"],["∂²",`∂(,${variable},2)`,"二阶偏导数"],["df","totaldiff(,x,y)","全微分"]],
    analysis:[["lim",`lim(,${variable},${d.point || "0"})`,"极限"]],
    series:[["∑",`∑(,${index},${d.lower || "1"},${d.upper || "10"})`,"有限级数求和"],["∑∞",`∑(,${index},${d.lower || "1"},oo)`,"无穷级数求和"],["Tₙ",`series(,${variable},${d.point || "0"},${d.order || "6"})`,"级数展开"]],
    determinant:[["det","det([□,2],[3,4])","行列式"]],
  };
  if (category === "equations") {
    return [
      ["∫", "∫(,t,0,x)", "定积分"],
      ...presets.derivative,
      ...presets.analysis,
      ...presets.series.filter(([label]) => label !== "Tₙ"),
      ["Tₙ", "trunc(,x,0,6)", "截断级数"],
      ...presets.determinant,
    ];
  }
  return presets[category] || [];
}
function operatorButtons(target) {
  const presets=operatorTemplates();
  if (!presets.length) return "";
  return `<div class="operator-buttons" role="group" aria-label="${tr("常用运算符")}">${presets.map(([label,value,title])=>`<button type="button" class="operator-button" data-formula="true" data-operator="${escapeHTML(label)}" data-target="${target}" data-insert="${escapeHTML(value)}" aria-label="${tr("插入")} ${label}" title="${tr(title)}"><span>${label}</span><small>${tr(title)}</small></button>`).join("")}</div>`;
}
function installKeypads(root = $("#tool-fields")) {
  for (const field of root.querySelectorAll("input, textarea")) {
    let kind = field.inputMode === "numeric" ? "integer" : "math";
    if (field.name === "variables") {
      kind = ["integral","analysis","series"].includes(category) || (category==="derivative" && drafts[category].operation==="differentiate") ? "symbol" : "variables";
    }
    const markup = keypad(field.id,kind,["lower","upper","point","scalar","guesses"].includes(field.id));
    field.insertAdjacentHTML("afterend", field.dataset.matrixFactor
      ? `<details class="matrix-factor-keys"><summary>${tr("输入按钮")}</summary>${markup}</details>` : markup);
  }
}
function operations(d) {
  const operation = select("operation", category === "equations" ? "求解方式" : "具体运算", tools[category].operations,d.operation);
  if (category === "equations") return operation;
  const types = Object.entries(tools).filter(([key]) => key !== "equations").map(([key, tool]) => [key,tool.name]);
  return `<div class="field-grid operation-selects">${select("calculation-type","运算类别",types,category)}${operation}</div>`;
}
function collect() {
  const data = {...drafts[category]};
  if ($("#matrix-equation")) collectMatrixEquation();
  for (const [name,value] of new FormData($("#calculation-form"))) if (name !== "calculation-type" && !name.startsWith("matrix-equation")) data[name] = value;
  if (category==="calculate") { delete data.substitutions; data.precision=defaultPrecision; data.assumption="complex"; }
  drafts[category] = data;
  if (category === "equations" && data.operation === "equation_matrix") {
    const {equation, unknown, matrices} = matrixEquationDraft;
    const names = matrixEquationNames(equation);
    const selected = Object.fromEntries(names.filter(name => name !== unknown).map(name => [name, matrices[name] || ""]));
    return {category, operation:data.operation, precision:data.precision, assumption:data.assumption,
      matrixEquation:JSON.stringify({equation, unknown, matrices:selected})};
  }
  const request={...data,category};
  if (category==="equations") for (const key of ["variables","substitutions","bounds","lower","upper","order","point"]) delete request[key];
  return request;
}
function resetResult() {
  latestResult = null;
  $("#copy-result").hidden = true;
  $("#send-result-graph").hidden = true;
  $("#elapsed").textContent = "";
  $("#result-content").innerHTML = `<div class="empty-result"><p>${tr("在这里查看结果")}</p></div>`;
}
function matrixEquationNames(equation) {
  const sides = equation.normalize("NFKC").replace(/[×✕·⋅∗]/g,"*").replace(/\s+/g,"").split("=");
  if (sides.length !== 2 || sides.some(side => !/^[A-Za-z]+(?:\*[A-Za-z]+)*$/.test(side))) return [];
  const products = sides.map(side => side.replaceAll("*",""));
  return products.some(side => side.length > 9) ? [] : [...products.join("")];
}
function collectMatrixEquation() {
  matrixEquationDraft.equation = $("#matrix-equation").value;
  if ($("#matrix-equation-unknown")) matrixEquationDraft.unknown = $("#matrix-equation-unknown").value;
  for (const field of $$("[data-matrix-factor]")) matrixEquationDraft.matrices[field.dataset.matrixFactor] = field.value;
}
function readMatrixEquation(payload) {
  try {
    const {equation, unknown, matrices} = JSON.parse(payload);
    if (typeof equation === "string" && typeof unknown === "string" && matrices && typeof matrices === "object") {
      return {equation, unknown, matrices};
    }
  } catch { /* A stale history entry may not have a matrix form. */ }
  return null;
}
function renderMatrixEquationDetails() {
  const container = $("#matrix-equation-details");
  const names = matrixEquationNames(matrixEquationDraft.equation);
  const unique = [...new Set(names)];
  const candidates = unique.filter(name => names.indexOf(name) === names.lastIndexOf(name));
  if (!names.length || !candidates.length) {
    container.innerHTML = `<p class="field-hint">${tr(names.length ? "未知矩阵须只出现一次。" : "每侧可使用 1～9 个矩阵。")}</p>`;
    return;
  }
  const options = [["","选择未知矩阵"], ...candidates.map(name => [name,name])];
  const unknown = candidates.includes(matrixEquationDraft.unknown) ? matrixEquationDraft.unknown : "";
  container.innerHTML = select("matrix-equation-unknown","未知矩阵",options,unknown);
  if (!unknown) return;
  container.innerHTML += `<p class="field-hint">${tr("填写其余已知矩阵，同行用逗号分列，每行一个矩阵行。")}</p><div class="matrix-equation-fields">${unique.filter(name => name !== unknown).map(name => {
    const id = "matrix-equation-" + name;
    return `<div class="field"><label class="field-label" for="${id}">${tr("矩阵")} ${name}</label><textarea id="${id}" name="${id}" data-matrix-factor="${name}" class="mono" rows="2" placeholder="1, 0&#10;0, 1" spellcheck="false">${escapeHTML(matrixEquationDraft.matrices[name])}</textarea></div>`;
  }).join("")}</div>`;
  installKeypads(container);
}
function renderFields() {
  const draft = drafts[category];
  const example = currentExamples()[0].data;
  let html = operations(draft);
  const matrixEquation = category === "equations" && draft.operation === "equation_matrix";
  const determinant = category === "determinant";
  if (matrixEquation) {
    html += input("matrix-equation","矩阵方程",matrixEquationDraft.equation,{placeholder:example.expression});
    html += `<p class="field-hint">${tr("用单个字母表示矩阵，乘积可写成 A*X*B=D 或 AXB=D。")}</p><div id="matrix-equation-details"></div>`;
  } else if (category === "matrix" || (determinant && draft.operation !== "formula")) {
    const needsB = ["add","subtract","multiply","divide","hadamard","product"].includes(draft.operation);
    const letters = needsB ? ["A","B"] : ["A"];
    html += '<div class="matrix-fields ' + (needsB ? "" : "single") + '">' + letters.map(letter => {
      const id = "matrix" + letter;
      return `<div class="field"><label class="field-label" for="${id}"><span>${tr((determinant ? "行列式 " : "矩阵 ") + letter)} <span class="matrix-size" id="size-${letter}"></span></span></label>
        <textarea id="${id}" name="${id}" class="mono" rows="4" spellcheck="false" placeholder="${escapeHTML(example[id])}">${escapeHTML(draft[id])}</textarea>
        <div class="matrix-controls"><span>${tr("填入")}</span><button type="button" class="small-chip" data-template="2" data-matrix="${letter}">2×2</button><button type="button" class="small-chip" data-template="3" data-matrix="${letter}">3×3</button>
        <button type="button" class="small-chip" data-template="identity" data-matrix="${letter}">${tr("单位阵")}</button>${letter === "B" ? `<button type="button" id="swap-matrices" class="swap-button">${tr("交换 A / B")}</button>` : ""}</div></div>`;
    }).join("") + "</div>";
    if (draft.operation === "scale") html += input("scalar","数乘系数 k",draft.scalar,{placeholder:example.scalar});
    if (draft.operation === "power") html += input("power","矩阵幂次 n",draft.power,{type:"number",placeholder:example.power});
    if (["minor","cofactor","expand_row","expand_column"].includes(draft.operation)) {
      const row = draft.operation !== "expand_column" ? input("row","行号",draft.row,{type:"number",placeholder:example.row}) : "";
      const column = draft.operation !== "expand_row" ? input("column","列号",draft.column,{type:"number",placeholder:example.column}) : "";
      html += row && column ? `<div class="field-grid">${row}${column}</div>` : row || column;
    }
  } else {
    const label = category === "equations" ? "方程输入" : draft.operation === "formula" ? "符号表达式" :
      category === "integral" ? "被积函数 f" : category === "derivative" ? "函数 f" :
      draft.operation === "summation" ? "级数通项 a(n)" : "数学表达式";
    html += expression(draft, label, example.expression);
    if (category === "equations") {
      const hint = bilingual("Enter one equation per line. Add vars: x,y to choose unknowns, or guess: 1,1 for numerical solving.", "每行输入一个方程。可用 vars: x,y 指定未知数，数值求解可用 guess: 1,1 指定初值。");
      html += `<p class="field-hint">${hint}</p>`;
    } else if (category === "integral" && draft.operation !== "formula") {
      if (draft.operation === "multiple") {
        html += `<div class="field"><label class="field-label" for="bounds">${tr("积分变量与上下限")}<span class="label-note">${tr("按内层到外层排列")}</span></label>
          <textarea id="bounds" name="bounds" class="mono" rows="3" spellcheck="false" aria-describedby="bounds-format" placeholder="${escapeHTML(example.bounds)}">${escapeHTML(draft.bounds)}</textarea>
          <p id="bounds-format" class="field-hint">${tr("每行依次填写积分变量、下限、上限，用逗号分隔。先写最内层积分。")}</p></div>`;
      } else {
        const variable = input("variables","积分变量",draft.variables,{placeholder:"x"});
        html += draft.operation === "definite" ? `<div class="field-grid three">${variable}${input("lower","积分下限",draft.lower)}${input("upper","积分上限",draft.upper)}</div>` : variable;
      }
    } else if (category === "derivative" && draft.operation !== "formula") {
      if (draft.operation === "differentiate") {
        html += `<div class="field-grid">${input("variables","求导变量",draft.variables)}${input("order","求导阶数",draft.order,{type:"number"})}</div>`;
      } else {
        const partial = draft.operation === "partial";
        html += input("variables",partial ? "混合偏导顺序" : "变量列表",draft.variables,{placeholder:partial ? "x:2,y:1" : "x,y"});
      }
      html += input("substitutions","在指定点处求值（可选）",draft.substitutions,{placeholder:example.substitutions});
    } else if (["analysis","series"].includes(category) && draft.operation !== "formula") {
      if (draft.operation === "summation") {
        html += input("variables","求和指标",draft.variables,{placeholder:"n"});
        html += `<div class="field-grid">${input("lower","求和下限",draft.lower,{placeholder:"1"})}${input("upper","求和上限",draft.upper,{placeholder:"10 / oo"})}</div>`;
      } else {
        const limit = draft.operation === "limit";
        html += `<div class="field-grid">${input("variables","变量",draft.variables)}${input("point",limit ? "趋近点" : "展开点",draft.point,{placeholder:"0 / oo"})}</div>`;
        html += limit ? select("direction","趋近方向",[["+-","双侧极限（比较左右极限）"],["-","左侧极限"],["+","右侧极限"]],draft.direction) : input("order","展开阶数（大 O 余项的阶数）",draft.order,{type:"number"});
      }
    }
  }
  $("#tool-fields").innerHTML = html;
  const science = category === "calculate";
  $("#input-card-heading").hidden = science;
  $("#advanced-settings").hidden = science;
  $("#precision").disabled = science;
  $("#assumption").disabled = science;
  if (!science) {
    $("#precision").value = precisionOptions.has(String(draft.precision)) ? draft.precision : defaultPrecision;
    $("#assumption").value = draft.assumption || "complex";
  }
  $("#input-card").setAttribute("aria-labelledby",science ? "expression-label" : "input-title");
  if (matrixEquation) renderMatrixEquationDetails();
  else installKeypads();
  updateMatrixSizes();
  updateCalculateLabel();
}
function updateMatrixSizes() {
  for (const letter of ["A","B"]) {
    const input = $("#matrix"+letter), label = $("#size-"+letter);
    if (!input || !label) continue;
    let text = input.value.normalize("NFKC").replace(/[【〔]/g,"[").replace(/[】〕]/g,"]").replaceAll("、",",").trim();
    if (text.startsWith("[[")) text = text.slice(2,-2).replace(/\]\s*,\s*\[/g,"\n");
    else if (text.startsWith("[") && text.endsWith("]")) text = text.slice(1,-1);
    const rows = text.split(/[;；\n]+/).filter(r=>r.trim());
    const cols = rows[0]?.replace(/\([^()]*\)/g,"fn").trim().split(/[,，\t]+|\s+/).filter(Boolean).length || 0;
    label.textContent = rows.length + " × " + cols;
  }
}
function renderSupport() {
  const examples = currentExamples();
  $("#examples").innerHTML = examples.map((example,index) => {
    const preview = !example.latex && (example.data.expression || example.data.matrixA);
    const label = example.label[language];
    const bounds = example.data.bounds ? `<span class="example-input-label">${tr("积分变量与上下限")}</span><code class="example-code">${escapeHTML(example.data.bounds)}</code>` : "";
    return `<button type="button" class="example-button" data-example="${index}"><span class="example-name">${escapeHTML(label)}<span aria-hidden="true">＋</span></span>${preview ? `<code class="example-code">${escapeHTML(preview)}</code>` : `<span class="example-formula" id="example-formula-${index}"></span>`}${bounds}</button>`;
  }).join("");
  examples.forEach((example,index) => { if (example.latex) math($("#example-formula-"+index),example.latex); });
  const tips = {
    calculate: [["幂运算","x^2 / x**2"],["平方根 / n 次根","sqrt(x) / root(x,n)"],["对数（底数为 a）","log(x,a)"]],
    determinant: [["分隔元素",bilingual("Comma or tab","逗号或 Tab")],["分隔行",bilingual("New line or semicolon","换行或分号")],["行列式表达式","det([1,2],[3,4])"],["行列号",bilingual("Start at 1","从 1 开始")]],
    matrix: [["分隔元素",bilingual("Comma or tab","逗号或 Tab")],["分隔行",bilingual("New line or semicolon","换行或分号")],["矩阵最大尺寸","8 × 8"]],
    integral: [["不定积分","∫(f,x)"],["定积分","∫(f,x,a,b)"],["无穷积分限","oo / -oo"],["多重积分顺序",tr("按内层到外层排列")]],
    derivative: [["n 阶导数","diff(f,x,n)"],["混合偏导","x:2,y:1"],["梯度 / 全微分变量","x,y,z"],["在点处求值","x=1"]],
    analysis: [["极限","lim(f,x,a)"],["极限方向","-1 / 1"],["趋近无穷","oo / -oo"]],
    series: [["级数展开","series(f,x,a,n)"],["有限 / 无穷上限",bilingual("Integer / oo","整数 / oo")],["求和符号","∑(a(n),n,1,oo)"]],
    equations: [["指定未知数","vars: x,y"],["数值初值","guess: 1,1"],["行列式","det([x,2],[3,4])"],["截断级数","trunc(f,x,0,6)"],["复数域","domain: complex"]],
  };
  const currentTips = category === "equations" && drafts.equations.operation === "equation_matrix"
    ? [["矩阵方程","ABC=D"],["矩阵乘积","A*X*B=D"],["未知矩阵",tr("出现一次")],["分隔行",tr("换行或分号")]]
    : tips[category];
  $("#syntax-tips").innerHTML = currentTips.map(([label,code]) => `<div class="syntax-row"><span>${tr(label)}</span><code>${escapeHTML(code)}</code></div>`).join("");
}
function renderHeading() {
  const equations = category === "equations";
  const utility = utilityPage && utilityViews[utilityPage];
  const section = utilityPage || (equations ? "equations" : "calculate");
  const title = tr(utility ? utility.name : equations ? "方程" : "计算");
  document.title = title + " · CAVEQIS";
  $$(".nav-item[data-category]").forEach(button => {
    const active = button.dataset.category === section;
    button.classList.toggle("active",active);
    if (active) button.setAttribute("aria-current","page");
    else button.removeAttribute("aria-current");
  });
  $("#page-title").textContent = title;
  $("#page-description").textContent = utility ? bilingual(...utility.description) : equations
    ? bilingual("Solve scalar and matrix equations.", "求解标量方程和矩阵方程。")
    : bilingual("Choose a calculation type and an operation.", "选择运算类别和具体运算。");
  $("#heading-formula").textContent = (utility || tools[category]).art;
  $("#breadcrumb-current").textContent = tr((utility || tools[category]).name);
  $("#math-workspace").hidden = Boolean(utility);
  $("#service-state").hidden = Boolean(utility);
  for (const name of Object.keys(utilityViews)) $(`#${name}-panel`).hidden = utilityPage !== name;
}
function switchCategory(next, save=true) {
  if (!Object.hasOwn(tools,next)) return;
  if (save && !utilityPage) collect();
  utilityPage = null;
  category = next;
  if (next !== "equations") lastCalculation = next;
  revision++;
  location.hash = next;
  renderHeading();
  closeNavigation();
  renderFields();
  renderSupport();
  resetResult();
}
function navigate(next, save=true) {
  if (!Object.hasOwn(utilityViews,next)) {
    switchCategory(next,save);
    return;
  }
  if (save && !utilityPage) collect();
  utilityPage = next;
  revision++;
  location.hash = next;
  renderHeading();
  closeNavigation();
  renderUtilityView(next);
}
function updateCalculateLabel() {
  $("#calculate-label").textContent = tr(busy ? "正在计算" : category === "equations" ? "开始求解" : "开始计算");
}
function renderServiceState() {
  const labels = {connecting:"连接计算服务中", ready:"计算服务已就绪", error:"计算服务未连接"};
  $("#service-state").classList.toggle("ready",serviceState === "ready");
  $("#service-state").classList.toggle("error",serviceState === "error");
  $("#service-label").textContent = tr(labels[serviceState]);
}
function renderGuide(section = $("#help-category").value || utilityPage || category) {
  const categories = [["common","通用符号"], ...Object.entries({...tools,...utilityViews}).map(([key, tool]) => [key,tool.name])];
  $("#help-category").innerHTML = categories.map(([key, name]) => `<option value="${key}">${escapeHTML(tr(name))}</option>`).join("");
  $("#help-category").value = section;
  $("#help-content").innerHTML = guideContent[section].map(({english,chinese,syntax,usageEn,usageZh}) =>
    `<section class="help-note"><h3>${escapeHTML(bilingual(english,chinese))}</h3><pre><code>${escapeHTML(syntax)}</code></pre><p>${escapeHTML(bilingual(usageEn,usageZh))}</p></section>`).join("");
}
function renderResult(result) {
  latestResult = result;
  $("#result-card").setAttribute("aria-busy","false");
  $("#elapsed").textContent = result.elapsed_ms ? (result.elapsed_ms/1000).toFixed(2)+" s" : "";
  $("#copy-result").hidden = !result.ok;
  $("#send-result-graph").hidden = !graphResultRows(result).length;
  if (!result.ok) {
    $("#result-content").innerHTML = `<div class="result-error"><strong>${tr("暂时无法完成这次计算")}</strong><br>${escapeHTML(resultText(result.error,"error"))}</div>`;
    return;
  }
  const notes = [...new Set((result.notes || []).map(note => resultText(note,"note")))];
  $("#result-content").innerHTML = result.items.map((item,index)=>`<div class="result-item"><div class="result-label">${escapeHTML(resultText(item.label))}</div><div class="math-output" id="output-${index}"></div>${item.approx ? `<div class="approx-result"><span>${tr("近似值")}</span><span id="approx-${index}"></span></div>` : ""}</div>`).join("") + (notes.length ? `<div class="result-notes">${notes.map(note=>`<p>${escapeHTML(note)}</p>`).join("")}</div>` : "");
  result.items.forEach((item,index)=>{
    math($("#output-"+index),item.latex,true);
    if (item.approx) math($("#approx-"+index),item.approx_latex);
  });
}
function summarize(data) {
  if (data.operation === "equation_matrix") {
    const form = readMatrixEquation(data.matrixEquation);
    return form ? `${form.equation} · ${tr("未知矩阵")} ${form.unknown}` : tr("矩阵方程");
  }
  if (data.category === "matrix" || (data.category === "determinant" && data.operation !== "formula")) {
    const tool = tools[data.category];
    return tr(tool.operations.find(([op])=>op===data.operation)?.[1] || tool.name) + " · [" + (data.matrixA || "").replaceAll("\n","; ") + "]";
  }
  return data.expression || tr("计算");
}
function renderHistory() {
  $("#history-count").textContent = history.length;
  $("#history-list").innerHTML = history.length ? history.slice(0,5).map((entry,index)=>`<button type="button" class="history-entry" data-history="${index}" title="${tr("恢复这次输入与结果")}"><span class="history-meta"><span>${tr(tools[entry.category].name)}</span><span>${new Date(entry.time).toLocaleTimeString(language === "zh" ? "zh-CN" : "en",{hour:"2-digit",minute:"2-digit"})}</span></span><span class="history-expression">${escapeHTML(summarize({...entry.data,category:entry.category}))}</span></button>`).join("") : `<div class="history-empty">${tr("完成第一次计算后，在这里找回记录")}</div>`;
}
function renderLoading() {
  $("#result-content").innerHTML = `<div class="loading-result"><div class="loader"></div>${tr("正在计算")}</div>`;
}
async function calculate(event) {
  event?.preventDefault();
  if (busy) return;
  const data = collect();
  const requestRevision = revision;
  busy = true;
  $("#calculate-button").disabled = true;
  $("#calculate-button").classList.add("loading");
  updateCalculateLabel();
  latestResult = null;
  $("#copy-result").hidden = true;
  $("#send-result-graph").hidden = true;
  $("#elapsed").textContent = "";
  $("#result-card").setAttribute("aria-busy","true");
  renderLoading();
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),35000);
  try {
    const response = await fetch("api/calculate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data),signal:controller.signal});
    let result;
    try { result = await response.json(); } catch { throw new Error("计算服务响应异常，请确认服务已启动。"); }
    if (requestRevision === revision) renderResult(result);
    if (result.ok) {
      history.unshift({category:data.category,data,result,time:Date.now()});
      history = history.slice(0,20);
      storage.set("shuyan-history-v1",history);
      renderHistory();
    }
  } catch (error) {
    if (requestRevision === revision) renderResult({ok:false,error:error.name === "AbortError" ? "请求等待时间过长，请确认计算服务状态后重试。" : "无法连接计算服务，请确认工具箱服务正在运行。"});
  } finally {
    clearTimeout(timer);
    busy = false;
    $("#calculate-button").disabled = false;
    $("#calculate-button").classList.remove("loading");
    updateCalculateLabel();
    $("#result-card").setAttribute("aria-busy","false");
  }
}

$("#calculation-form").addEventListener("submit",calculate);
$("#calculation-form").addEventListener("input",event=>{
  if (event.target.id === "matrix-equation" && !event.isComposing) {
    collectMatrixEquation();
    renderMatrixEquationDetails();
    revision++;
    resetResult();
  } else if (["matrixA","matrixB"].includes(event.target.name)) updateMatrixSizes();
});
$("#calculation-form").addEventListener("change",event=>{
  if (event.target.id === "matrix-equation-unknown") {
    collectMatrixEquation();
    renderMatrixEquationDetails();
    $("#matrix-equation-unknown").focus({preventScroll:true});
    revision++;
    resetResult();
  }
  if (event.target.id === "calculation-type") switchCategory(event.target.value);
  if (event.target.id === "operation") {
    const previous=drafts[category].operation;
    collect();
    const next=drafts[category].operation;
    if (category==="derivative" && previous!==next) drafts[category].variables=["gradient","hessian","differential"].includes(next) ? "x,y" : next==="partial" ? "x:1,y:1" : "x";
    if (category==="series" && previous!==next) {
      if (next==="summation") drafts.series.variables="n";
      else if (previous==="summation") drafts.series.variables="x";
    }
    revision++; renderFields(); renderSupport(); resetResult();
  }
});
document.addEventListener("click",event=>{
  if (window.matchMedia("(max-width:680px)").matches && !event.target.closest("#sidebar,#mobile-menu")) closeNavigation();
  const categoryButton = event.target.closest("[data-category]");
  if (categoryButton) {
    const page = categoryButton.dataset.category;
    navigate(page === "calculate" ? lastCalculation : page);
  }
  const angleButton = event.target.closest("[data-angle]");
  if (angleButton) { collect(); drafts[category].angle=angleButton.dataset.angle; renderFields(); }
  const keyButton = event.target.closest("[data-insert]");
  const editButton = event.target.closest("[data-edit]");
  if (keyButton || editButton) {
    const button = keyButton || editButton;
    let target = document.getElementById(button.dataset.target);
    if (!target) return;
    let start = target.selectionStart, end = target.selectionEnd;
    let template=keyButton?.dataset.insert;
    if (button.dataset.formula==="true") {
      collect();
      template=operatorTemplates().find(([label])=>label===button.dataset.operator)[1];
    }
    const useFormula=button.dataset.formula==="true" && target.id === "expression" && category !== "equations";
    const switchFormula=useFormula && drafts[category].operation!=="formula";
    if (switchFormula && start===end && target.value.trim()) { start=0;end=target.value.length; }
    const next = keyButton ? mathInput.insertTemplate(target.value,start,end,template) : mathInput.backspace(target.value,start,end);
    if (switchFormula) {
      collect();
      drafts[category].operation="formula";
      drafts[category].expression=next.value;
      revision++;renderFields();renderSupport();resetResult();
      target=document.getElementById(button.dataset.target);
    }
    target.value = next.value;
    target.focus({preventScroll:true});
    target.setSelectionRange(next.start,next.end);
    target.dispatchEvent(new Event("input",{bubbles:true}));
  }
  const exampleButton = event.target.closest("[data-example]");
  if (exampleButton) {
    collect();
    const example=currentExamples()[Number(exampleButton.dataset.example)];
    const {precision, assumption, expression} = drafts[category];
    const {matrixEquation, ...values} = example.data;
    if (matrixEquation) {
      matrixEquationDraft = readMatrixEquation(matrixEquation);
      values.expression = expression;
    }
    drafts[category] = {...tools[category].defaults, precision, assumption, ...values};
    revision++; renderFields(); renderSupport(); resetResult(); toast("示例已填入");
  }
  const templateButton = event.target.closest("[data-template]");
  if (templateButton) {
    const target = $("#matrix"+templateButton.dataset.matrix);
    const identity = templateButton.dataset.template === "identity";
    const n = identity ? 3 : Number(templateButton.dataset.template);
    target.value = Array.from({length:n},(_,r)=>Array.from({length:n},(_,c)=>identity ? Number(r===c) : r*n+c+1).join(", ")).join("\n");
    updateMatrixSizes();
  }
  if (event.target.closest("#swap-matrices")) {
    const a=$("#matrixA"),b=$("#matrixB"),previous=a.value; a.value=b.value; b.value=previous; updateMatrixSizes();
  }
  const historyButton = event.target.closest("[data-history]");
  if (historyButton) {
    const entry = history[Number(historyButton.dataset.history)];
    collect();
    const {matrixEquation, ...values} = entry.data;
    if (matrixEquation) matrixEquationDraft = readMatrixEquation(matrixEquation) || {equation:"", unknown:"", matrices:{}};
    drafts[entry.category] = {...tools[entry.category].defaults,...values};
    switchCategory(entry.category,false);
    renderResult(entry.result); toast("已恢复输入与计算结果");
  }
});
$("#reset-form").addEventListener("click",()=>{
  const matrixMode = category === "equations" && drafts[category].operation === "equation_matrix";
  drafts[category] = {...tools[category].defaults};
  if (matrixMode) {
    drafts[category].operation = "equation_matrix";
    matrixEquationDraft = {equation:"", unknown:"", matrices:{}};
  }
  revision++; renderFields(); renderSupport(); resetResult();
});
$("#clear-history").addEventListener("click",()=>{history=[];storage.set("shuyan-history-v1",[]);renderHistory();toast("历史记录已清空");});
$("#copy-result").addEventListener("click",async()=>{
  if (!latestResult?.ok) return;
  const text=latestResult.items.map(item=>`${resultText(item.label)}: ${item.text}${item.approx ? "\n"+tr("近似值")+": "+item.approx : ""}`).join("\n\n") + (latestResult.notes?.length ? "\n\n"+latestResult.notes.map(note=>resultText(note,"note")).join("\n") : "");
  try { await navigator.clipboard.writeText(text); toast("计算结果已复制"); }
  catch { const area=document.createElement("textarea");area.value=text;document.body.append(area);area.select();const copied=document.execCommand("copy");area.remove();toast(copied ? "计算结果已复制" : "浏览器限制了复制，请手动选择结果"); }
});
$("#send-result-graph").addEventListener("click",()=>sendResultToGraph(latestResult));
document.addEventListener("keydown",event=>{
  if ((event.ctrlKey||event.metaKey)&&event.key==="Enter"&&!$("#help-dialog").open&&!utilityPage) {event.preventDefault();calculate();}
  if (event.key==="Escape") closeNavigation();
});
const helpDialog = $("#help-dialog");
for (const selector of ["#help-sidebar","#help-syntax"]) $(selector).addEventListener("click",()=>{
  renderGuide(utilityPage || category);
  helpDialog.showModal();
  helpDialog.scrollTop = 0;
});
$("#help-category").addEventListener("change", event => {
  const select = event.target;
  renderGuide(select.value);
  helpDialog.scrollTop = 0;
});
$("#close-help").addEventListener("click",()=>$("#help-dialog").close());
$("#help-dialog").addEventListener("click",event=>{if(event.target===$("#help-dialog")){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close();}});
$("#theme-toggle").addEventListener("click",()=>{
  const dark=document.body.classList.toggle("dark");
  storage.set("shuyan-theme",dark ? "dark" : "light");
  $("#theme-toggle").setAttribute("aria-pressed",String(dark));
  if (utilityPage==="graph") { updateGraphSwatches(); scheduleGraphDraw(); }
});
$("#mobile-menu").addEventListener("click",()=>{const expanded=$("#sidebar").classList.toggle("open");$("#mobile-menu").setAttribute("aria-expanded",String(expanded));});
$("#sidebar-close").addEventListener("click",closeNavigation);
$("#language-select").addEventListener("change", event => {
  if (!utilityPage) collect();
  language = event.target.value;
  storage.set("shuyan-language",language);
  localizeShell();
  renderHeading(); renderHistory(); renderGuide(); renderServiceState();
  $("#toast").hidden = true;
  if (utilityPage) {
    renderUtilityView(utilityPage);
    return;
  }
  renderFields(); renderSupport();
  if (latestResult) renderResult(latestResult);
  else if (busy && $("#result-card").getAttribute("aria-busy") === "true") renderLoading();
  else resetResult();
});
window.addEventListener("hashchange",()=>{
  const next = location.hash.slice(1) || "calculate";
  if (next !== (utilityPage || category)) navigate(next);
});
if(storage.get("shuyan-theme","light")==="dark")document.body.classList.add("dark");
language = storage.get("shuyan-language","en") === "zh" ? "zh" : "en";
localizeShell();
navigate(Object.hasOwn(utilityViews,initialRoute) ? initialRoute : category,false);
renderHistory();
renderGuide();
renderServiceState();
fetch("api/health").then(r=>r.json()).then(data=>{
  if(!data.ok)throw new Error("unavailable");
  serviceState="ready";
  renderServiceState();
}).catch(()=>{
  serviceState="error";
  renderServiceState();
});
