"use strict";

const graphPalette = ["#6458df","#008374","#d05548","#ad4d91","#356fc0","#a46a16","#578633","#5d6891"];
const graphDarkPalette = ["#a99aff","#61d7c5","#ff8d7a","#f39bd2","#8abdff","#efbb60","#a5cf74","#b5bee6"];

function graphProjection(width,height,view) {
  const scale = Math.min(width,height) / view.span;
  const scaleX = view.xSpan ? width/view.xSpan : scale;
  const scaleY = view.ySpan ? height/view.ySpan : scale;
  const toScreen = (x,y) => [width/2+(x-view.x)*scaleX,height/2-(y-view.y)*scaleY];
  const toWorld = (x,y) => [view.x+(x-width/2)/scaleX,view.y-(y-height/2)/scaleY];
  return {width,height,scaleX,scaleY,toScreen,toWorld};
}

function graphDisplayNumber(value, digits=7) {
  return Number.isFinite(value) ? String(Number(value.toPrecision(digits))) : "—";
}

function graphGrid(ctx, projection, colors, grid) {
  const {width,height,scaleX,scaleY,toScreen,toWorld} = projection;
  const [xmin,ymax] = toWorld(0,0), [xmax,ymin] = toWorld(width,height);
  const [ox,oy] = toScreen(0,0);
  const stepFor = scale => {
    const rough = 76/scale;
    const base = 10**Math.floor(Math.log10(rough));
    return base * ([1,2,5,10].find(factor=>factor>=rough/base) || 10);
  };
  const stepX = stepFor(scaleX), stepY = stepFor(scaleY);
  ctx.fillStyle = colors.background;
  ctx.fillRect(0,0,width,height);
  ctx.lineWidth = 1;
  ctx.font = '11px "Segoe UI", system-ui, sans-serif';
  ctx.textBaseline = "middle";
  ctx.fillStyle = colors.labels;

  const lines = (spacingX,spacingY,stroke,label) => {
    ctx.beginPath();
    ctx.strokeStyle = stroke;
    for (let i=Math.ceil(xmin/spacingX);i<=Math.floor(xmax/spacingX);i++) {
      if (i === 0) continue;
      const [x] = toScreen(i*spacingX,0);
      ctx.moveTo(x,0); ctx.lineTo(x,height);
      if (label && x>15 && x<width-12) {
        ctx.textAlign = "center";
        ctx.fillText(graphDisplayNumber(i*spacingX,5),x,Math.max(13,Math.min(height-12,oy+13)));
      }
    }
    for (let i=Math.ceil(ymin/spacingY);i<=Math.floor(ymax/spacingY);i++) {
      if (i === 0) continue;
      const [,y] = toScreen(0,i*spacingY);
      ctx.moveTo(0,y); ctx.lineTo(width,y);
      if (label && y>10 && y<height-22) {
        const text = graphDisplayNumber(i*spacingY,5);
        ctx.textAlign = "left";
        ctx.fillText(text,Math.max(6,Math.min(width-ctx.measureText(text).width-5,ox+7)),y);
      }
    }
    ctx.stroke();
  };
  if (grid) lines(stepX/5,stepY/5,colors.minor,false);
  lines(stepX,stepY,grid?colors.major:"transparent",true);
  ctx.beginPath();
  ctx.strokeStyle = colors.axes;
  ctx.lineWidth = 1.2;
  ctx.moveTo(0,oy); ctx.lineTo(width,oy);
  ctx.moveTo(ox,0); ctx.lineTo(ox,height);
  ctx.stroke();
  ctx.fillStyle = colors.labels;
  ctx.textAlign = "right";
  ctx.fillText("x",width-9,Math.max(12,Math.min(height-24,oy-11)));
  ctx.textAlign = "left";
  ctx.fillText("y",Math.max(5,Math.min(width-13,ox+7)),13);
}

function graphCoordinate(scope, plot, value) {
  let x, y;
  if (plot.kind === "y" || plot.kind === "x") {
    scope.x = plot.kind === "y" ? value : NaN;
    scope.y = plot.kind === "x" ? value : NaN;
    scope[plot.variable] = value;
    const answer = plot.evaluate(scope);
    x = plot.kind === "y" ? value : answer;
    y = plot.kind === "y" ? answer : value;
  } else if (plot.kind === "parametric" || plot.kind === "point") {
    scope.x = scope.y = NaN;
    scope.t = value;
    x = plot.x(scope);
    y = plot.y(scope);
  } else {
    scope.x = scope.y = NaN;
    scope.theta = value;
    const radius = plot.evaluate(scope);
    scope.r = radius;
    x = radius * Math.cos(value);
    y = radius * Math.sin(value);
  }
  scope.x = x;
  scope.y = y;
  return Number.isFinite(x) && Number.isFinite(y) && plot.restrict(scope) ? [x,y] : null;
}

function graphSample(ctx, plot, projection, scope, settings, geometry, coarse=false) {
  if (plot.kind === "data") {
    drawGraphDataset(ctx,plot,projection,scope,geometry);
    return;
  }
  const {width,height,toWorld,toScreen} = projection;
  const [xmin,ymax] = toWorld(0,0), [xmax,ymin] = toWorld(width,height);
  const pixel = value => {
    const coordinate = graphCoordinate(scope,plot,value);
    const screen = coordinate && toScreen(...coordinate);
    return screen?.every(Number.isFinite) ? screen : null;
  };
  if (plot.kind === "point") {
    const point = pixel(0);
    if (!point) return;
    ctx.beginPath();
    ctx.arc(...point,4.5,0,Math.PI*2);
    ctx.fill();
    geometry.points.push(point);
    return;
  }
  const [min,max] = plot.kind === "y" ? [xmin,xmax] : plot.kind === "x" ? [ymin,ymax]
    : plot.kind === "polar" ? [settings.thetaMin,settings.thetaMax] : [settings.tMin,settings.tMax];
  const samples = Math.ceil(Math.max(coarse?100:240,Math.min(coarse?420:900,Math.max(width,height)/(coarse?4:2))));
  const tolerance = coarse ? 2.5 : 1;
  const depthLimit = coarse ? 3 : 6;
  const visible = screen => screen && screen.every(Number.isFinite) &&
    screen[0]>=-width && screen[0]<=2*width && screen[1]>=-height && screen[1]<=2*height;
  function strokeInterval(a,b,left,right,depth) {
    const mid = (a+b)/2;
    const center = pixel(mid);
    if (left && right && center) {
      const deviation = Math.hypot(center[0]-(left[0]+right[0])/2,center[1]-(left[1]+right[1])/2);
      if (deviation<=tolerance) {
        graphStroke(ctx,left,right,projection,geometry);
        return;
      }
      if (!visible(left) && !visible(center) && !visible(right)) {
        const sameOutside = left.every(Number.isFinite) && right.every(Number.isFinite) && center.every(Number.isFinite) &&
          [0,1].some(axis=>[left,center,right].every(point=>point[axis]<0) ||
            [left,center,right].every(point=>point[axis]>(axis===0?width:height)));
        if (sameOutside) return;
      }
    }
    if (depth>=depthLimit || !left && !right && !center) return;
    strokeInterval(a,mid,left,center,depth+1);
    strokeInterval(mid,b,center,right,depth+1);
  }
  let previous = pixel(min);
  let prior = min;
  ctx.beginPath();
  for (let index=1;index<=samples;index++) {
    const t = min+(max-min)*(index/samples);
    const next = pixel(t);
    strokeInterval(prior,t,previous,next,0);
    previous = next;
    prior = t;
  }
  ctx.stroke();
}

function drawGraphDataset(ctx, plot, projection, scope, geometry) {
  const data = plot.read(scope);
  const {toScreen,toWorld,width} = projection;
  const point = (x,y) => {
    const screen = toScreen(x,y);
    if (screen.some(value=>!Number.isFinite(value))) return;
    ctx.beginPath(); ctx.arc(...screen,3.6,0,2*Math.PI); ctx.fill();
    geometry.points.push(screen);
  };
  const line = (a,b) => graphStroke(ctx,toScreen(...a),toScreen(...b),projection,geometry);
  const fill = () => { ctx.save(); ctx.globalAlpha = 0.16; ctx.fill(); ctx.restore(); };
  if (plot.style==="histogram") {
    const binWidth = data.at(-1);
    if (!(binWidth>0) || !data.every(Number.isFinite)) return;
    const counts = new Map();
    for (const value of data.slice(0,-1)) {
      const ratio = value/binWidth, nearest = Math.round(ratio);
      const bin = Math.abs(ratio-nearest)<=2*Number.EPSILON*Math.abs(ratio) ? nearest : Math.floor(ratio);
      if (!Number.isSafeInteger(bin)) return;
      counts.set(bin,(counts.get(bin) ?? 0)+1);
    }
    for (const [bin,count] of counts) {
      const [left,top] = toScreen(bin*binWidth,count);
      const [right,base] = toScreen((bin+1)*binWidth,0);
      if (![left,top,right,base].every(Number.isFinite)) continue;
      ctx.beginPath(); ctx.rect(left,top,right-left,base-top); fill();
      ctx.beginPath();
      line([bin*binWidth,0],[bin*binWidth,count]);
      line([bin*binWidth,count],[(bin+1)*binWidth,count]);
      line([(bin+1)*binWidth,count],[(bin+1)*binWidth,0]); ctx.stroke();
    }
    return;
  }
  if (plot.style==="dotplot") {
    if (!data.every(Number.isFinite)) return;
    const counts = new Map();
    for (const value of data) {
      const count = (counts.get(value) ?? 0)+1;
      counts.set(value,count);
      point(value,count);
    }
    return;
  }
  if (plot.style==="boxplot") {
    if (!data.every(Number.isFinite)) return;
    const [low,q1,median,q3,high] = [0,0.25,0.5,0.75,1].map(p=>graphQuantile(data,p));
    const [left,top] = toScreen(q1,1.35), [right,bottom] = toScreen(q3,0.65);
    if (![left,top,right,bottom].every(Number.isFinite)) return;
    ctx.beginPath(); ctx.rect(left,top,right-left,bottom-top); fill();
    ctx.beginPath();
    line([low,1],[q1,1]); line([q3,1],[high,1]);
    line([low,0.83],[low,1.17]); line([high,0.83],[high,1.17]);
    line([q1,0.65],[q3,0.65]); line([q1,1.35],[q3,1.35]);
    for (const x of [q1,median,q3]) line([x,0.65],[x,1.35]);
    ctx.stroke();
    return;
  }
  if (data.some(pair=>!pair.every(Number.isFinite))) return;
  if (plot.style==="midpoint") {
    point(data[0][0]/2+data[1][0]/2,data[0][1]/2+data[1][1]/2);
    return;
  }
  if (plot.style==="regression") {
    const meanX = graphTotal(data.map(pair=>pair[0]))/data.length;
    const meanY = graphTotal(data.map(pair=>pair[1]))/data.length;
    const sumSquares = graphTotal(data.map(([x])=>(x-meanX)**2));
    const slope = graphTotal(data.map(([x,y])=>(x-meanX)*(y-meanY)))/sumSquares;
    const [left] = toWorld(0,0), [right] = toWorld(width,0);
    ctx.beginPath();
    line([left,meanY+slope*(left-meanX)],[right,meanY+slope*(right-meanX)]);
    ctx.stroke();
  }
  if (["polyline","polygon","segment"].includes(plot.style)) {
    const polygon = plot.style==="polygon";
    const screen = data.map(pair=>toScreen(...pair));
    if (polygon && screen.every(pair=>pair.every(Number.isFinite))) {
      ctx.beginPath(); ctx.moveTo(...screen[0]);
      for (const coordinate of screen.slice(1)) ctx.lineTo(...coordinate);
      ctx.closePath(); fill();
    }
    ctx.beginPath();
    for (let i=1;i<data.length;i++) line(data[i-1],data[i]);
    if (polygon) line(data.at(-1),data[0]);
    ctx.stroke();
  }
  for (const pair of data) point(...pair);
}

function graphStroke(ctx, a, b, {width,height}, geometry) {
  if (a.some(value=>!Number.isFinite(value)) || b.some(value=>!Number.isFinite(value))) return;
  if ((a[0]<0 && b[0]<0) || (a[1]<0 && b[1]<0) || (a[0]>width && b[0]>width) || (a[1]>height && b[1]>height)) return;
  const clamp = point => [Math.max(-width*10,Math.min(width*11,point[0])),Math.max(-height*10,Math.min(height*11,point[1]))];
  const start = clamp(a), end = clamp(b);
  ctx.moveTo(...start);
  ctx.lineTo(...end);
  geometry.segments.push([start,end]);
}

function graphImplicit(ctx, plot, projection, scope, spacing, geometry) {
  const {width,height,toWorld} = projection;
  const cols = Math.ceil(width/spacing), rows = Math.ceil(height/spacing);
  const dx = width/cols, dy = height/rows;
  const shading = plot.operator !== "=";
  const side = plot.operator.startsWith("<") ? -1 : 1;
  const values = Array.from({length:rows+1},(_,j)=>Array.from({length:cols+1},(_,i)=>{
    [scope.x,scope.y] = toWorld(i*dx,j*dy);
    return plot.restrict(scope) ? plot.evaluate(scope)*side : NaN;
  }));
  const threshold = (a,b) => {
    const portion = a[2]/(a[2]-b[2]);
    return [a[0]+portion*(b[0]-a[0]),a[1]+portion*(b[1]-a[1])];
  };
  const boundaries = [];
  if (shading) ctx.beginPath();
  for (let j=0;j<rows;j++) for (let i=0;i<cols;i++) {
    const tl = [i*dx,j*dy,values[j][i]], tr = [(i+1)*dx,j*dy,values[j][i+1]];
    const bl = [i*dx,(j+1)*dy,values[j+1][i]], br = [(i+1)*dx,(j+1)*dy,values[j+1][i+1]];
    for (const triangle of [[tl,tr,br],[tl,br,bl]]) {
      if (!triangle.every(point=>Number.isFinite(point[2]))) continue;
      const inside = point => plot.operator.length === 1 && shading ? point[2]>0 : point[2]>=0;
      const polygon = [], crossing = [];
      for (let k=0;k<3;k++) {
        const start = triangle[k], end = triangle[(k+1)%3];
        if (inside(start)) polygon.push(start.slice(0,2));
        if (inside(start) !== inside(end)) {
          const point = threshold(start,end);
          crossing.push(point);
          polygon.push(point);
        }
      }
      if (crossing.length === 2) boundaries.push(crossing);
      if (shading && polygon.length>=3) {
        ctx.moveTo(...polygon[0]);
        for (const point of polygon.slice(1)) ctx.lineTo(...point);
        ctx.closePath();
      }
    }
  }
  if (shading) {
    ctx.save(); ctx.globalAlpha = 0.14; ctx.fill(); ctx.restore();
  }
  const drawBoundaries = (edges,dashed) => {
    ctx.beginPath();
    ctx.setLineDash(dashed ? [5,4] : []);
    for (const [a,b] of edges) graphStroke(ctx,a,b,projection,geometry);
    ctx.stroke();
  };
  if (plot.dashed) {
    const [solid,dashed] = [[],[]];
    for (const edge of boundaries) {
      const [a,b] = edge;
      [scope.x,scope.y] = toWorld((a[0]+b[0])/2,(a[1]+b[1])/2);
      (plot.dashed(scope) ? dashed : solid).push(edge);
    }
    drawBoundaries(solid,false); drawBoundaries(dashed,true);
  } else drawBoundaries(boundaries,plot.operator === "<" || plot.operator === ">");
  ctx.setLineDash([]);
}

function graphIntersections(plots, projection, scope, annotated=false) {
  const {width,height,toScreen,toWorld} = projection;
  const [left] = toWorld(0,0), [right] = toWorld(width,0);
  const functions = plots.filter(plot=>plot.kind==="y").slice(0,10);
  const count = Math.ceil(Math.min(width,650)/2);
  const points = [];
  const add = (x,y,kind) => {
    const point = toScreen(x,y);
    if (!point.every(Number.isFinite) || point[0]<0 || point[0]>width || point[1]<0 || point[1]>height) return;
    const existing = points.find(old=>Math.hypot(point[0]-old.screen[0],point[1]-old.screen[1])<7);
    if (existing) {
      if (!existing.kinds.includes(kind)) existing.kinds.push(kind);
    } else points.push({screen:point,x,y,kinds:[kind]});
  };
  const sample = functions.map(plot=>x=>graphCoordinate(scope,plot,x)?.[1] ?? NaN);
  const xs = Array.from({length:count+1},(_,i)=>left+(right-left)*i/count);
  const samples = sample.map(fn=>xs.map(fn));
  for (let a=0;a<sample.length && points.length<32;a++) {
    if (left<=0 && right>=0) add(0,sample[a](0),"y-intercept");
    for (let b=-1;b<a && points.length<32;b++) {
      const difference = x => sample[a](x) - (b<0 ? 0 : sample[b](x));
      const sampled = i => samples[a][i] - (b<0 ? 0 : samples[b][i]);
      for (let i=1;i<=count && points.length<32;i++) {
        let low=xs[i-1], high=xs[i], dl=sampled(i-1), dh=sampled(i);
        if (!Number.isFinite(dl) || !Number.isFinite(dh) || (dl===0 && dh===0)) continue;
        let x;
        if (dl*dh>0) {
          const previous = i>1 ? sampled(i-2) : NaN;
          if (previous*dh<=0 || !Number.isFinite(previous) || Math.abs(dl)>=Math.min(Math.abs(previous),Math.abs(dh))) continue;
          low=xs[i-2];
          for (let j=0;j<26;j++) {
            const l=low+(high-low)/3, r=high-(high-low)/3;
            if (Math.abs(difference(l))<Math.abs(difference(r))) high=r;
            else low=l;
          }
          x=(low+high)/2;
        } else {
          for (let j=0;j<27;j++) {
            const center=(low+high)/2, value=difference(center);
            if (!Number.isFinite(value)) break;
            if (value*dl<=0) { high=center; dh=value; }
            else { low=center; dl=value; }
          }
          x=Math.abs(dl)<Math.abs(dh) ? low : high;
        }
        const y=sample[a](x), other=b<0?0:sample[b](x);
        if (Math.abs(y-other)<1e-6*Math.max(1,Math.abs(y))) add(x,b<0?0:(y+other)/2,b<0?"root":"intersection");
      }
    }
  }
  if (annotated) {
    for (let a=0;a<sample.length && points.length<48;a++) {
      const values = samples[a], fn = sample[a];
      for (let i=1;i<count && points.length<48;i++) {
        const [before,value,after] = values.slice(i-1,i+2);
        if (![before,value,after].every(Number.isFinite)) continue;
        const maximum = value>before && value>=after || value>=before && value>after;
        const minimum = value<before && value<=after || value<=before && value<after;
        if ((!maximum && !minimum) || Math.abs(after-before)+Math.abs(value-before)<1e-10) continue;
        // Flat steps have many equal samples and are not isolated extrema.
        if (before===value && values[i-2]===value || after===value && values[i+2]===value) continue;
        const direction = maximum ? 1 : -1;
        let low = xs[i-1], high = xs[i+1];
        for (let j=0;j<28;j++) {
          const l = low+(high-low)/3, r = high-(high-low)/3;
          if (direction*fn(l)>direction*fn(r)) high=r;
          else low=l;
        }
        const x = (low+high)/2, y = fn(x);
        const delta = high-low;
        const nearby = [fn(x-delta),fn(x+delta)];
        if (nearby.every(v=>Number.isFinite(v) && Math.abs(v-y)<1e-5*Math.max(1,Math.abs(y)))) {
          add(x,y,maximum?"maximum":"minimum");
        }
      }
    }
  }
  return annotated ? points : points.map(point=>point.screen);
}
