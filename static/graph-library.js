"use strict";

const graphExampleGroups = {
  all:["All","全部"],
  functions:["Functions","函数"],
  trigonometry:["Trigonometry","三角函数"],
  geometry:["Conics & regions","圆锥曲线与区域"],
  curves:["Polar & parametric","极坐标与参数曲线"],
  calculus:["Calculus","微积分"],
  data:["Data & geometry","数据与几何"],
};

const graphExamples = [
  {id:"line",group:"functions",title:["Slope and intercept","直线的斜率和截距"],rows:["y = m*x + b"],params:{m:0.75,b:1.5},span:9},
  {id:"parabola",group:"functions",title:["Moving a parabola","平移抛物线"],rows:["y = 0.55*x²","y = 0.55*(x-h)² + k","(h,k)"],params:{h:2,k:-1},span:10},
  {id:"reflection",group:"functions",title:["Exponential and inverse","指数函数及其反函数"],rows:["y = exp(x)","y = ln(x)","y = x"],span:8},
  {id:"piecewise",group:"functions",title:["Piecewise ramp","分段斜坡"],rows:["y = 0 {x<0}","y = x {0≤x≤3}","y = 3 {x>3}"],span:9,y:0.6},
  {id:"sliders",group:"trigonometry",title:["Sine waves with sliders","可调的正弦曲线"],rows:["y = a*sin(b*x)","y = a*sin(b*x) + c"],params:{a:1,b:1,c:2},span:8},
  {id:"beats",group:"trigonometry",title:["Beats from two waves","两列波形成的拍频"],rows:["y = sin(3*x)+sin(3.5*x)","y = 2*cos(x/4)","y = -2*cos(x/4)"],span:8},
  {id:"unit",group:"trigonometry",title:["Angle on the unit circle","单位圆上的角度"],rows:["x²+y² = 1","segment((0,0),(cos(a),sin(a)))","(cos(a),sin(a))"],params:{a:0.85},span:3.5},
  {id:"ellipse",group:"geometry",title:["Ellipse and its foci","椭圆和两个焦点"],rows:["x²/16 + y²/7 = 1","(-3,0)","(3,0)"],span:10},
  {id:"hyperbola",group:"geometry",title:["Hyperbola and asymptotes","双曲线和渐近线"],rows:["x²/4-y²/2 = 1","y = x/sqrt(2)","y = -x/sqrt(2)"],span:9},
  {id:"lens",group:"geometry",title:["A shaded lens","透镜形阴影区域"],rows:["x²-2 ≤ y ≤ 2-x²","y = x²-2","y = 2-x²"],span:8},
  {id:"circles",group:"geometry",title:["Overlapping disks","两个重叠的圆盘"],rows:["(x+1.2)²+y² ≤ 6.25","(x-1.2)²+y² < 6.25"],span:9},
  {id:"rose",group:"curves",title:["Five-petal rose","五瓣玫瑰线"],rows:["r = 3*cos(5*θ)"],span:7.5},
  {id:"spiral",group:"curves",title:["Archimedean spiral","阿基米德螺线"],rows:["r = θ/4"],settings:{thetaMax:6*Math.PI},span:11},
  {id:"cardioid",group:"curves",title:["Polar cardioid","极坐标心形线"],rows:["r = 1.7*(1-sin(θ))"],span:8,y:-0.5},
  {id:"lissajous",group:"curves",title:["Lissajous figure","利萨茹曲线"],rows:["(3*sin(3*t+π/4), 2.3*sin(2*t))"],span:7.5},
  {id:"cycloid",group:"curves",title:["Cycloid from a rolling wheel","滚动圆生成的摆线"],rows:["(t-sin(t), 1-cos(t))"],settings:{tMax:4*Math.PI},span:9,x:6.3,y:1},
  {id:"tangent",group:"calculus",title:["A tangent you can move","可移动的切线"],rows:["f(x) = sin(x)+0.25*x","y = f(a) + at(diff(f(x),x),x,a)*(x-a)","(a,f(a))"],params:{a:0.8},span:8},
  {id:"derivative",group:"calculus",title:["A cubic and its derivative","三次函数及其导数"],rows:["f(x) = x³/5 - x","y = diff(f(x), x)"],span:8},
  {id:"accumulation",group:"calculus",title:["Accumulating a sine wave","正弦函数的累积积分"],rows:["y = sin(x)","y = ∫(sin(t),t,0,x)","0 ≤ y ≤ sin(x) {0≤x≤π}"],span:7,y:0.5},
  {id:"taylor",group:"calculus",title:["Taylor approximation","正弦函数的泰勒近似"],rows:["y = sin(x)","y = ∑((-1)^n*x^(2*n+1)/(2*n+1)!, n, 0, 3)"],span:6.5},
  {id:"series",group:"calculus",title:["Partial sums of a series","级数部分和"],rows:["sequence(sum(1/k²,k,1,n),1,18)","y = π²/6"],span:13,x:9,y:1.2},
  {id:"regression",group:"data",title:["Scatter and least-squares line","散点与最小二乘拟合"],rows:["regression((0,0.8),(1,2.7),(2,2.3),(3,4.9),(4,4.5),(5,6.2))"],span:9,x:2.5,y:3.4},
  {id:"histogram",group:"data",title:["Histogram with adjustable bins","可调组距的直方图"],rows:["histogram([0.4,1.2,1.9,2.3,2.4,2.8,3.1,3.2,3.7,3.9,4.4,4.7,5.2],w)"],params:{w:1},span:8,x:3,y:2},
  {id:"box",group:"data",title:["Spread and quartiles","数据分布和四分位数"],rows:["boxplot([1,2,2,3,4,5,5,8,9])"],span:8,x:5,y:1},
  {id:"dots",group:"data",title:["Stacked dot plot","堆叠点图"],rows:["dotplot([1,1,2,3,3,3,4,4,5,5,5,5,7])"],span:7,x:4,y:2.1},
  {id:"bell",group:"data",title:["Normal density and its spread","正态分布与标准差"],rows:["y = normalpdf(x,0,0.7)","y = normalpdf(x,0,1.6)"],span:2.5,y:0.4},
  {id:"binomial",group:"data",title:["Binomial probabilities (%)","二项分布的概率（%）"],rows:["sequence(100*binomialpmf(n,12,0.4),0,12)"],span:30,x:6,y:12},
  {id:"polygon",group:"data",title:["Polygon and diagonals","多边形与对角线"],rows:["polygon((-3,-1),(-1,2),(2,2),(3,-1),(0,-2))","segment((-3,-1),(2,2))","segment((-1,2),(3,-1))","midpoint((-3,-1),(2,2))"],span:7.5},
];

const graphFunctionKeys = names => names.split(" ").map(name=>[name,name+"()"]);
const graphKeyGroups = {
  basic:{name:["Common symbols","常用符号"],keys:[
    "x","y","t","θ","π","e",["x²","^2"],["xʸ","^"],["√","sqrt()"],["|x|","abs()"],
    "+",["−","-"],["×","*"],["÷","/"],"=",".",",",["( )","()"],"(",")",["[ ]","[]"],["{ }","{}"],"!",
  ]},
  variables:{name:["Letters & variables","字母与变量"],keys:[..."abcdefghijklmnopqrstuvwxyz","θ","π","_"]},
  trig:{name:["Trigonometry","三角与双曲函数"],keys:[
    ...graphFunctionKeys("sin cos tan sec csc cot"),
    ["sin⁻¹","asin()"],["cos⁻¹","acos()"],["tan⁻¹","atan()"],["sec⁻¹","asec()"],["csc⁻¹","acsc()"],["cot⁻¹","acot()"],
    ...graphFunctionKeys("atan2 sinh cosh tanh sech csch coth asinh acosh atanh"),
  ]},
  functions:{name:["Powers & logs","幂、根式与对数"],keys:[
    ...graphFunctionKeys("exp ln log log10"),["logₐ","log(□, a)"],["eˣ","exp()"],["10ˣ","10^(□)"],
    ["¹⁄ₓ","1/(□)"],["√","sqrt()"],["∛","cbrt()"],["ⁿ√","root(□, n)"],["realroot","realroot(□, n)"],["|x|","abs()"],
  ]},
  relations:{name:["Relations & ranges","关系与范围"],keys:[
    "=","<","≤",">","≥",["{ }","{□}"],["x range","{a ≤ x ≤ b}"],["f(x)","f(□)"],["r =","r = "],["(x, y)","(□, )"],
  ]},
  calculus:{name:["Calculus & series","微积分与级数"],keys:[
    ["d/dx","diff(□, x)"],["dⁿ/dxⁿ","diff(□, x, 2)"],["f′(a)","at(diff(□, x), x, a)"],["∫","integrate(□, t, 0, x)"],
    ["∑","sum(□, n, 1, 10)"],["∏","prod(□, n, 1, 5)"],["sequence","sequence(□, 1, 20)"],
  ]},
  stats:{name:["Statistics","统计"],keys:[
    ...graphFunctionKeys("mean median min max total count var varp stdev stdevp"),
    ["quantile","quantile(p, □)"],["histogram","histogram([□], w)"],["dotplot","dotplot([□])"],
    ["boxplot","boxplot([□])"],["regression","regression((□, ), (, ))"],
  ]},
  distributions:{name:["Distributions","概率分布"],keys:[
    ["normal PDF","normalpdf(□, 0, 1)"],["uniform PDF","uniformpdf(□, -2, 2)"],
    ["binomial PMF","binomialpmf(□, 12, 0.5)"],["Poisson PMF","poissonpmf(□, 4)"],
  ]},
  shapes:{name:["Points & geometry","点集与几何"],keys:[
    ["(x, y)","(□, )"],["points","points((□, ), (, ))"],["polyline","polyline((□, ), (, ))"],
    ["polygon","polygon((□, ), (, ), (, ))"],["segment","segment((□, ), (, ))"],
    ["midpoint","midpoint((□, ), (, ))"],["distance","distance(□, , , )"],
  ]},
  integers:{name:["Number theory","数论与取整"],keys:[
    ...graphFunctionKeys("floor ceil round sign"),["⌊x⌋","floor()"],["⌈x⌉","ceil()"],
    ...["mod","gcd","lcm","nPr","nCr"].map(name=>[name,name.toLowerCase()+"(□, )"]),"!",
  ]},
};
