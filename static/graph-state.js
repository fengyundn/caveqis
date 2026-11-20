"use strict";

const graphRangeDefaults = {tMin:0,tMax:2*Math.PI,thetaMin:0,thetaMax:2*Math.PI};
const graphViewDefaults = {x:0,y:0,span:13,xSpan:0,ySpan:0};
const graphStateVersion = 2;
const graphRowLimit = 16;
const graphFileLimit = 64000;
const graphSavedLimit = 30;

function migrateGraphExpression(text) {
  const original = normalizeGraphExpression(text);
  function scan(source) {
    const pattern = /(?<![a-z_])(log|diff|root)\s*\(/g;
    let output = "", consumed = 0;
    for (const match of source.matchAll(pattern)) {
      if (match.index<consumed) continue;
      const start = match.index+match[0].length;
      let end = start, depth = 1;
      for (;end<source.length;end++) {
        if (source[end]==="(") depth++;
        if (source[end]===")" && --depth===0) break;
      }
      if (depth!==0) break;
      const inner = source.slice(start,end);
      const pieces = graphSplit(inner,",").filter((_,index)=>index%2===0);
      const [body,variable,at] = pieces;
      const name = match[1];
      const changed = name==="log" && pieces.length===1 ? `log10(${scan(body)})`
        : name==="diff" && pieces.length===3 ? `at(diff(${scan(body)},${variable}),${variable},${scan(at)})`
          : name==="root" && pieces.length===2 ? `realroot(${scan(body)},${scan(variable)})`
          : match[0]+scan(inner)+")";
      output += source.slice(consumed,match.index)+changed;
      consumed = end+1;
    }
    return output+source.slice(consumed);
  }
  const converted = scan(original);
  return converted===original ? text : converted;
}

function graphStateFrom(value,strict=false) {
  if (!value || typeof value!=="object" || !Array.isArray(value.rows) || !value.rows.length ||
      (strict && (value.rows.length>graphRowLimit || ![1,graphStateVersion].includes(value.version)))) return null;
  const rows = value.rows.slice(0,graphRowLimit).flatMap(row=>{
    if (typeof row?.text!=="string" || (strict && row.text.length>graphTextLimit)) return [];
    const source = row.text.slice(0,graphTextLimit);
    const migrated = value.version===graphStateVersion ? source : migrateGraphExpression(source);
    return [{text:migrated,visible:row.visible!==false}];
  });
  if (!rows.length || strict && rows.length!==value.rows.length) return null;
  const sliders = Object.fromEntries(Object.entries(value.sliders || {}).filter(([key,parameter])=>
    graphVariableName.test(key) && Number.isFinite(parameter) && Math.abs(parameter)<=1e6));
  const {x,y,span,xSpan=0,ySpan=0} = value.view ?? {};
  const spanValid = size=>Number.isFinite(size) && size>=1e-4 && size<=1e7;
  const validView = [x,y].every(center=>Number.isFinite(center) && Math.abs(center)<=1e8) && spanValid(span) &&
    (xSpan===0 && ySpan===0 || spanValid(xSpan) && spanValid(ySpan));
  const {tMin,tMax,thetaMin,thetaMax} = value.settings ?? {};
  const validSettings = [tMin,tMax,thetaMin,thetaMax].every(bound=>Number.isFinite(bound) && Math.abs(bound)<=1e5) &&
    tMin<tMax && thetaMin<thetaMax;
  if (strict && (!validView || !validSettings)) return null;
  const view = validView ? {x,y,span,xSpan,ySpan} : {...graphViewDefaults};
  const settings = validSettings ? {tMin,tMax,thetaMin,thetaMax} : {...graphRangeDefaults};
  const options = {grid:value.options?.grid!==false,intersections:value.options?.intersections!==false,trace:value.options?.trace!==false};
  const title = typeof value.title==="string" ? value.title.trim().slice(0,60) : "";
  return {version:graphStateVersion,title,rows,sliders,view,settings,options};
}
