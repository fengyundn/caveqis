"use strict";

const graphFunctions = {
  sin:[Math.sin,1], cos:[Math.cos,1], tan:[Math.tan,1],
  asin:[Math.asin,1], acos:[Math.acos,1], atan:[Math.atan,1], atan2:[Math.atan2,2],
  arcsin:[Math.asin,1], arccos:[Math.acos,1], arctan:[Math.atan,1],
  sinh:[Math.sinh,1], cosh:[Math.cosh,1], tanh:[Math.tanh,1],
  sec:[x=>1/Math.cos(x),1], csc:[x=>1/Math.sin(x),1], cot:[x=>1/Math.tan(x),1],
  asec:[x=>Math.acos(1/x),1], acsc:[x=>Math.asin(1/x),1], acot:[x=>Math.atan2(1,x),1],
  sech:[x=>1/Math.cosh(x),1], csch:[x=>1/Math.sinh(x),1], coth:[x=>1/Math.tanh(x),1],
  asinh:[Math.asinh,1], acosh:[Math.acosh,1], atanh:[Math.atanh,1],
  sqrt:[Math.sqrt,1], cbrt:[Math.cbrt,1], abs:[Math.abs,1], exp:[Math.exp,1], ln:[Math.log,1],
  log:[(x,base=Math.E)=>Math.log(x)/Math.log(base),1,2], log10:[Math.log10,1],
  root:[(x,n)=>Number.isInteger(n) && n>=1 && n<=100 ? x**(1/n) : NaN,2],
  realroot:[(x,n)=>x<0 && Number.isInteger(n) && Math.abs(n%2)===1 ? -((-x)**(1/n)) : n===0 ? NaN : x**(1/n),2],
  floor:[Math.floor,1], ceil:[Math.ceil,1], round:[Math.round,1], sign:[Math.sign,1],
  min:[Math.min,1,64], max:[Math.max,1,64], mod:[(x,m)=>((x%m)+m)%m,2],
  mean:[(...values)=>graphTotal(values)/values.length,1,64],
  median:[(...values)=>graphQuantile(values,0.5),1,64],
  quantile:[(p,...values)=>p>=0 && p<=1 ? graphQuantile(values,p) : NaN,2,64],
  total:[(...values)=>graphTotal(values),1,64], count:[(...values)=>values.length,1,64],
  var:[(...values)=>graphVariance(values,1),2,64], varp:[(...values)=>graphVariance(values,0),1,64],
  stdev:[(...values)=>Math.sqrt(graphVariance(values,1)),2,64],
  stdevp:[(...values)=>Math.sqrt(graphVariance(values,0)),1,64],
  normalpdf:[(x,mean=0,sigma=1)=>sigma>0 ? Math.exp(-0.5*((x-mean)/sigma)**2)/(sigma*Math.sqrt(2*Math.PI)) : NaN,1,3],
  uniformpdf:[(x,a,b)=>b>a ? (x>=a && x<=b ? 1/(b-a) : 0) : NaN,3],
  binomialpmf:[(k,n,p)=>Number.isInteger(n) && n>=0 && n<=170 && p>=0 && p<=1
    ? Number.isInteger(k) && k>=0 && k<=n ? graphCombinatoric(n,k,true)*p**k*(1-p)**(n-k) : 0 : NaN,3],
  poissonpmf:[(k,rate)=>rate>=0 && rate<=170 && Number.isInteger(k) && k>=0 && k<=170
    ? k===0 ? Math.exp(-rate) : Math.exp(k*Math.log(rate)-rate-Math.log(graphFactorials[k])) : NaN,2],
  gcd:[graphGcd,2], lcm:[(a,b)=>Number.isSafeInteger(a) && Number.isSafeInteger(b)
    ? a && b ? Math.abs(a/graphGcd(a,b)*b) : 0 : NaN,2],
  npr:[(n,k)=>graphCombinatoric(n,k,false),2], ncr:[(n,k)=>graphCombinatoric(n,k,true),2],
  distance:[(x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1),4],
  factorial:[n=>graphFactorials[n] ?? NaN,1], ceiling:[Math.ceil,1],
};
const graphConstants = {pi:Math.PI,e:Math.E};
const graphCalculusCosts = {at:1,diff:22,integrate:49,sum:64,prod:64};
const graphTextLimit = 600;
const graphListFunctions = new Set(["mean","median","quantile","total","count","var","varp","stdev","stdevp","min","max"]);
const graphAliases = {
  平方根:"sqrt",根号:"sqrt",开方:"sqrt",方根:"root",指数:"exp",自然对数:"ln",对数:"log",常用对数:"log10",
  正弦:"sin",余弦:"cos",正切:"tan",余切:"cot",正割:"sec",余割:"csc",反正弦:"asin",反余弦:"acos",反正切:"atan",
  双曲正弦:"sinh",双曲余弦:"cosh",双曲正切:"tanh",绝对值:"abs",阶乘:"factorial",符号:"sign",向下取整:"floor",向上取整:"ceil",
  积分:"integrate",求导:"diff",导数:"diff",代入:"at",求和:"sum",连乘:"prod",
};
const graphVariablePattern = String.raw`(?:[a-z](?:_[a-z0-9]+)?|theta|[\p{Script=Han}α-ω][\p{Script=Han}α-ω0-9_]{0,23})`;
const graphVariableName = new RegExp(`^${graphVariablePattern}$`,"u");
const graphAssignmentPattern = new RegExp(String.raw`^(${graphVariablePattern})\s*=\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)$`,"u");
const graphAliasPattern = new RegExp(`(?:${Object.keys(graphAliases).join("|")})(?=\\s*\\()`,"g");
const graphFactorials = [1];
for (let i=1;i<=170;i++) graphFactorials.push(i*graphFactorials[i-1]);
const graphError = message => new Error(message);
const graphCondition = (a, op, b) => Number.isFinite(a) && Number.isFinite(b) && (
  op === "=" ? a === b : op === "<" ? a < b : op === ">" ? a > b : op === "<=" ? a <= b : a >= b
);

function graphTotal(values) {
  return values.reduce((total,value)=>total+value,0);
}

function graphQuantile(values,p) {
  const sorted = values.slice().sort((a,b)=>a-b);
  const index = (sorted.length-1)*p;
  const low = Math.floor(index), weight = index-low;
  return sorted[low]*(1-weight)+sorted[Math.ceil(index)]*weight;
}

function graphVariance(values,correction) {
  const mean = graphTotal(values)/values.length;
  return graphTotal(values.map(value=>(value-mean)**2))/(values.length-correction);
}

function graphGcd(a,b) {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) return NaN;
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a,b] = [b,a%b];
  return a;
}

function graphCombinatoric(n,k,combination) {
  if (!Number.isInteger(n) || !Number.isInteger(k) || k<0 || n<k || n>170) return NaN;
  const terms = combination ? Math.min(k,n-k) : k;
  let value = 1;
  for (let i=1;i<=terms;i++) value *= (n-i+1)/(combination?i:1);
  return Math.round(value);
}

function graphDerivative(at,x,order) {
  if (!Number.isFinite(x) || !Number.isInteger(order) || order<1 || order>10) return NaN;
  const step = (order===1 ? 1e-5 : Number.EPSILON**(1/(order+4)))*Math.max(1,Math.abs(x));
  if (order===1) {
    const center = at(x), left = (center-at(x-step))/step, right = (at(x+step)-center)/step;
    const average = (left+right)/2;
    return Math.abs(left-right)<=0.01*Math.max(1,Math.abs(average)) ? average : NaN;
  }
  const estimate = width => {
    const samples = Array.from({length:order+1},(_,i)=>at(x+(i-order/2)*width));
    for (let size=order;size>0;size--) {
      for (let i=0;i<size;i++) samples[i] = samples[i+1]-samples[i];
    }
    return samples[0]/width**order;
  };
  const coarse = estimate(step*2), fine = estimate(step);
  return Math.abs(coarse-fine)<=0.02*Math.max(1,Math.abs(fine)) ? (4*fine-coarse)/3 : NaN;
}

function graphEvaluateCalculus(name, body, variable, bounds, scope) {
  const [lower,upper] = bounds.map(bound=>bound(scope));
  const previous = scope[variable];
  const at = value => {
    scope[variable] = value;
    return body(scope);
  };
  try {
    if (name==="at") return Number.isFinite(lower) ? at(lower) : NaN;
    if (name==="diff") return graphDerivative(at,previous,lower ?? 1);
    if (!Number.isFinite(lower) || !Number.isFinite(upper)) return NaN;
    if (name==="integrate") {
      if (lower===upper) return 0;
      const pieces = 48, step = (upper-lower)/pieces;
      let fine = at(lower)+at(upper), coarse = fine;
      for (let i=1;i<pieces;i++) {
        const value = at(lower+i*step);
        fine += (i%2 ? 4 : 2)*value;
        if (i%2===0) coarse += (i%4 ? 4 : 2)*value;
      }
      const estimate = fine*step/3;
      return Math.abs(estimate-coarse*step*2/3)<0.002*Math.max(1,Math.abs(estimate)) ? estimate : NaN;
    }
    if (!Number.isSafeInteger(lower) || !Number.isSafeInteger(upper) || upper-lower>=64) return NaN;
    let result = name==="sum" ? 0 : 1;
    for (let i=lower;i<=upper;i++) result = name==="sum" ? result+at(i) : result*at(i);
    return result;
  } finally {
    scope[variable] = previous;
  }
}

function normalizeGraphExpression(text) {
  const superscripts = "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻";
  return text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+/g, chars => "^("+[...chars].map(char=>"0123456789+-"[superscripts.indexOf(char)]).join("")+")")
    .normalize("NFKC").toLowerCase().trim()
    .replace(/[−–—]/g,"-").replace(/[×·⋅∗]/g,"*").replace(/[÷∕⁄]/g,"/").replace(/\*\*/g,"^")
    .replace(/【|〔/g,"[").replace(/】|〕/g,"]").replace(/、/g,",").replace(/(?<=\d)。(?=\d)/g,".")
    .replace(/π|圆周率/g,"pi").replace(/自然常数|欧拉数/g,"e").replace(/θ/g,"theta")
    .replace(/√/g,"sqrt").replace(/≤/g,"<=").replace(/≥/g,">=")
    .replace(graphAliasPattern,word=>graphAliases[word])
    .replace(/∫(?=\s*\()/g,"integrate").replace(/[∑σ](?=\s*\()/g,"sum").replace(/∏(?=\s*\()/g,"prod")
    .replace(/∂(?=\s*\()/g,"diff");
}

function graphSplit(text, separator) {
  const parts = [];
  let depth = 0;
  let start = 0;
  const pattern = new RegExp(separator,"y");
  for (let index=0; index<text.length; index++) {
    if (text[index] === "(" || text[index] === "[") depth++;
    else if (text[index] === ")" || text[index] === "]") depth--;
    if (depth !== 0) continue;
    pattern.lastIndex = index;
    const match = pattern.exec(text);
    if (!match) continue;
    parts.push(text.slice(start,index).trim(),match[0]);
    index += match[0].length - 1;
    start = index + 1;
  }
  parts.push(text.slice(start).trim());
  return parts;
}

function parseGraphNumber(source, definitions) {
  const usage = {variables:new Set(), calls:[], multiplier:1};
  let current = usage, work = 0;
  const tokens = [];
  for (let position=0; position<source.length;) {
    const rest = source.slice(position);
    const whitespace = /^\s+/.exec(rest);
    if (whitespace) { position += whitespace[0].length; continue; }
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/.exec(rest);
    if (number) {
      const value = Number(number[0]);
      if (!Number.isFinite(value)) throw graphError("绘图数字超出范围。");
      tokens.push({kind:"number",value});
      position += number[0].length;
      continue;
    }
    const word = /^([a-z][a-z0-9]*)\s*\(/.exec(rest)?.[1];
    if (word && (Object.hasOwn(graphFunctions,word) || Object.hasOwn(graphCalculusCosts,word) || definitions.has(word))) {
      tokens.push({kind:"function",value:word});
      position += word.length;
      continue;
    }
    if (word && word.length >= 3 && word !== "theta") throw graphError("无法识别绘图函数。");
    const name = /^(theta|pi|[a-z]_[a-z0-9]+|[a-z]|[\p{Script=Han}α-ω][\p{Script=Han}α-ω0-9_]{0,23})/u.exec(rest);
    if (name) {
      tokens.push({kind:"name",value:name[0]});
      position += name[0].length;
      continue;
    }
    if ("+-*/^(),![]".includes(rest[0])) {
      tokens.push({kind:rest[0],value:rest[0]});
      position++;
      continue;
    }
    throw graphError("绘图表达式含无法识别的符号。");
  }
  let cursor = 0;
  const peek = () => tokens[cursor]?.kind;
  const advance = () => { work += current.multiplier; return tokens[cursor++]; };
  const take = token => peek() === token && advance();
  const need = token => {
    if (!take(token)) throw graphError("请检查绘图表达式的括号和参数。");
  };

  function atom() {
    const token = advance();
    if (!token) throw graphError("请补全绘图表达式。");
    if (token.kind === "number") return () => token.value;
    if (token.kind === "name") {
      const name = token.value;
      if (Object.hasOwn(graphConstants,name)) return () => graphConstants[name];
      current.variables.add(name);
      return scope => scope[name];
    }
    if (token.kind === "(" || token.kind === "[") {
      const value = sum();
      need(token.kind === "(" ? ")" : "]");
      return value;
    }
    if (token.kind !== "function") throw graphError("请检查绘图表达式的运算符。");
    const name = token.value;
    const args = [];
    need("(");
    if (Object.hasOwn(graphCalculusCosts,name)) {
      const outer = current;
      const argumentStart = cursor;
      let multiplier = graphCalculusCosts[name];
      if (name==="diff") {
        let depth = 0, commas = 0;
        for (let i=argumentStart;i<tokens.length;i++) {
          const kind = tokens[i].kind;
          if (kind==="(" || kind==="[") depth++;
          if (kind===")" || kind==="]") {
            if (depth===0) break;
            depth--;
          }
          if (kind==="," && depth===0) commas++;
        }
        if (commas===1) multiplier = 3;
      }
      const inner = {variables:new Set(),calls:[],multiplier:outer.multiplier*multiplier};
      if (inner.multiplier>2200) throw graphError("绘图表达式过于复杂。");
      current = inner;
      const body = sum();
      current = outer;
      need(",");
      const variable = take("name")?.value;
      if (!variable || Object.hasOwn(graphConstants,variable)) throw graphError("请检查绘图表达式的括号和参数。");
      while (take(",")) args.push(sum());
      need(")");
      if (name==="diff" ? args.length>1 : args.length!==(name==="at"?1:2)) throw graphError("绘图函数的参数数量不正确。");
      for (const used of inner.variables) if (used!==variable) outer.variables.add(used);
      if (name==="diff") outer.variables.add(variable);
      for (const call of inner.calls) outer.calls.push({...call,bound:[...call.bound,variable]});
      return scope => graphEvaluateCalculus(name,body,variable,args,scope);
    }
    do {
      if (graphListFunctions.has(name) && take("[")) {
        do { args.push(sum()); } while (take(","));
        need("]");
      } else args.push(sum());
    } while (take(","));
    need(")");
    if (Object.hasOwn(graphFunctions,name)) {
      const [fn, min, max=min] = graphFunctions[name];
      if (args.length < min || args.length > max) throw graphError("绘图函数的参数数量不正确。");
      if (args.length === 1) return scope => fn(args[0](scope));
      if (args.length === 2) return scope => fn(args[0](scope),args[1](scope));
      return scope => fn(...args.map(arg=>arg(scope)));
    }
    if (args.length !== 1) throw graphError("自定义绘图函数需要一个参数。");
    current.calls.push({name,multiplier:current.multiplier,bound:[]});
    return scope => {
      const definition = definitions.get(name);
      const value = args[0](scope);
      const previous = scope[definition.argument];
      scope[definition.argument] = value;
      const answer = !definition.check || definition.check(scope) ? definition.body.evaluate(scope) : NaN;
      scope[definition.argument] = previous;
      return answer;
    };
  }

  function unary() {
    if (take("+")) return unary();
    if (take("-")) { const right = unary(); return scope => -right(scope); }
    let left = atom();
    while (take("!")) {
      const inner = left;
      left = scope => {
        const n = inner(scope);
        return graphFactorials[n] ?? NaN;
      };
    }
    if (!take("^")) return left;
    const right = unary();
    return scope => left(scope) ** right(scope);
  }

  function product() {
    let left = unary();
    while (["*","/","number","name","function","(","["].includes(peek())) {
      const divides = Boolean(take("/"));
      if (!divides) take("*");
      const previous = left, right = unary();
      left = divides ? scope => previous(scope)/right(scope) : scope => previous(scope)*right(scope);
    }
    return left;
  }

  function sum() {
    let left = product();
    while (peek() === "+" || peek() === "-") {
      const minus = advance().kind === "-";
      const previous = left, right = product();
      left = minus ? scope => previous(scope)-right(scope) : scope => previous(scope)+right(scope);
    }
    return left;
  }

  const evaluate = sum();
  if (cursor !== tokens.length) throw graphError("请检查绘图表达式的括号和参数。");
  return {evaluate,variables:usage.variables,calls:usage.calls,cost:work};
}

function compileGraphRows(rows) {
  const definitions = new Map();
  const results = rows.map(row => ({source:normalizeGraphExpression(row.text),enabled:row.visible}));
  const parameters = new Set();
  const bindings = new Map();

  for (const item of results) {
    if (item.source.length > graphTextLimit) { item.error = "每条绘图表达式最多 600 个字符。"; continue; }
    const definition = /^([a-z])\s*\(\s*(x)\s*\)\s*=\s*(.*)$/.exec(item.source);
    if (definition && !"exyrt".includes(definition[1])) {
      const [,name,argument,source] = definition;
      if (definitions.has(name)) { item.error = "同名绘图函数只能定义一次。"; continue; }
      item.definition = {name,argument,source};
      definitions.set(name,item.definition);
    }
  }

  for (const item of results) {
    if (item.definition) {
      try {
        const {source} = graphRestrictions(item.definition.source);
        item.definition.body = parseGraphNumber(source,definitions);
      } catch (error) { item.error = error.message; }
    }
  }

  const functionMetadata = new Map();
  function metadata(number, ancestors = []) {
    const vars = new Set(number.variables);
    let cost = number.cost;
    if (cost>2200) throw graphError("绘图表达式过于复杂。");
    for (const {name:call,multiplier,bound} of number.calls) {
      const definition = definitions.get(call);
      if (!definition.body || ancestors.includes(call)) throw graphError("自定义函数无效或存在循环引用。");
      if (!functionMetadata.has(call)) functionMetadata.set(call,metadata(definition.body,[...ancestors,call]));
      const used = functionMetadata.get(call);
      cost += used.cost*multiplier;
      if (cost > 2200) throw graphError("绘图表达式过于复杂。");
      for (const name of used.vars) {
        if (name !== definition.argument && !bound.includes(name)) vars.add(name);
      }
    }
    return {vars,cost};
  }

  for (const item of results) {
    if (!item.source || item.error) continue;
    try {
      const assignment = graphAssignmentPattern.exec(item.source);
      if (assignment && !["e","x","y","r","t","theta","pi"].includes(assignment[1])) {
        const value = Number(assignment[2]);
        if (!Number.isFinite(value)) throw graphError("绘图数字超出范围。");
        if (bindings.has(assignment[1])) throw graphError("同一参数只能赋值一次。");
        bindings.set(assignment[1],value);
        item.plot = {kind:"binding"};
        continue;
      }
      const {source,conditions} = graphRestrictions(item.definition ? item.definition.source : item.source);
      const parse = text => {
        const number = parseGraphNumber(text,definitions);
        return {...number,variables:metadata(number).vars};
      };
      const checks = conditions.flatMap(condition => {
        const parts = graphSplit(condition,"<=|>=|=|<|>");
        if (parts.length < 3) throw graphError("范围限制需要不等式，例如 {0<=x<=4}。");
        const terms = parts.filter((_,i)=>i%2===0).map(parse);
        if (item.definition && terms.some(term=>term.calls.length)) throw graphError("函数定义的范围限制请直接使用参数。");
        return terms.slice(1).map((term,i) => ({
          variables:[...terms[i].variables,...term.variables],
          test:scope=>graphCondition(terms[i].evaluate(scope),parts[i*2+1],term.evaluate(scope)),
        }));
      });
      const restrict = scope => checks.every(check=>check.test(scope));
      if (item.definition && checks.length) item.definition.check = restrict;
      const variables = (numbers, reserved) => {
        const result = new Set([...numbers.flatMap(number=>[...number.variables]),...checks.flatMap(check=>check.variables)]);
        for (const name of reserved) result.delete(name);
        return result;
      };
      const tuple = source.startsWith("(") && source.endsWith(")") ? graphSplit(source.slice(1,-1),",") : [];
      const dataset = !item.definition && parseGraphDataset(source,parse);
      if (dataset) {
        if (checks.length) throw graphError("数据图形请直接编辑列表中的点或数值。");
        item.plot = {kind:"data",style:dataset.style,read:dataset.read,parameters:variables(dataset.numbers,[])};
      } else if (tuple.length === 3) {
        const x = parse(tuple[0]), y = parse(tuple[2]);
        if ([x,y].some(number=>number.variables.has("x") || number.variables.has("y"))) throw graphError("坐标对请使用数值、参数或 t。");
        const parametric = x.variables.has("t") || y.variables.has("t");
        item.plot = {kind:parametric?"parametric":"point",x:x.evaluate,y:y.evaluate,restrict,parameters:variables([x,y],["x","y",...(parametric?["t"]:[])])};
      } else {
        const parts = graphSplit(source,"<=|>=|=|<|>");
        if (parts.length === 1) {
          const right = parse(source);
          if (right.variables.has("y")) throw graphError("请用 y=f(x) 或含 x、y 的等式。");
          const coordinate = item.definition?.argument || "x";
          item.plot = {kind:"y",variable:coordinate,evaluate:right.evaluate,restrict,parameters:variables([right],[coordinate,"x","y"])};
        } else if (parts.length === 3) {
          const [lhs, op, rhs] = parts;
          const right = parse(rhs);
          if (lhs === "r" && op === "=") {
            if (["x","y","r"].some(name=>right.variables.has(name))) throw graphError("极坐标半径请用 θ 或参数表示。");
            item.plot = {kind:"polar",evaluate:right.evaluate,restrict,parameters:variables([right],["theta","r","x","y"])};
          } else if (lhs === "y" && op === "=" && !right.variables.has("y") ||
                     lhs === "x" && op === "=" && !right.variables.has("x")) {
            const variable = lhs === "y" ? "x" : "y";
            item.plot = {kind:lhs,variable,evaluate:right.evaluate,restrict,parameters:variables([right],["x","y"])};
          } else {
            const left = parse(lhs);
            item.plot = {kind:"implicit",operator:op,evaluate:scope=>left.evaluate(scope)-right.evaluate(scope),restrict,parameters:variables([left,right],["x","y"])};
          }
        } else {
          const operators = parts.filter((_,index)=>index%2);
          if (operators.includes("=")) throw graphError("每条曲线只填写一个等式或不等式。");
          const terms = parts.filter((_,index)=>index%2===0).map(parse);
          const margins = scope => {
            const values = terms.map(term=>term.evaluate(scope));
            return operators.map((op,i)=>op.startsWith("<") ? values[i+1]-values[i] : values[i]-values[i+1]);
          };
          const strict = operators.map(op=>op.length===1);
          const operator = strict.every(Boolean) ? ">" : ">=";
          const dashed = strict.some(Boolean) && operator===">=" ? scope=>{
            const distances = margins(scope);
            return strict[distances.indexOf(Math.min(...distances))];
          } : null;
          item.plot = {kind:"implicit",operator,dashed,evaluate:scope=>Math.min(...margins(scope)),restrict,
            parameters:variables(terms,["x","y"])};
        }
      }
      for (const name of item.plot.parameters) parameters.add(name);
    } catch (error) { item.error = error.message; }
  }

  return {results,parameters:[...parameters].filter(name=>!bindings.has(name)).sort(),bindings};
}

function parseGraphDataset(source,parse) {
  const match = /^(points|polyline|polygon|segment|midpoint|regression|histogram|dotplot|boxplot|sequence)\s*\((.*)\)$/.exec(source);
  const list = source.startsWith("[") && source.endsWith("]") && source.slice(1).trimStart().startsWith("(");
  if (!match && !list) return null;
  const style = list ? "points" : match[1];
  const args = graphSplit(list ? source.slice(1,-1) : match[2],",").filter((_,index)=>index%2===0);
  const readValue = text => {
    const value = parse(text);
    if (["x","y","r","t","theta"].some(name=>value.variables.has(name))) {
      throw graphError("数据图形请使用数值或滑块参数。");
    }
    return value;
  };
  if (style==="sequence") {
    if (args.length!==3) throw graphError("绘图函数的参数数量不正确。");
    const numbers = [parse(args[0]),readValue(args[1]),readValue(args[2])];
    if (["x","y","r","t","theta"].some(name=>numbers[0].variables.has(name))) {
      throw graphError("数列请使用 n 作为索引，例如 sequence(1/n,1,8)。");
    }
    numbers[0].variables.delete("n");
    return {style:"points",numbers,read:scope=>{
      const lower = numbers[1].evaluate(scope), upper = numbers[2].evaluate(scope);
      if (!Number.isSafeInteger(lower) || !Number.isSafeInteger(upper) || upper<lower || upper-lower>=200) return [];
      const local = Object.assign(Object.create(null),scope);
      return Array.from({length:upper-lower+1},(_,i)=>{
        local.n = lower+i;
        return [local.n,numbers[0].evaluate(local)];
      }).filter(pair=>pair.every(Number.isFinite));
    }};
  }
  if (["histogram","dotplot","boxplot"].includes(style)) {
    const hasWidth = style==="histogram";
    const values = args[0]?.startsWith("[") && args[0]?.endsWith("]")
      ? graphSplit(args[0].slice(1,-1),",").filter((_,index)=>index%2===0) : null;
    if (!values || args.length!==(hasWidth?2:1) || values.length>64) {
      throw graphError("统计图需要数值列表。直方图还需要正的组距。");
    }
    const numbers = values.map(readValue);
    if (hasWidth) numbers.push(readValue(args[1]));
    return {style,numbers,read:scope=>numbers.map(number=>number.evaluate(scope))};
  }
  const minimum = style==="polygon" ? 3 : style==="points" ? 1 : 2;
  const exact = style==="segment" || style==="midpoint";
  if (args.length<minimum || args.length>32 || exact && args.length!==2) {
    throw graphError("绘图函数的参数数量不正确。");
  }
  const points = args.map(arg=>{
    const pair = arg.startsWith("(") && arg.endsWith(")") ? graphSplit(arg.slice(1,-1),",") : [];
    if (pair.length!==3) throw graphError("请输入形如 (x,y) 的点。");
    return [readValue(pair[0]),readValue(pair[2])];
  });
  return {style,numbers:points.flat(),read:scope=>points.map(pair=>pair.map(number=>number.evaluate(scope)))};
}

function graphRestrictions(source) {
  const start = source.indexOf("{");
  if (start < 0) return {source,conditions:[]};
  const end = source.slice(start);
  const matches = [...end.matchAll(/\{([^{}]+)\}\s*/g)];
  if (matches.map(match=>match[0]).join("") !== end) throw graphError("请将范围限制放在末尾的花括号内。");
  return {source:source.slice(0,start).trim(),conditions:matches.map(match=>match[1])};
}

function graphDatasetIssue(plot,scope) {
  if (plot?.kind!=="data") return "";
  const data = plot.read(scope);
  if (plot.style==="histogram" && !(Number.isFinite(data.at(-1)) && data.at(-1)>0)) {
    return "直方图的组距必须是正数。";
  }
  if (plot.style==="regression" && data.every(([x])=>x===data[0][0])) {
    return "所有横坐标相同，无法拟合 y 关于 x 的直线。";
  }
  if (data.flat().some(value=>!Number.isFinite(value))) return "数据图中的点或数值必须是有限实数。";
  return "";
}
