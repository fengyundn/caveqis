const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const programs = ["graph-math.js","graph-canvas.js","graph-state.js","graph-library.js"].map(file=>fs.readFileSync(path.join(__dirname,"..","static",file),"utf8"));
const {compileGraphRows,graphCoordinate,graphProjection,graphSample,graphImplicit,graphIntersections,graphExamples,graphDatasetIssue,graphStateFrom} = vm.runInNewContext(
  programs.join("\n")+"\n({compileGraphRows,graphCoordinate,graphProjection,graphSample,graphImplicit,graphIntersections,graphExamples,graphDatasetIssue,graphStateFrom})"
);
const compile = (...expressions) => compileGraphRows(expressions.map(text=>({text,visible:true})));
const near = (a,b,tolerance=1e-6) => assert.ok(Math.abs(a-b)<tolerance,`${a} ≠ ${b}`);
const project = () => graphProjection(800,600,{x:0,y:0,span:12});

test("graph expressions support precedence, user functions, parameters and restrictions",()=>{
  const compilation=compile("a=2","f(x)=a*x²","y=f(x+1)-2^3^2","y=mx+b {-1≤x≤3}");
  assert.deepEqual([...compilation.parameters],["b","m"]);
  const scope={a:compilation.bindings.get("a"),m:3,b:2};
  assert.deepEqual([...graphCoordinate(scope,compilation.results[2].plot,2)],[2,-494]);
  assert.deepEqual([...graphCoordinate(scope,compilation.results[3].plot,1)],[1,5]);
  assert.equal(graphCoordinate(scope,compilation.results[3].plot,4),null);
  const invalid=compile("f(x)=g(x)","g(x)=f(x)","y=sin(");
  assert.ok(invalid.results.every(row=>row.error));
});

test("vertical, implicit, parametric and polar plots use the correct coordinates",()=>{
  const plots=compile("x=3","x²+y²≤9","(3cos(t),2sin(t))","r=2cos(3θ)","(1,-2)").results.map(row=>row.plot);
  assert.deepEqual([...plots].map(plot=>plot.kind),["x","implicit","parametric","polar","point"]);
  assert.deepEqual([...graphCoordinate({},plots[0],8)],[3,8]);
  near(plots[1].evaluate({x:3,y:0}),0);
  const ellipse=graphCoordinate({},plots[2],Math.PI/2);
  near(ellipse[0],0); near(ellipse[1],2);
  assert.deepEqual([...graphCoordinate({},plots[3],0)],[2,0]);
  assert.deepEqual([...graphCoordinate({},plots[4],0)],[1,-2]);
});

test("graph geometry follows a circle and does not bridge a rational pole",()=>{
  const [circle,rational]=compile("x²+y²=9","y=1/(x-0.013)").results.map(row=>row.plot);
  const projection=project();
  const ctx={beginPath(){},moveTo(){},lineTo(){},stroke(){},setLineDash(){}};
  const circleGeometry={segments:[],points:[]};
  graphImplicit(ctx,circle,projection,{},5,circleGeometry);
  assert.ok(circleGeometry.segments.length>50);
  for (const segment of circleGeometry.segments) for (const point of segment) {
    const [x,y]=projection.toWorld(...point);
    near(Math.hypot(x,y),3,0.003);
  }
  const rationalGeometry={segments:[],points:[]};
  graphSample(ctx,rational,projection,{}, {},rationalGeometry);
  const [pole]=projection.toScreen(0.013,0);
  assert.ok(rationalGeometry.segments.length>50);
  assert.ok(rationalGeometry.segments.every(([a,b])=>!(a[0]<pole && b[0]>pole)));
});

test("the crosshair geometry includes crossings, intercepts and tangent roots",()=>{
  const plots=compile("y=x²-2","y=x+1","y=(x-2.35)^2").results.map(row=>row.plot);
  const projection=project();
  const points=graphIntersections(plots,projection,{}).map(point=>projection.toWorld(...point));
  const has=(x,y)=>points.some(([a,b])=>Math.hypot(a-x,b-y)<1e-4);
  assert.ok(has(0,-2));
  assert.ok(has((1+Math.sqrt(13))/2,(3+Math.sqrt(13))/2));
  assert.ok(has(2.35,0));
});

test("calculus operators bind only their own variable and expose correct samples",()=>{
  const {results,parameters}=compile("f(x)=x^3+b","y=diff(f(x),x)","y=∫(t^2,t,0,x)","y=∑(n*x,n,1,3)",
    "y=∏(n+x,n,1,3)","y=diff(abs(x),x)","y=at(diff(sin(t),t),t,x)","y=mean([1,2,6])+ncr(6,2)");
  assert.ok(results.every(row=>!row.error),results.map(row=>row.error).join("; "));
  assert.deepEqual([...parameters],["b"]);
  for (const [i,x,y] of [[1,2,12],[2,3,9],[3,2,12],[4,1,24],[6,0,1],[7,0,18]]) {
    near(graphCoordinate({b:7},results[i].plot,x)[1],y);
  }
  assert.equal(graphCoordinate({},results[5].plot,0),null);
  assert.ok(compile("y=sum(sum(sum(1,k,1,30),m,1,30),n,1,30)").results[0].error);
});

test("each gallery expression compiles, draws geometry and has slider defaults",()=>{
  const ctx=Object.fromEntries("beginPath moveTo lineTo stroke setLineDash fill arc save restore closePath rect".split(" ").map(name=>[name,()=>{}]));
  for (const example of graphExamples) {
    const {results,parameters,bindings}=compile(...example.rows);
    assert.ok(results.every(row=>!row.error),example.id+": "+results.map(row=>row.error).join("; "));
    assert.ok(parameters.every(name=>Number.isFinite(example.params?.[name])),example.id+": "+parameters.join(", "));
    const settings={tMin:0,tMax:2*Math.PI,thetaMin:0,thetaMax:2*Math.PI,...example.settings};
    const projection=graphProjection(192,112,{x:example.x ?? 0,y:example.y ?? 0,span:example.span});
    for (const {source,plot} of results) {
      const scope={...Object.fromEntries(bindings),...example.params};
      const geometry={segments:[],points:[]};
      if (plot.kind==="implicit") graphImplicit(ctx,plot,projection,scope,4,geometry);
      else graphSample(ctx,plot,projection,scope,settings,geometry);
      assert.ok(geometry.segments.length+geometry.points.length>0,example.id+": "+source);
    }
  }
});

test("regression, binning and sequence plots evaluate the data they receive",()=>{
  const result=compile("regression((0,1),(1,a),(2,5))","histogram([0.2,0.4,1.5],1)","sequence(1/n,1,3)");
  const projection=project();
  const ctx=Object.fromEntries("beginPath moveTo lineTo stroke fill arc save restore rect".split(" ").map(name=>[name,()=>{}]));
  const draw=index=>{
    const geometry={segments:[],points:[]};
    graphSample(ctx,result.results[index].plot,projection,{a:3},{},geometry);
    return geometry;
  };
  for (const point of draw(0).segments[0]) {
    const [x,y]=projection.toWorld(...point);
    near(y,2*x+1);
  }
  const [,top]=draw(1).segments[0];
  near(projection.toWorld(...top)[1],2);
  const [,y]=projection.toWorld(...draw(2).points[2]);
  near(y,1/3);
});

test("graph semantics match calculation conventions while loading legacy drafts without changes in value",()=>{
  const current = compile("y=log(x)","y=diff(x^3,x,2)","y=正弦（ｘ）","幅度=3","y=幅度*x");
  assert.ok(current.results.every(row=>!row.error));
  near(graphCoordinate({},current.results[0].plot,100)[1],Math.log(100));
  near(graphCoordinate({},current.results[1].plot,3)[1],18,1e-5);
  near(graphCoordinate({},current.results[2].plot,Math.PI/2)[1],1);
  near(graphCoordinate(Object.fromEntries(current.bindings),current.results[4].plot,2)[1],6);
  const old = graphStateFrom({rows:[{text:"y=log(x)+diff(x^3,x,2)",visible:true}]});
  assert.equal(old.version,2);
  assert.equal(old.rows[0].text,"y=log10(x)+at(diff(x^3,x),x,2)");
  const {plot} = compileGraphRows(old.rows).results[0];
  near(graphCoordinate({},plot,100)[1],14);
  const oldRoot = graphStateFrom({rows:[{text:"y=root(x,3)",visible:true}]});
  near(graphCoordinate({},compileGraphRows(oldRoot.rows).results[0].plot,-8)[1],-2);
  assert.equal(graphCoordinate({},compile("y=root(x,3)").results[0].plot,-8),null);
  assert.equal(graphStateFrom({...old,version:42},true),null);
});

test("adaptive samples leave gaps at jumps and invalid data produce diagnostics",()=>{
  const {results}=compile("y=floor(x)","histogram([1,2],w)","regression((1,2),(1,3))","y=(x-1)^2-1");
  const ctx={beginPath(){},moveTo(){},lineTo(){},stroke(){}};
  const projection=graphProjection(780,520,{x:0,y:0,span:13});
  const geometry={points:[],segments:[]};
  graphSample(ctx,results[0].plot,projection,{}, {},geometry);
  assert.ok(geometry.segments.length>300);
  assert.ok(geometry.segments.every(([a,b])=>Math.abs(a[1]-b[1])<1e-8));
  assert.ok(graphDatasetIssue(results[1].plot,{w:0}));
  assert.equal(graphDatasetIssue(results[1].plot,{w:1}),"");
  assert.ok(graphDatasetIssue(results[2].plot,{}));
  const landmarks = graphIntersections([results[3].plot],projection,{},true);
  assert.ok(landmarks.some(point=>point.kinds.includes("minimum") && Math.abs(point.x-1)<1e-5 && Math.abs(point.y+1)<1e-5));
  const view = graphProjection(600,300,{x:2,y:3,span:13,xSpan:8,ySpan:2});
  assert.deepEqual([...view.toWorld(0,0)],[-2,4]);
  assert.deepEqual([...view.toWorld(600,300)],[6,2]);
});
