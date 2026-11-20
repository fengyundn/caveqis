"use strict";

function sample(en, zh, expression, fields = {}, latex) {
  return {label: {en, zh}, latex, data: {expression, ...fields}};
}

function matrixSample(en, zh, matrixA, fields = {}) {
  return {label: {en, zh}, data: {matrixA, ...fields}};
}

function matrixEquationSample(en, zh, equation, unknown, matrices) {
  return sample(en, zh, equation, {matrixEquation:JSON.stringify({equation, unknown, matrices})});
}

const calculationExamples = {
  calculate: {
    evaluate: [sample("Exact fractions and radicals", "精确分数与根式", "1/3 + sqrt(2) + log(8,2)")],
    simplify: [sample("Simplify a rational expression", "化简有理式", "(x^2+2*x+1)/(x+1)")],
    expand: [sample("Expand a polynomial", "展开多项式", "(2*x-y)^4")],
    factor: [sample("Factor a cubic", "分解三次多项式", "x^3-6*x^2+11*x-6")],
    cancel: [sample("Cancel common factors", "约去公因子", "(x^2-4)/(x-2)")],
    trigsimp: [sample("Use a trigonometric identity", "应用三角恒等式", "sin(x)^2+cos(x)^2")],
  },
  determinant: {
    det: [matrixSample("Determinant with a parameter", "含参数的行列式", "a, 2\n3, a"), matrixSample("Evaluate a 3×3 determinant", "计算三阶行列式", "2, 0, 1\n3, -1, 2\n1, 4, 0"), matrixSample("Check a zero determinant", "验证行列式为零", "1, 3\n2, 6")],
    minor: [matrixSample("Minor at row 1, column 2", "第 1 行第 2 列的余子式", "1, 2, 3\n0, 4, 5\n2, 6, 7", {row:"1", column:"2"})],
    cofactor: [matrixSample("Cofactor with a negative sign", "带负号的代数余子式", "3, 1, 2\n4, 2, 1\n0, 5, 6", {row:"2", column:"1"})],
    expand_row: [matrixSample("Expand along a row containing zeros", "沿含零元素的行展开", "1, 3, 2\n0, 4, 0\n2, 1, 5", {row:"2"})],
    expand_column: [matrixSample("Expand along the third column", "沿第 3 列展开", "3, 1, 0\n2, 4, 0\n1, 5, -2", {column:"3"})],
    transpose: [matrixSample("Determinant after transposition", "转置后的行列式", "5, 7\n2, 1")],
    product: [matrixSample("Determinant of a product AB", "乘积 AB 的行列式", "1, 0\n2, 3", {matrixB:"4, 2\n0, 1"})],
    scale: [matrixSample("Determinant after scaling every entry", "各元素乘同一数后的行列式", "3, 2\n1, 4", {scalar:"1/2"})],
    power: [matrixSample("Determinant of a matrix cubed", "矩阵三次幂的行列式", "6, 1\n2, 3", {power:"3"})],
    inverse: [matrixSample("Determinant of an inverse", "逆矩阵的行列式", "4, 1\n2, 2")],
    formula: [sample("Add and divide determinant values", "行列式值相加与相除", "det([2,1],[1,2])+det([4,1],[2,3])/2")],
  },
  matrix: {
    add: [matrixSample("Add same-size matrices", "同尺寸矩阵相加", "1, 3\n2, 4", {matrixB: "-1, 0\n3, 2"})],
    subtract: [matrixSample("Subtract a diagonal matrix", "减去对角矩阵", "4, 1\n3, 2", {matrixB: "2, 0\n0, 1"})],
    multiply: [matrixSample("Multiply rectangular matrices", "矩形矩阵相乘", "1, 2, 3\n4, 5, 6", {matrixB: "1, 0\n0, 1\n2, 1"})],
    divide: [matrixSample("Multiply by an inverse on the right", "右乘逆矩阵", "3, 5\n7, 9", {matrixB: "2, 1\n0, 1"})],
    scale: [matrixSample("Scale a matrix by a fraction", "矩阵乘分数", "2, -4\n6, 8", {scalar: "1/2"})],
    power: [matrixSample("Raise a matrix to a power", "计算矩阵的幂", "1, 1\n0, 1", {power: "4"})],
    inverse: [matrixSample("Invert a nonsingular matrix", "计算非奇异矩阵的逆", "2, 1\n5, 3")],
    transpose: [matrixSample("Transpose a rectangular matrix", "矩形矩阵转置", "1, 0, -1\n2, 3, 4")],
    adjoint: [matrixSample("Conjugate transpose of a complex matrix", "复矩阵的共轭转置", "1+I, 2\n3*I, -I")],
    rank: [matrixSample("Rank with dependent rows", "含线性相关行的秩", "1, 2, 4\n2, 4, 8\n0, 1, 2")],
    trace: [matrixSample("Sum the diagonal entries", "求对角线元素之和", "7, 1, 2\n0, -3, 4\n0, 0, 5")],
    rref: [matrixSample("Reduce an augmented matrix", "增广矩阵的行最简形", "2, 1, 5\n1, -1, 1")],
    eigen: [matrixSample("Eigenvalues and eigenvectors", "特征值与特征向量", "2, 1\n1, 2")],
    charpoly: [matrixSample("Characteristic polynomial", "求特征多项式", "0, 1\n-2, 3")],
    nullspace: [matrixSample("Basis of the null space", "求零空间的一组基", "1, -1, 2\n2, -2, 4")],
    lu: [matrixSample("LU decomposition with a row swap", "需要换行的 LU 分解", "0, 2\n3, 4")],
    hadamard: [matrixSample("Elementwise matrix product", "矩阵逐元素乘积", "1, 2\n-1, 3", {matrixB: "4, 0\n2, 5"})],
  },
  integral: {
    indefinite: [sample("Integration by parts", "分部积分", "x*exp(x)", {variables: "x"}, String.raw`\int x e^x\,dx`)],
    definite: [sample("Area under a polynomial", "多项式的定积分", "x^2+1", {variables: "x", lower: "0", upper: "2"}, String.raw`\int_0^2(x^2+1)\,dx`), sample("Gaussian improper integral", "高斯反常积分", "exp(-x^2)", {variables: "x", lower: "-oo", upper: "oo"}, String.raw`\int_{-\infty}^{\infty}e^{-x^2}\,dx`)],
    multiple: [
      sample("Double integral on a triangle", "三角形区域上的二重积分", "x+y", {bounds: "x,0,y\ny,0,1"}, String.raw`\int_0^1\int_0^y(x+y)\,dx\,dy`),
      sample("Double integral on a rectangle", "矩形区域上的二重积分", "x*y", {bounds: "x,0,2\ny,1,3"}, String.raw`\int_1^3\int_0^2xy\,dx\,dy`),
      sample("Triple integral on a box", "长方体上的三重积分", "x+y+z", {bounds: "z,0,1\ny,0,2\nx,0,3"}, String.raw`\int_0^3\int_0^2\int_0^1(x+y+z)\,dz\,dy\,dx`),
    ],
    formula: [sample("Definite integral template", "定积分符号模板", "∫(sin(t),t,0,pi)", {}, String.raw`\int_0^\pi\sin(t)\,dt`)],
  },
  derivative: {
    differentiate: [sample("Differentiate a product", "对乘积求导", "x^2*sin(x)", {variables: "x", order: "1", substitutions:"x=pi/2"})],
    partial: [sample("Mixed partial derivative", "混合偏导", "x^3*y^2", {variables: "x:2,y:1", substitutions:"x=1; y=2"})],
    differential: [sample("Total differential in two variables", "二元函数的全微分", "x*y+sin(y)", {variables: "x,y", substitutions:"x=1; y=0"})],
    gradient: [sample("Gradient of a quadratic function", "二次函数的梯度", "x^2+3*y^2", {variables: "x,y", substitutions:"x=2; y=1"})],
    hessian: [sample("Hessian with a mixed term", "带交叉项的 Hessian", "x^2+x*y+y^2", {variables: "x,y", substitutions:"x=0; y=0"})],
    formula: [sample("Second derivative template", "二阶导数符号模板", "∂(sin(x),x,2)")],
  },
  analysis: {
    limit: [sample("Trigonometric limit at zero", "零点处的三角极限", "sin(x)/x", {variables: "x", point: "0", direction: "+-"}, String.raw`\lim_{x\to0}\frac{\sin x}{x}`), sample("One-sided limit of a logarithm", "对数的单侧极限", "log(x)", {variables:"x", point:"0", direction:"+"}), sample("Rational function at infinity", "有理函数在无穷远处的极限", "(3*x^2+1)/(2*x^2-x)", {variables:"x", point:"oo", direction:"+-"})],
    formula: [sample("Evaluate a left-hand limit from notation", "用符号模板求左极限", "lim(abs(t)/t,t,0,-1)")],
  },
  series: {
    series: [sample("Taylor expansion of the exponential", "指数函数的 Taylor 展开", "exp(x)", {variables: "x", point: "0", order: "6"})],
    summation: [sample("Finite harmonic sum", "有限调和和", "1/n", {variables: "n", lower: "1", upper: "5"}, String.raw`\sum_{n=1}^{5}\frac1n`), sample("Infinite series of reciprocal squares", "平方倒数无穷级数", "1/n^2", {variables: "n", lower: "1", upper: "oo"}, String.raw`\sum_{n=1}^{\infty}\frac1{n^2}`), sample("Geometric series", "几何级数", "(1/2)^n", {variables: "n", lower: "0", upper: "oo"}, String.raw`\sum_{n=0}^{\infty}(\tfrac12)^n`)],
    formula: [sample("Series expansion from a template", "用模板展开级数", "series(cos(x),x,0,8)")],
  },
  equations: {
    equation_auto: [
      sample("Combine an integral, derivative, limit and sum", "混合积分、导数、极限和求和", "∫(t,t,0,2)+∂(x^2,x)+lim(sin(t)/t,t,0)+∑(n,n,1,3)=15", {}, String.raw`\int_0^2t\,dt+\frac{d}{dx}x^2+\lim_{t\to0}\frac{\sin t}{t}+\sum_{n=1}^3n=15`),
      sample("Combine a determinant and an integral", "混合行列式和定积分", "det([x,2],[3,4])+∫(t,t,0,2)=12", {}, String.raw`\begin{vmatrix}x&2\\3&4\end{vmatrix}+\int_0^2t\,dt=12`),
      sample("Find a zero determinant", "求使行列式为零的参数", "det([x,1],[4,x])=0", {}, String.raw`\begin{vmatrix}x&1\\4&x\end{vmatrix}=0`),
      sample("Combine a truncated series and elementary functions", "混合截断级数和初等函数", "at(trunc(exp(t),t,0,3),t,1)+log(8,2)+sqrt(x)=15/2"),
    ],
    equation_solve: [sample("Solve a polynomial exactly", "精确求多项式的根", "x^3-6*x^2+11*x-6=0")],
    equation_linear: [sample("Solve two linear equations", "求解二元线性方程组", "2*x+y=5\nx-y=1", {}, String.raw`\begin{cases}2x+y=5\\x-y=1\end{cases}`)],
    equation_system: [sample("Intersect a circle and a line", "求圆与直线的交点", "x^2+y^2=1\nx-y=0")],
    equation_numeric: [sample("Find a root near a starting value", "用指定初值数值求根", "cos(x)=x\nguess: 1")],
    equation_matrix: [
      matrixEquationSample("Find the middle factor B", "在 ABC=D 中求中间的 B", "ABC=D", "B",
        {A:"1, 2\n0, 1", C:"2, 0\n1, 1", D:"24, 10\n10, 4"}),
      matrixEquationSample("Solve AX=B for a column vector", "在 AX=B 中求列向量 X", "AX=B", "X",
        {A:"3, 1\n1, 2", B:"7\n4"}),
      matrixEquationSample("Solve XA=B for the left factor", "在 XA=B 中求左边因子 X", "XA=B", "X",
        {A:"2, 0\n1, 1", B:"4, 2\n10, 4"}),
      matrixEquationSample("Solve with products on both sides", "等号两侧都是矩阵乘积", "U*X*V=P*Q", "X",
        {U:"1, 0\n0, 1\n1, 1", V:"1, 0, 1\n0, 1, 2", P:"1, 2\n3, 4\n4, 6", Q:"1, 0, 1\n0, 1, 2"}),
    ],
    equation_ode: [sample("Solve an ODE with an initial value", "求解带初值的常微分方程", "diff(y(x),x)=y(x)\ny(0)=1", {}, String.raw`y'=y,\quad y(0)=1`), sample("Second-order ODE", "二阶常微分方程", "diff(y(x),x,2)+y(x)=0\ny(0)=0\nat(diff(y(x),x),x,0)=1")],
    equation_integral: [sample("Volterra integral equation", "Volterra 积分方程", "y(x)=1+integrate(y(t),t,0,x)", {}, String.raw`y(x)=1+\int_0^x y(t)\,dt`)],
  },
};
