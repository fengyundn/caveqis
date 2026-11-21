"use strict";

const utilityViews = {
  date: {name:"日期计算", art:"＋ 1 d", description:["Find the days between dates or shift a date by years, months and days.","计算两个日期的间隔，或按年、月、日加减日期。"]},
  converter: {name:"转换器", art:"1 m ⇄ 100 cm", description:["Convert between units of measurement.","在不同的计量单位之间换算。"]},
  graph: {name:"图表", art:"y = f(x)", description:["Plot and compare functions, equations and curves on an interactive plane.","在交互坐标平面上绘制和比较函数、方程与曲线。"]},
  settings: {name:"设置", art:"⚙", description:["Choose the color theme and startup animation.","选择颜色主题和启动动画。"]},
};

const utilityElement = id => document.getElementById(id);
const utilityLocale = () => language === "zh" ? "zh-CN" : "en";
const converterDrafts = Object.fromEntries(Object.entries(unitCategories).map(([key, {defaults:[from,to]}]) => [key, {from,to,value:"1"}]));
let conversionCategory = "volume";

function conversionNumber(value) {
  const normalized = value.normalize("NFKC").trim().replaceAll("−","-");
  if (normalized === "") return undefined;
  const pattern = /^[+-]?(?:\d{1,3}(?:,\d{3})+(?:\.\d*)?|\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
  const number = pattern.test(normalized) ? Number(normalized.replaceAll(",","")) : NaN;
  return Number.isFinite(number) ? number : null;
}

function formatConversion(number) {
  const magnitude = Math.abs(number);
  const notation = magnitude >= 1e12 || (magnitude > 0 && magnitude < 1e-6) ? "scientific" : "standard";
  return new Intl.NumberFormat(utilityLocale(), {notation, maximumSignificantDigits:12}).format(number === 0 ? 0 : number);
}

function converterSelections() {
  const draft = converterDrafts[conversionCategory];
  const units = unitCategories[conversionCategory].units;
  return [units.find(unit => unit[0] === draft.from), units.find(unit => unit[0] === draft.to)];
}

function renderConversion() {
  const draft = converterDrafts[conversionCategory];
  const [from,to] = converterSelections();
  const value = conversionNumber(draft.value);
  const converted = Number.isFinite(value) ? convertUnits(conversionCategory, from, to, value) : NaN;
  const error = value === null ? "请输入有效数字。" : value !== undefined && !Number.isFinite(converted) ? "数值超出换算范围。" : "";
  utilityElement("converter-error").textContent = tr(error);
  utilityElement("converter-value").setAttribute("aria-invalid",String(error !== ""));
  utilityElement("converter-result").textContent = Number.isFinite(converted) ? formatConversion(converted) : "—";
  utilityElement("converter-result-unit").textContent = to[0];

  const equivalents = utilityElement("converter-equivalents");
  const comparisons = unitCategories[conversionCategory].comparisons || [];
  utilityElement("converter-comparison").hidden = !comparisons.length || !Number.isFinite(converted);
  equivalents.replaceChildren();
  if (utilityElement("converter-comparison").hidden) return;
  for (const [en,zh,factor] of comparisons) {
    const related = value * (from[3] / factor);
    if (!Number.isFinite(related)) continue;
    const item = document.createElement("div");
    const name = document.createElement("dt");
    const number = document.createElement("dd");
    name.textContent = bilingual(en,zh);
    number.textContent = formatConversion(related);
    item.append(name, number);
    equivalents.append(item);
  }
  utilityElement("converter-comparison").hidden = equivalents.childElementCount === 0;
}

function setUtilityOptions(select, choices, selected) {
  select.replaceChildren(...choices.map(([value,label]) => new Option(label,value)));
  select.value = selected;
}

function renderConverter() {
  const draft = converterDrafts[conversionCategory];
  const categories = Object.entries(unitCategories).map(([key, {name:[en,zh]}]) => [key,bilingual(en,zh)]);
  const units = unitCategories[conversionCategory].units.map(([symbol,en,zh]) => [symbol,`${bilingual(en,zh)} (${symbol})`]);
  setUtilityOptions(utilityElement("converter-category"), categories, conversionCategory);
  setUtilityOptions(utilityElement("converter-from"), units, draft.from);
  setUtilityOptions(utilityElement("converter-to"), units, draft.to);
  utilityElement("converter-value").value = draft.value;
  const notes = {
    volume:"美制和英制容积单位分别标注。",
    data:"十进制单位按 1000 进位，二进制单位按 1024 进位。",
    speed:"马赫换算采用 340.3 米/秒作为基准。",
    time:"时间换算中的 1 年按 365.25 天计。",
  };
  utilityElement("converter-note").textContent = tr(notes[conversionCategory] || "");
  renderConversion();
}

utilityElement("converter-category").addEventListener("change",event => {
  conversionCategory = event.target.value;
  renderConverter();
});
for (const side of ["from", "to"]) {
  utilityElement("converter-"+side).addEventListener("change",event => {
    converterDrafts[conversionCategory][side] = event.target.value;
    renderConversion();
  });
}
utilityElement("converter-value").addEventListener("input",event => {
  converterDrafts[conversionCategory].value = event.target.value;
  renderConversion();
});
utilityElement("converter-swap").addEventListener("click",() => {
  const draft = converterDrafts[conversionCategory];
  const [from,to] = converterSelections();
  const value = conversionNumber(draft.value);
  if (Number.isFinite(value)) {
    const converted = convertUnits(conversionCategory, from, to, value);
    if (Number.isFinite(converted)) draft.value = String(Number(converted.toPrecision(15)));
  }
  [draft.from,draft.to] = [draft.to,draft.from];
  renderConverter();
});

const dayMilliseconds = 86400000;
const firstCalendarYear = 1601;
const lastCalendarYear = 9999;

function calendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value+"T00:00:00Z");
  if (!Number.isFinite(+date) || date.toISOString().slice(0,10) !== value) return null;
  return calendarDateInRange(date) ? date : null;
}

function calendarDateInRange(date) {
  const year = date.getUTCFullYear();
  return year >= firstCalendarYear && year <= lastCalendarYear;
}

function shiftCalendarMonths(date, amount) {
  const next = new Date(+date);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + amount);
  const last = new Date(+next);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  next.setUTCDate(Math.min(day,last.getUTCDate()));
  return next;
}

function calendarSpan(first, second) {
  const [start,end] = first <= second ? [first,second] : [second,first];
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  if (shiftCalendarMonths(start, years*12) > end) years--;
  const yearDate = shiftCalendarMonths(start, years*12);
  let months = (end.getUTCFullYear() - yearDate.getUTCFullYear())*12 + end.getUTCMonth() - yearDate.getUTCMonth();
  if (shiftCalendarMonths(yearDate, months) > end) months--;
  const remainder = (end - shiftCalendarMonths(yearDate,months)) / dayMilliseconds;
  return {total:(end-start)/dayMilliseconds, years, months, weeks:Math.floor(remainder/7), days:remainder%7};
}

function shiftCalendarDate(date, direction, years, months, days) {
  if (direction === "subtract") {
    const dayDate = new Date(+date - days*dayMilliseconds);
    return shiftCalendarMonths(shiftCalendarMonths(dayDate,-months),-12*years);
  }
  const monthDate = shiftCalendarMonths(shiftCalendarMonths(date,12*years),months);
  return new Date(+monthDate + days*dayMilliseconds);
}

function renderDateCalculator() {
  const difference = utilityElement("date-mode").value === "difference";
  utilityElement("date-difference-fields").hidden = !difference;
  utilityElement("date-offset-fields").hidden = difference;
  utilityElement("date-result-label").textContent = tr(difference ? "相隔天数" : "计算日期");

  const output = utilityElement("date-result");
  const detail = utilityElement("date-detail");
  const error = utilityElement("date-error");
  output.textContent = "—";
  detail.textContent = "";
  error.textContent = "";
  if (difference) {
    const from = calendarDate(utilityElement("date-from").value);
    const to = calendarDate(utilityElement("date-to").value);
    if (!from || !to) {
      error.textContent = tr("请选择受支持的日期。");
      return;
    }
    const span = calendarSpan(from,to);
    const formatUnit = (number, unit) => new Intl.NumberFormat(utilityLocale(),{style:"unit",unit,unitDisplay:"long"}).format(number);
    output.textContent = formatUnit(span.total,"day");
    const parts = [[span.years,"year"],[span.months,"month"],[span.weeks,"week"],[span.days,"day"]]
      .filter(([value]) => value > 0).map(([value,unit]) => formatUnit(value,unit));
    if (parts.length) detail.textContent = new Intl.ListFormat(utilityLocale(),{type:"unit",style:"short"}).format(parts);
    return;
  }
  const start = calendarDate(utilityElement("date-start").value);
  if (!start) {
    error.textContent = tr("请选择受支持的日期。");
    return;
  }
  const numbers = ["years","months","days"].map(unit => utilityElement("date-"+unit));
  const amount = numbers.map(input => Number(input.value));
  if (numbers.some(input => input.validity.badInput) || amount.some(value => !Number.isSafeInteger(value) || value < 0)) {
    error.textContent = tr("年数、月数和天数须为非负整数。");
    return;
  }
  const result = shiftCalendarDate(start,utilityElement("date-direction").value,...amount);
  if (!calendarDateInRange(result)) {
    error.textContent = tr("结果超出 1601 至 9999 年的范围。");
    return;
  }
  const locale = new Intl.DateTimeFormat(utilityLocale(),{dateStyle:"full",timeZone:"UTC"});
  output.textContent = locale.format(result);
  detail.textContent = result.toISOString().slice(0,10);
}

const localToday = new Date();
const todayDate = [localToday.getFullYear(),localToday.getMonth()+1,localToday.getDate()]
  .map(part => String(part).padStart(2,"0")).join("-");
for (const id of ["date-start","date-from","date-to"]) utilityElement(id).value = todayDate;
utilityElement("date-panel").addEventListener("input",renderDateCalculator);
utilityElement("date-panel").addEventListener("change",renderDateCalculator);

function renderUtilityView(view) {
  if (view === "converter") renderConverter();
  if (view === "date") renderDateCalculator();
  if (view === "graph") renderGraphTool();
}
