"use strict";

const formulaBuilder = document.getElementById("formula-builder");
const formulaKind = document.getElementById("formula-kind");
const formulaSlots = document.getElementById("formula-builder-slots");
const formulaError = document.getElementById("formula-builder-error");
let formulaSelection;

function formulaField(id,label,value="") {
  const field = document.createElement("label");
  const name = document.createElement("span");
  const input = document.createElement("input");
  field.dataset.slot = id;
  name.textContent = tr(label);
  input.className = "mono";
  input.name = id;
  input.type = "text";
  input.value = value;
  input.maxLength = 300;
  input.required = true;
  input.autocomplete = "off";
  input.spellcheck = false;
  field.append(name,input);
  return field;
}

function formulaSign(text,style) {
  const sign = document.createElement("span");
  sign.className = style;
  sign.textContent = text;
  sign.setAttribute("aria-hidden","true");
  return sign;
}

function renderFormulaSlots() {
  const value = formulaSelection.value;
  formulaSlots.className = "formula-slots formula-"+formulaKind.value;
  if (formulaKind.value==="fraction") {
    formulaSlots.replaceChildren(formulaField("top","分子",value),formulaField("bottom","分母"));
  } else if (formulaKind.value==="root") {
    formulaSlots.replaceChildren(formulaSign("√","formula-root-sign"),formulaField("body","被开方数",value));
  } else {
    formulaSlots.replaceChildren(
      formulaField("upper","积分上限","x"),formulaSign("∫","formula-integral-sign"),
      formulaField("lower","积分下限","0"),formulaField("body","被积函数",value),
      formulaSign("d","formula-differential"),formulaField("variable","积分变量","t"),
    );
  }
  formulaError.textContent = "";
}

document.addEventListener("click",event=>{
  const trigger = event.target.closest("[data-formula-builder]");
  if (!trigger) return;
  const target = trigger.dataset.formulaBuilder==="graph"
    ? document.querySelector("#graph-rows .is-active .graph-formula")
    : document.getElementById(trigger.dataset.formulaBuilder);
  if (!target) return;
  const {selectionStart:start,selectionEnd:end} = target;
  formulaSelection = {target,start,end,value:target.value.slice(start,end).split(/\r?\n/)[0]};
  renderFormulaSlots();
  formulaBuilder.showModal();
});
formulaKind.addEventListener("change",renderFormulaSlots);
document.getElementById("formula-builder-close").addEventListener("click",()=>formulaBuilder.close());
document.getElementById("formula-builder-form").addEventListener("submit",event=>{
  event.preventDefault();
  const {target,start,end} = formulaSelection;
  if (!target.isConnected) { formulaBuilder.close(); return; }
  const data = Object.fromEntries([...new FormData(event.currentTarget)].map(([key,value])=>[key,value.trim()]));
  if (Object.values(data).some(value=>!value)) {
    formulaError.textContent = tr("请填写公式中的所有输入框。");
    return;
  }
  const {top,bottom,body,variable,lower,upper} = data;
  const template = formulaKind.value==="fraction" ? `((${top})/(${bottom}))`
    : formulaKind.value==="root" ? `sqrt(${body})` : `integrate(${body},${variable},${lower},${upper})`;
  const value = target.value.slice(0,start)+template+target.value.slice(end);
  if (target.maxLength>0 && value.length>target.maxLength) {
    formulaError.textContent = tr("插入后表达式过长。");
    return;
  }
  formulaBuilder.close();
  target.focus();
  target.value = value;
  target.setSelectionRange(start+template.length,start+template.length);
  target.dispatchEvent(new Event("input",{bubbles:true}));
});
