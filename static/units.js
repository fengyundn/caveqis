"use strict";

// Factors are in the category's base unit. Temperature uses its own affine conversion.
const dataPrefixes = [
  ["k", "Ki", "kilo", "kibi", "千"], ["M", "Mi", "mega", "mebi", "兆"],
  ["G", "Gi", "giga", "gibi", "吉"], ["T", "Ti", "tera", "tebi", "太"],
  ["P", "Pi", "peta", "pebi", "拍"], ["E", "Ei", "exa", "exbi", "艾"],
  ["Z", "Zi", "zetta", "zebi", "泽"], ["Y", "Yi", "yotta", "yobi", "尧"],
];
const unitCategories = {
  volume: {name:["Volume","体积"], defaults:["L","mL"], units:[
    ["mL","Milliliter","毫升",0.001], ["cm³","Cubic centimeter","立方厘米",0.001],
    ["L","Liter","升",1], ["m³","Cubic meter","立方米",1000],
    ["tsp US","US teaspoon","美制茶匙",3.785411784/768], ["tbsp US","US tablespoon","美制汤匙",3.785411784/256],
    ["fl oz US","US fluid ounce","美制液量盎司",3.785411784/128], ["cup US","US cup","美制杯",3.785411784/16],
    ["pt US","US pint","美制品脱",3.785411784/8], ["qt US","US quart","美制夸脱",3.785411784/4],
    ["gal US","US gallon","美制加仑",3.785411784], ["in³","Cubic inch","立方英寸",0.0254**3*1000],
    ["ft³","Cubic foot","立方英尺",0.3048**3*1000], ["yd³","Cubic yard","立方码",0.9144**3*1000],
    ["tsp UK","UK teaspoon","英制茶匙",4.54609/768], ["tbsp UK","UK tablespoon","英制汤匙",4.54609/256],
    ["fl oz UK","UK fluid ounce","英制液量盎司",4.54609/160], ["pt UK","UK pint","英制品脱",4.54609/8],
    ["qt UK","UK quart","英制夸脱",4.54609/4], ["gal UK","UK gallon","英制加仑",4.54609],
  ], comparisons:[["Coffee cups","咖啡杯",0.2365882],["Bathtubs","浴缸",378.5412],["Swimming pools","游泳池",3750000]]},
  length: {name:["Length","长度"], defaults:["m","cm"], units:[
    ["Å","Ångström","埃",1e-10], ["nm","Nanometer","纳米",1e-9], ["µm","Micrometer","微米",1e-6],
    ["mm","Millimeter","毫米",0.001], ["cm","Centimeter","厘米",0.01], ["m","Meter","米",1], ["km","Kilometer","千米",1000],
    ["in","Inch","英寸",0.0254], ["ft","Foot","英尺",0.3048], ["yd","Yard","码",0.9144],
    ["mi","Mile","英里",1609.344], ["nmi","Nautical mile","海里",1852],
  ], comparisons:[["Paper clips","回形针长度",0.035052],["Hand lengths","手掌长度",0.18669],["Jumbo jets","大型客机长度",76]]},
  mass: {name:["Weight and mass","重量和质量"], defaults:["kg","lb"], units:[
    ["ct","Carat","克拉",0.0002], ["mg","Milligram","毫克",1e-6], ["cg","Centigram","厘克",1e-5],
    ["dg","Decigram","分克",0.0001], ["g","Gram","克",0.001], ["dag","Decagram","十克",0.01],
    ["hg","Hectogram","百克",0.1], ["kg","Kilogram","千克",1], ["t","Metric tonne","公吨",1000],
    ["oz","Ounce","盎司",0.028349523125], ["lb","Pound","磅",0.45359237], ["st","Stone","英石",6.35029318],
    ["ton US","US short ton","美制短吨",907.18474], ["ton UK","UK long ton","英制长吨",1016.0469088],
  ], comparisons:[["Snowflakes","雪花",0.000002],["Soccer balls","足球",0.4325],["Elephants","大象",4000],["Whales","鲸鱼",90000]]},
  temperature: {name:["Temperature","温度"], defaults:["°C","°F"], units:[
    ["°C","Celsius","摄氏度",1], ["°F","Fahrenheit","华氏度",1], ["K","Kelvin","开尔文",1],
  ]},
  energy: {name:["Energy","能量"], defaults:["kWh","J"], units:[
    ["eV","Electronvolt","电子伏特",1.602176634e-19], ["J","Joule","焦耳",1], ["kJ","Kilojoule","千焦",1000],
    ["cal","Calorie","卡路里",4.184], ["kcal","Kilocalorie","千卡",4184], ["ft·lb","Foot-pound","英尺磅",1.3558179483314004],
    ["BTU","British thermal unit","英热单位",1055.05585262], ["kWh","Kilowatt-hour","千瓦时",3600000],
  ], comparisons:[["Batteries","电池能量",9000],["Bananas","香蕉热量",439614],["Slices of cake","蛋糕切片热量",1046700]]},
  area: {name:["Area","面积"], defaults:["m²","ft²"], units:[
    ["mm²","Square millimeter","平方毫米",1e-6], ["cm²","Square centimeter","平方厘米",1e-4],
    ["m²","Square meter","平方米",1], ["ha","Hectare","公顷",10000], ["km²","Square kilometer","平方千米",1e6],
    ["in²","Square inch","平方英寸",0.0254**2], ["ft²","Square foot","平方英尺",0.3048**2],
    ["yd²","Square yard","平方码",0.9144**2], ["ac","Acre","英亩",4046.8564224],
    ["mi²","Square mile","平方英里",1609.344**2], ["坪","Pyeong","坪",400/121],
  ], comparisons:[["Hand areas","手掌面积",0.012516104],["Sheets of paper","纸张面积",0.06032246],["Soccer fields","足球场",10869.66],["Castles","城堡占地",100000]]},
  speed: {name:["Speed","速度"], defaults:["m/s","km/h"], units:[
    ["cm/s","Centimeters per second","厘米每秒",0.01], ["m/s","Meters per second","米每秒",1],
    ["km/h","Kilometers per hour","千米每小时",1000/3600], ["ft/s","Feet per second","英尺每秒",0.3048],
    ["mph","Miles per hour","英里每小时",1609.344/3600], ["kn","Knot","节",1852/3600], ["Mach","Mach","马赫",340.3],
  ], comparisons:[["Turtle speeds","乌龟速度",0.0894],["Horse speeds","马奔跑速度",20.115],["Jet speeds","喷气机速度",245.85]]},
  time: {name:["Time","时间"], defaults:["h","min"], units:[
    ["µs","Microsecond","微秒",1e-6], ["ms","Millisecond","毫秒",0.001], ["s","Second","秒",1], ["min","Minute","分钟",60],
    ["h","Hour","小时",3600], ["d","Day","天",86400], ["wk","Week","周",604800], ["yr","Year","年",31557600],
  ]},
  power: {name:["Power","功率"], defaults:["kW","W"], units:[
    ["W","Watt","瓦",1], ["kW","Kilowatt","千瓦",1000], ["hp","Mechanical horsepower","英制马力",745.6998715822702],
    ["ft·lb/min","Foot-pounds per minute","英尺磅每分钟",1.3558179483314004/60],
    ["BTU/min","British thermal units per minute","英热单位每分钟",1055.05585262/60],
  ], comparisons:[["Light bulbs","60 瓦灯泡",60],["Horse power","马的功率",745.7],["Train engines","火车发动机",2982799.486329081]]},
  data: {name:["Data","数据"], defaults:["GB","MB"], units:[
    ["bit","Bit","比特",1/8], ["nibble","Nibble","半字节",1/2], ["B","Byte","字节",1],
    ...dataPrefixes.flatMap(([decimal,binary,word,binaryWord,zh], index) => {
      const si = 1000**(index+1);
      const iec = 1024**(index+1);
      return [
        [decimal+"bit",word+"bit",zh+"比特",si/8], [binary+"bit",binaryWord+"bit",zh+"比特（二进制）",iec/8],
        [decimal+"B",word+"byte",zh+"字节",si], [binary+"B",binaryWord+"byte",zh+"字节（二进制）",iec],
      ];
    }),
  ], comparisons:[["Floppy disks","软盘",1474560],["CDs","CD 光盘",700e6],["DVDs","DVD 光盘",4700e6]]},
  pressure: {name:["Pressure","压力"], defaults:["atm","kPa"], units:[
    ["atm","Standard atmosphere","标准大气压",101325], ["bar","Bar","巴",100000], ["kPa","Kilopascal","千帕",1000],
    ["mmHg","Millimeter of mercury","毫米汞柱",133.322387415], ["Pa","Pascal","帕",1],
    ["psi","Pound per square inch","磅力每平方英寸",6894.757293168],
  ]},
  angle: {name:["Angle","角度"], defaults:["°","rad"], units:[
    ["°","Degree","度",1], ["rad","Radian","弧度",180/Math.PI], ["gon","Gradian","百分度",0.9],
  ]},
};

function convertUnits(category, from, to, number) {
  if (from[0] === to[0]) return number;
  if (category !== "temperature") return number * (from[3] / to[3]);
  const celsius = from[0] === "°F" ? (number - 32) * (5/9) : from[0] === "K" ? number - 273.15 : number;
  return to[0] === "°F" ? celsius * (9/5) + 32 : to[0] === "K" ? celsius + 273.15 : celsius;
}
