"use strict";

const englishText = {
  "图表":"Graphing", "坐标平面":"Coordinate plane", "图表视图工具":"Graph view tools", "交互坐标平面":"Interactive coordinate plane",
  "发送到图表":"Send to graph", "请在图表中留出足够的表达式位置，再发送结果。":"Free up expression slots in the graph and try again.",
  "拖动平移，可用滚轮或双指缩放":"Drag to pan · Scroll or pinch to zoom",
  "关键点":"Key points", "选择关键点":"Choose a point", "零点":"Root", "交点":"Intersection",
  "极大值":"Local maximum", "极小值":"Local minimum", "纵截距":"Y-intercept",
  "横轴下限":"X minimum", "横轴上限":"X maximum", "纵轴下限":"Y minimum", "纵轴上限":"Y maximum",
  "保存与导入":"Save & import", "图表名称":"Graph name", "保存当前图表":"Save current graph",
  "导出图表文件":"Export graph file", "导入图表文件":"Import graph file", "导出 CSV":"Export CSV",
  "撤销载入图表":"Undo graph load", "尚无已保存的图表。":"No saved graphs yet.",
  "打开":"Open", "删除":"Delete", "请输入图表名称。":"Enter a name for the graph.",
  "最多可保存 30 张图表。":"You can save up to 30 graphs.", "图表已保存。":"Graph saved.",
  "已删除保存的图表。":"Saved graph deleted.", "浏览器存储不可用。可导出图表文件。":"Browser storage is unavailable. You can export the graph file.",
  "无法读取此图表文件。请选择本工具箱导出的 JSON。":"Could not read this graph file. Choose a JSON file exported by this toolbox.",
  "直方图的组距必须是正数。":"Histogram bin width must be positive.",
  "所有横坐标相同，无法拟合 y 关于 x 的直线。":"A linear fit for y requires at least two different x values.",
  "数据图中的点或数值必须是有限实数。":"The data plot requires finite real values.",
  "插入公式模板":"Insert formula template", "公式类型":"Formula type", "分式":"Fraction", "平方根":"Square root",
  "分子":"Numerator", "分母":"Denominator", "被开方数":"Radicand", "被积函数":"Integrand",
  "插入公式":"Insert formula",
  "请填写公式中的所有输入框。":"Fill in every slot in the formula.", "插入后表达式过长。":"The insertion would make the expression too long.",
  "示例库":"Example library", "示例类别":"Example categories", "撤销载入示例":"Undo example load",
  "数学键盘":"Math keyboard", "符号与函数类别":"Symbol and function category", "关闭":"Close",
  "数据图形请直接编辑列表中的点或数值。":"Edit the points or values directly in a data plot.",
  "数据图形请使用数值或滑块参数。":"Use numbers or slider parameters in data plots.",
  "统计图需要数值列表。直方图还需要正的组距。":"Use a list of values. Histograms also require a positive bin width.",
  "请输入形如 (x,y) 的点。":"Enter a point of the form (x,y).",
  "数列请使用 n 作为索引，例如 sequence(1/n,1,8)。":"Use n as the sequence index, as in sequence(1/n,1,8).",
  "缩小":"Zoom out", "放大":"Zoom in", "重置视图":"Reset view", "保存图片":"Save image", "移动指针可查看坐标":"Move the pointer to read coordinates",
  "拖动平移，滚轮缩放":"Drag to pan · Scroll to zoom", "曲线上":"On a curve", "表达式":"Expressions",
  "显示或隐藏表达式":"Show or hide expression", "删除表达式":"Remove expression", "添加表达式":"Add expression", "参数滑块":"Parameter sliders",
  "参数值":"Value for parameter", "载入示例":"Load an example", "选择绘图示例":"Choose a graph", "函数与交点":"Functions and intersections",
  "方程与阴影区域":"Equations and shaded regions", "可调参数曲线":"Curves with adjustable parameters", "参数曲线与极坐标":"Parametric and polar curves",
  "图表设置":"Graph settings", "网格":"Grid", "交点与截距":"Intersections and intercepts", "坐标追踪":"Coordinate tracing", "显示关键点":"Show key points",
  "参数 t 下限":"t minimum", "参数 t 上限":"t maximum", "角度 θ 下限":"θ minimum", "角度 θ 上限":"θ maximum", "应用范围":"Apply ranges",
  "函数数值表":"Function value table", "添加关于 x 的函数以查看数值表。":"Add a function of x to view its table.",
  "选择函数":"Choose a function", "起始 x":"Starting x", "步长":"Step", "请填写起点和正的步长。":"Enter a starting value and a positive step.",
  "请输入有效范围，且下限小于上限。":"Enter valid ranges with each minimum below its maximum.",
  "绘图数字超出范围。":"A number is outside the graphing range.", "无法识别绘图函数。":"Unrecognized graphing function.",
  "绘图表达式含无法识别的符号。":"The expression contains an unrecognized symbol.", "请检查绘图表达式的括号和参数。":"Check the brackets and arguments.",
  "请补全绘图表达式。":"Complete the expression.", "请检查绘图表达式的运算符。":"Check the operators in this expression.",
  "绘图函数的参数数量不正确。":"The graphing function has an incorrect number of arguments.",
  "自定义绘图函数需要一个参数。":"User-defined functions take one argument.",
  "每条绘图表达式最多 600 个字符。":"Use up to 600 characters per expression.", "同名绘图函数只能定义一次。":"Define each function name only once.",
  "自定义函数无效或存在循环引用。":"A user-defined function is invalid or references itself in a cycle.", "绘图表达式过于复杂。":"This graphing expression is too complex.",
  "同一参数只能赋值一次。":"Assign each parameter only once.", "范围限制需要不等式，例如 {0<=x<=4}。":"A restriction needs a comparison, such as {0<=x<=4}.",
  "函数定义的范围限制请直接使用参数。":"Use parameters directly in restrictions on a function definition.",
  "每条曲线只填写一个等式或不等式。":"Enter one equation or inequality per line.", "请将范围限制放在末尾的花括号内。":"Place restrictions in trailing braces.",
  "坐标对请使用数值、参数或 t。":"Use numbers, parameters or t in a coordinate pair.",
  "请用 y=f(x) 或含 x、y 的等式。":"Use y=f(x) or an equation in x and y.",
  "极坐标半径请用 θ 或参数表示。":"Use θ or parameters to define the polar radius.",
  "日期计算":"Date calculation", "转换器":"Converter", "日期设置":"Date settings", "日期运算":"Operation",
  "日期差":"Difference between dates", "日期加减":"Add or subtract dates", "起始日期":"From", "结束日期":"To",
  "基准日期":"Starting date", "加减方式":"Direction", "加上":"Add", "减去":"Subtract", "年数":"Years", "月数":"Months", "天数":"Days",
  "相隔天数":"Days between", "计算日期":"Calculated date", "请选择受支持的日期。":"Choose a supported date.",
  "年数、月数和天数须为非负整数。":"Enter non-negative whole numbers for the years, months and days.",
  "结果超出 1601 至 9999 年的范围。":"The resulting date is outside the supported range, 1601 to 9999.",
  "单位换算":"Unit conversion", "换算类别":"Category", "原单位":"From unit", "目标单位":"To unit",
  "输入数值":"Value", "交换单位":"Swap units", "换算结果":"Converted value", "约相当于":"Approximately equivalent to",
  "请输入有效数字。":"Enter a valid number.", "数值超出换算范围。":"The value is outside the conversion range.",
  "美制和英制容积单位分别标注。":"US and UK volume units are labeled separately.",
  "十进制单位按 1000 进位，二进制单位按 1024 进位。":"Decimal units use powers of 1000. Binary units use powers of 1024.",
  "马赫换算采用 340.3 米/秒作为基准。":"Mach conversion uses a reference speed of 340.3 m/s.",
  "时间换算中的 1 年按 365.25 天计。":"One year is 365.25 days in the unit converter.",
  "矩阵方程": "Matrix equation", "矩阵乘积": "Matrix product", "未知矩阵": "Unknown matrix", "选择未知矩阵": "Choose an unknown matrix", "出现一次": "Appears once", "换行或分号": "New line or semicolon",
  "用单个字母表示矩阵，乘积可写成 A*X*B=D 或 AXB=D。": "Use one letter per matrix. Enter products as A*X*B=D or AXB=D.",
  "每侧可使用 1～9 个矩阵。": "Use 1 to 9 matrices on each side of the equals sign.",
  "未知矩阵须只出现一次。": "The unknown matrix must appear exactly once.",
  "填写其余已知矩阵，同行用逗号分列，每行一个矩阵行。": "Enter the known matrices. Separate entries with commas and put each row on its own line.",
  "CAVEQIS 首页": "CAVEQIS home", "数学工具": "Math tools",
  "计算": "Calculations", "方程": "Equations", "工作台": "Workspace",
  "由 SymPy 提供计算支持": "Powered by SymPy", "关闭导航": "Close navigation", "切换导航": "Toggle navigation",
  "切换主题": "Toggle theme", "语言": "Language", "使用指南": "Guide", "输入指南": "Input guide", "关闭指南": "Close guide",
  "输入与设置": "Input and settings", "重置": "Reset", "有效数字": "Significant digits", "变量假设": "Variable assumptions",
  "小数位数": "Decimal places", "小数位数须为 0～50 的整数。": "Enter a whole number from 0 to 50 for decimal places.",
  "颜色主题": "Color theme", "跟随系统": "System", "浅色": "Light", "深色": "Dark",
  "设置": "Settings", "外观与启动": "Appearance and startup", "启动动画": "Startup animation",
  "关闭时": "When closing", "最小化到后台": "Minimize to background", "直接退出": "Quit",
  "开启本机 MCP": "Enable local MCP", "复制 MCP 配置": "Copy MCP configuration",
  "仅供本机应用连接，退出前台时自动关闭。": "For apps on this device. Stops when CAVEQIS leaves the foreground.",
  "MCP 服务无法启动。": "Could not start the MCP server.", "MCP 配置已复制": "MCP configuration copied",
  "求解的未知数": "Unknowns to solve for", "每行输入一个方程。": "Enter one equation per line.",
  "多个未知数用逗号分隔。未知函数可写为 y(x)。留空时自动识别。": "Separate unknowns with commas. For an unknown function, use y(x). Leave blank to detect them automatically.",
  "数值求根初值": "Starting values", "请填写方程中的未知函数，例如 y(x) 或 y。": "Enter the unknown function from the equation, for example y(x) or y.",
  "一般符号（复数）": "Complex (default)", "实数变量": "Real", "正实数变量": "Positive real",
  "结果": "Result", "复制结果": "Copy result", "试试这些": "Try these", "点击示例填入各输入框": "Click an example to fill the input fields.",
  "输入小贴士": "Input tips", "查看输入指南": "View input guide", "最近计算": "Recent calculations", "清空": "Clear",
  "历史仅保存在当前浏览器": "History is saved in this browser.", "开始计算": "Calculate", "开始求解": "Solve",
  "正在计算": "Calculating…", "连接计算服务中": "Connecting", "计算服务已就绪": "Engine ready", "计算服务未连接": "Engine offline",
  "在这里查看结果": "Results will appear here.", "暂时无法完成这次计算": "Unable to complete this calculation",
  "近似值": "Approximation", "恢复这次输入与结果": "Restore these inputs and this result",
  "完成第一次计算后，在这里找回记录": "Your recent calculations will appear here.",
  "示例已填入": "Example loaded", "已恢复输入与计算结果": "Inputs and result restored", "历史记录已清空": "History cleared",
  "计算结果已复制": "Result copied", "浏览器限制了复制，请手动选择结果": "Select and copy the result manually.",
  "请求等待时间过长，请确认计算服务状态后重试。": "The request timed out. Check the engine and try again.",
  "无法连接计算服务，请确认工具箱服务正在运行。": "Could not reach the calculation engine. Check that CAVEQIS is running.",
  "科学计算": "Scientific calculator", "矩阵": "Matrix", "积分": "Integration", "微分与求导": "Differentiation", "通用符号": "Common symbols",
  "每行依次填写积分变量、下限、上限，用逗号分隔。先写最内层积分。": "Enter the variable, lower bound, and upper bound on each line, separated by commas. Start with the innermost integral.",
  "级数": "Series", "极限表达式": "Limit notation", "级数表达式": "Series notation",
  "计算行列式": "Evaluate a determinant", "余子式": "Minor", "代数余子式": "Cofactor", "按行展开": "Expand along a row", "按列展开": "Expand along a column", "转置的行列式": "Determinant of a transpose", "乘积的行列式": "Determinant of a product", "数乘的行列式": "Determinant of a scaled matrix", "矩阵幂的行列式": "Determinant of a matrix power", "逆矩阵的行列式": "Determinant of an inverse", "行列式表达式": "Determinant expression",
  "行列式 A": "Determinant A", "行列式 B": "Determinant B", "行列号": "Row and column numbers", "行号": "Row number", "列号": "Column number",
  "运算类别": "Calculation type", "具体运算": "Operation", "求解方式": "Solving method", "例如": "Example",
  "表达式计算": "Evaluate expression", "符号化简": "Simplify", "展开": "Expand", "因式分解": "Factor", "分式约分": "Cancel common factors", "三角化简": "Simplify trigonometry",
  "数乘": "Scalar multiplication", "矩阵幂": "Matrix power", "行列式": "Determinant", "逆矩阵": "Inverse", "转置": "Transpose", "共轭转置": "Conjugate transpose", "秩": "Rank", "迹": "Trace", "行最简形": "Reduced row echelon form", "特征分析": "Eigenvalues and eigenvectors", "特征多项式": "Characteristic polynomial", "零空间": "Null space", "LU 分解": "LU decomposition", "逐元素乘": "Elementwise multiplication", "求解 AX=B": "Solve AX = B",
  "不定积分": "Indefinite integral", "定积分": "Definite integral", "多重积分": "Multiple integral", "符号表达式计算（∫）": "Evaluate integral notation (∫)", "符号表达式计算（∂）": "Evaluate derivative notation (∂)", "符号表达式计算（lim / ∑）": "Evaluate limit or series notation",
  "普通 / 高阶导数": "Ordinary or higher derivative", "混合偏导": "Mixed partial derivative", "全微分": "Total differential", "梯度": "Gradient", "Hessian 矩阵": "Hessian matrix",
  "函数极限": "Function limit", "级数展开（Taylor / Laurent）": "Taylor or Laurent expansion", "级数求和（有限 / 无穷）": "Finite or infinite summation",
  "自动求解": "Automatic", "单变量符号求根": "Exact single-variable roots", "线性方程组": "Linear system", "非线性方程组": "Nonlinear system", "数值求根": "Numerical roots", "常微分方程": "Ordinary differential equation", "积分方程（Volterra 型）": "Volterra integral equation",
  "数学表达式": "Expression", "函数表达式": "Function", "符号表达式": "Symbolic expression", "函数 f": "Function f", "被积函数 f": "Integrand f", "方程输入": "Equation input", "三角函数角度单位": "Angle unit",
  "矩阵 A": "Matrix A", "矩阵 B": "Matrix B", "逗号分列，换行分行": "Comma-separated entries, one row per line", "填入": "Insert", "单位阵": "Identity", "交换 A / B": "Swap A and B",
  "数乘系数 k": "Scalar k", "矩阵幂次 n": "Matrix exponent n", "未知数（顺序对应 A 的列）": "Unknowns in column order", "变量": "Variables", "代入变量": "Substitutions", "阶数": "Order", "幂次": "Exponent", "积分下限": "Lower integration bound", "积分上限": "Upper integration bound", "数乘系数": "Scalar", "求根初值": "Starting value", "趋近 / 展开点": "Limit or expansion point", "多重积分限": "Multiple integral bounds",
  "积分变量": "Integration variable", "积分变量与上下限": "Integration variable and bounds", "按内层到外层排列": "Innermost first", "求导变量": "Differentiation variable", "求导阶数": "Derivative order", "混合偏导顺序": "Partial derivative order", "变量列表": "Variable list", "在指定点处求值（可选）": "Evaluate at a point (optional)",
  "趋近点": "Limit point", "展开点": "Expansion point", "趋近方向": "Direction", "双侧极限（比较左右极限）": "Two-sided", "左侧极限": "Left-hand limit", "右侧极限": "Right-hand limit", "展开阶数（大 O 余项的阶数）": "Expansion order (Big O)", "级数通项 a(n)": "Series term a(n)", "求和指标": "Summation index", "求和下限": "Lower summation bound", "求和上限": "Upper summation bound",
  "换行": "New line", "退格": "Backspace", "更多函数与符号": "More functions and symbols", "常用运算符": "Common operators", "插入": "Insert", "输入按钮": "keypad", "一阶导数": "First derivative", "偏导数": "Partial derivative", "二阶偏导数": "Second partial derivative", "极限": "Limit", "有限级数求和": "Finite sum", "无穷级数求和": "Infinite sum", "级数展开": "Series expansion", "截断级数": "Truncated series",
  "幂运算": "Powers", "平方根 / n 次根": "Square root / nth root", "对数（底数为 a）": "Logarithm with base a", "圆周率 / 自然常数": "Pi / Euler’s number", "分隔元素": "Separate entries", "分隔行": "Separate rows", "精确分数 / 根式": "Exact fractions / radicals", "矩阵最大尺寸": "Maximum size", "无穷积分限": "Infinite bounds", "多重积分顺序": "Multiple integral order", "自然对数": "Natural logarithm", "n 阶导数": "Nth derivative", "梯度 / 全微分变量": "Variables for gradient / differential", "在点处求值": "Evaluate at a point", "趋近无穷": "At infinity", "极限方向": "Limit direction", "展开阶数 n": "Expansion order n", "求和通项": "Series term", "有限 / 无穷上限": "Finite / infinite bound", "求和符号": "Summation notation", "指定未知数": "Specify unknowns", "数值初值": "Numerical starting values", "复数域": "Complex domain", "矩阵字面量": "Matrix notation",
};

let language = "en";
function tr(zh) {
  return language === "zh" ? zh : (englishText[zh] ?? englishResultText[zh] ?? zh);
}
function bilingual(en, zh) { return language === "zh" ? zh : en; }

function localizeShell() {
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  for (const element of document.querySelectorAll("[data-text]")) element.textContent = tr(element.dataset.text);
  for (const element of document.querySelectorAll("[data-aria]")) element.setAttribute("aria-label", tr(element.dataset.aria));
  for (const element of document.querySelectorAll("[data-title]")) element.title = tr(element.dataset.title);
  document.querySelector("#language-select").value = language;
}

const englishResultText = {
  "矩阵方程解": "Matrix equation solutions", "矩阵方程无解。": "The matrix equation has no solution.", "矩阵方程有无穷多解，解中的 τ 为自由参数。": "The matrix equation has infinitely many solutions. The τ terms are free parameters.",
  "请填写矩阵方程并指定未知矩阵。": "Enter a matrix equation and choose the unknown matrix.", "请从方程中选择一个未知矩阵。": "Choose one unknown matrix from the equation.",
  "矩阵方程用单个英文字母命名矩阵。请填写 A*X*B=D 或 AXB=D 这样的乘积等式。": "Use single English letters for the matrices. Enter a product equation such as A*X*B=D or AXB=D.",
  "矩阵方程每侧最多使用 9 个因子。": "Use at most nine matrix factors on each side.", "未知矩阵在方程中须只出现一次。可以重复使用其他已知矩阵。": "The unknown matrix must appear once. Known matrices can repeat.",
  "矩阵方程中的元素须有定义且有限。": "Matrix entries must be defined and finite.", "矩阵乘积的相邻因子尺寸不匹配。": "The dimensions of adjacent matrix factors do not match.",
  "矩阵方程两边尺寸不匹配。请检查未知矩阵两侧因子和等号另一边的尺寸。": "The dimensions on the two sides do not match. Check the factors around the unknown matrix and the product on the other side.",
  "计算结果": "Calculation result", "积分结果": "Integral result", "微分 / 导数结果": "Derivative result", "极限结果": "Limit result", "级数求和": "Series sum", "符号表达式结果": "Symbolic result", "导数": "Derivative", "梯度 ∇f": "Gradient ∇f", "全微分 df": "Total differential df", "代入后的结果": "Result after substitution", "双侧极限": "Two-sided limit", "逐元素乘积": "Elementwise product", "A · B⁻¹（右除）": "A · B⁻¹ (right division)", "Aᴴ（共轭转置）": "Aᴴ (conjugate transpose)", "对应特征向量": "Eigenvector", "特征多项式 det(λI − A)": "Characteristic polynomial det(λI − A)",
  "等式判断": "Equality check", "解集": "Solution set", "线性方程组解集": "Linear system solution set", "非线性方程组解集（顺序对应未知数）": "Nonlinear system solutions in unknown order", "微分方程特解": "Particular ODE solution", "微分方程通解": "General ODE solution", "积分方程解": "Integral equation solution",
  "行列式须为 1×1～8×8 的方阵，例如 det([1,2],[3,4])。": "A determinant requires a square array from 1×1 to 8×8. For example, det([1,2],[3,4]).",
  "行列式要求方阵。": "Enter a square array for the determinant.", "乘积行列式要求两个同阶方阵。": "Enter two square arrays of the same size for the product.", "未知的行列式操作。": "Choose a supported determinant operation.",
  "等式恒成立，没有待求未知数。": "The equality holds and has no unknowns to solve for.", "等式不成立，没有待求未知数。": "The equality does not hold and has no unknowns to solve for.",
  "方程组无解。": "The system has no solution.", "在所选数域内无解。": "No solution in the selected domain.", "有无穷多解，保留的未知数为自由参数。": "Infinitely many solutions. The remaining unknowns are free parameters.", "存在自由变量，方程组有无穷多解；保留的未知数为自由参数。": "Infinitely many solutions. The remaining unknowns are free parameters.",
  "未求出完整显式解，保留条件解集。": "A complete explicit solution was unavailable. The conditional set is shown.", "非线性方程组按复数域求解；超越方程可能返回条件或参数解。": "Nonlinear systems are solved over the complex numbers. Transcendental equations may return conditional or parametric solutions.",
  "数值求根只返回初值附近的一组近似解，不代表全部解。": "The numerical solver returns approximate roots near the starting values.", "C1、C2 等为任意常数；可在同一输入框另起一行加入 y(0)=1 这样的初始条件。": "C1, C2 and similar symbols are arbitrary constants. Add initial conditions such as y(0)=1 on separate lines.", "当前求解对象是单函数常微分方程；返回隐式解或特殊函数也是可能的。": "The ODE solver handles a single unknown function and may return an implicit solution or special functions.",
  "此解已回代原积分方程核对；目前支持可通过至多三次求导消去积分的单函数 Volterra 型方程。": "The solution was checked against the original integral equation. The solver supports single-function Volterra equations that reduce after up to three differentiations.",
  "C 为任意积分常数。": "C is an arbitrary constant of integration.", "C 为任意积分常数；在被积函数连续的区间上理解此结果。": "C is an arbitrary constant of integration on each interval where the integrand is continuous.", "当前三角函数输入为角度；反三角函数结果也以度表示。": "Trigonometric inputs and inverse trigonometric outputs are in degrees.", "微积分中的三角函数统一采用弧度制。": "Trigonometric functions use radians in calculus.",
  "dx、dy 等表示对应变量的微分。": "dx and dy denote differentials of x and y.", "矩阵右除定义为 A·B⁻¹；矩阵乘法通常不满足交换律。": "Right division is A·B⁻¹. Matrix multiplication depends on order.", "零空间只有零向量，维数为 0。": "The null space contains only the zero vector and has dimension zero.", "分解满足 P·A = L·U。": "The decomposition satisfies P·A = L·U.", "含参数矩阵的结果按一般参数条件计算；特殊参数取值可能改变秩、可逆性或解的数量。": "Results assume generic parameter values. Special values may change rank, invertibility or the number of solutions.",
  "尚未完整求出解析结果，保留未求出的运算符号；这不表示结果为零。": "The engine left part of the expression unevaluated.", "未求出完整解析解，结果保留了积分符号；这不表示积分为零。可尝试改写表达式、设置变量假设或填写具体积分限。": "The engine left an integral unevaluated. Try rewriting it, setting variable assumptions or supplying bounds.", "积分可能发散或在当前定义域无有限值，请检查奇点与积分区间。": "The integral may diverge. Check for singularities and verify the integration interval.", "结果不是有限值，请检查收敛性、奇点或定义域。": "The result is not finite. Check convergence, singularities and the domain.", "该级数可能发散或不存在有限和，请检查求和区间与参数。": "The series may diverge. Check its bounds and parameters.", "该级数出现振荡，未得到单一有限和。": "The series oscillates without a single finite sum.", "左右极限不相同，双侧极限不存在。": "The left and right limits differ, so the two-sided limit does not exist.", "上下限填整数可求有限和；上限填 oo 或 ∞ 可求无穷级数。参数条件以结果中显示的条件为准。": "Use integer bounds for a finite sum or oo or ∞ as the upper bound for an infinite sum. Parameter conditions appear in the result.", "结果无定义或为复无穷，请检查输入的定义域。": "The result is undefined or complex infinity. Check the input domain.",
  "全微分格式为 totaldiff(f,x,y)，最多使用 6 个变量。": "Use totaldiff(f,x,y) with up to six variables.",
  "请先填写表达式。": "Enter an expression first.", "每个方程只能有一个等号。": "Use at most one equals sign per equation.", "请填写 1～10 个方程，每行一个。": "Enter 1 to 10 equations, one per line.", "表达式格式有误，请检查括号、运算符和函数写法。": "Check parentheses, operators and function syntax.", "括号不匹配：请让 ()、[]、{} 成对，并按正确顺序嵌套。": "Match and nest each pair of parentheses or brackets.", "缺少右括号：请检查 ()、[]、{} 是否完整配对。": "A closing bracket is missing.", "除数不能为零。": "Division by zero is undefined.", "零不能取负次幂。": "Zero cannot be raised to a negative power.", "不支持此函数或参数，请参照输入帮助。": "This function or its arguments are unsupported. See the input guide.", "输入仅接受数学表达式，不支持属性、下标、代码或字符串。": "Enter a mathematical expression using the supported syntax.",
  "矩阵大小须为 1×1～8×8。": "Use a matrix between 1×1 and 8×8.", "A、B 的行数和列数须分别相同。": "A and B must have the same dimensions.", "A 的列数须等于 B 的行数。": "The columns of A must match the rows of B.", "矩阵不可逆，行列式为零。": "The matrix is singular.", "该操作要求方阵。矩阵右除要求 B 为可逆方阵。": "This operation requires a square matrix. For right division, B must be invertible.", "矩阵每行的列数必须相同。元素用逗号分隔，行用换行或分号分隔。": "Every row must have the same number of entries. Use commas for entries and newlines or semicolons for rows.", "矩阵不能包含空元素。": "Fill every matrix entry.", "未知数数量须等于 A 的列数。": "The number of unknowns must match the number of columns in A.", "求解 AX=B 时，A 与 B 的行数须相同。": "For AX = B, A and B must have the same number of rows.", "此处 B 请输入一列常数向量。": "Enter a single column for B.",
  "方程中的级数展开仍含余项。请使用级数求和，或用 trunc 显式取截断表达式。": "The equation contains a series remainder. Use a sum or explicitly use trunc for a truncated expression.", "方程含有无定义或无穷值，请检查积分收敛性、极限与定义域。": "The equation contains an undefined or infinite value. Check convergence and the domain.", "单变量符号求根接受一个方程和一个未知数；多元方程请选择自动或方程组求解。": "Exact single-variable mode expects one equation and one unknown. Choose Automatic or a system solver for multiple unknowns.", "初值数量须与未知数数量一致；可另起一行填写 guess: 1,1。": "Provide one starting value per unknown, for example guess: 1,1 on its own line.", "数值初值须为具体数值。": "Starting values must be numeric.", "数值求根前请将系数参数替换为具体数值。": "Substitute numeric coefficients before finding numerical roots.", "当前初值未能找到满足精度的根，请更换初值。": "No root was found near the starting values. Try different starting values.", "检测到非线性项，请改用符号求根或非线性方程组模式。": "Nonlinear terms detected. Choose a symbolic or nonlinear solver.", "当前有计算正在进行，请稍后重试。": "The engine is busy. Try again in a moment.", "计算超出资源限制，请简化表达式或缩小矩阵。": "The calculation exceeded available resources. Try a smaller problem.", "计算较频繁，请稍后再试（每分钟最多 40 次）。": "Calculation limit reached. Try again shortly (40 per minute).", "输入内容超过 24 KB，请拆分计算。": "Input exceeds 24 KB. Split it into smaller calculations.",
};

function resultText(text, kind = "label") {
  if (language === "zh" || !text) return text;
  const translated = tr(text);
  if (translated !== text) return translated;
  const patterns = [
    [/^请填写矩阵 ([A-Za-z])。$/, ([, name]) => `Enter matrix ${name}.`],
    [/^矩阵 ([A-Za-z]) 输入有误。(.+)$/, ([, name, detail]) => `Check matrix ${name}. ${resultText(detail,"error")}`],
    [/^积分限第 (\d+) 行的第一项须为积分变量/, ([, row]) => `On line ${row} of the bounds, the first entry must be the integration variable. Enter variable, lower bound, upper bound, as in y,0,1.`],
    [/^所求未知数：(.+?)。/, ([, names]) => `Unknowns: ${names}. To choose unknowns explicitly, add vars: x.`],
    [/^主元列（从 1 开始）：(.*)$/, ([, cols]) => `Pivot columns (starting at 1): ${cols === "无" ? "none" : cols.replaceAll("、", ", ")}`],
    [/^零空间基向量 (\d+)$/, ([, index]) => `Null-space basis vector ${index}`],
    [/^特征值（代数重数 (\d+)）$/, ([, count]) => `Eigenvalue (algebraic multiplicity ${count})`],
    [/^展开到 (\d+) 次幂附近/, ([, order]) => `Expanded through degree ${order} with a Big O remainder. Laurent or fractional powers may occur.`],
    [/^计算超过 ([\d.]+) 秒/, ([, time]) => `The calculation exceeded ${time} seconds. Try simplifying the input.`],
    [/^(.+?)须为 ([-\d]+)～([-\d]+) 的整数。$/, ([, label, low, high]) => `${tr(label) === label ? "The value" : tr(label)} must be an integer from ${low} to ${high}.`],
  ];
  for (const [pattern, format] of patterns) {
    const match = text.match(pattern);
    if (match) return format(match);
  }
  if (!/\p{Script=Han}/u.test(text) || kind === "label" && /^[\p{L}\p{N}_]+$/u.test(text)) return text;
  if (kind === "error") return "Check the input format, dimensions and domain, or try a different solving method.";
  if (kind === "note") return "The result may depend on the input domain, assumptions or convergence.";
  return "Result";
}
