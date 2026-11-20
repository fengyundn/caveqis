const {test} = require("node:test");
const assert = require("node:assert/strict");
const {insertTemplate,backspace} = require("../static/math-input.js");

test("empty function places the caret inside its parentheses",()=>{
  assert.deepEqual(insertTemplate("x=",2,2,"exp()"),{value:"x=exp()",start:6,end:6});
});
test("typed argument continues at the cursor and retains surrounding text",()=>{
  const inserted=insertTemplate("1+",2,2,"sqrt()");
  assert.equal(insertTemplate(inserted.value,inserted.start,inserted.end,"9").value,"1+sqrt(9)");
});
test("a selected expression is wrapped without dropping parameters",()=>{
  assert.equal(insertTemplate("x+1",0,3,"sin()").value,"sin(x+1)");
  assert.equal(insertTemplate("9",0,1,"log(,2)").value,"log(9,2)");
  assert.equal(insertTemplate("8",0,1,"root(,3)").value,"root(8,3)");
  assert.equal(insertTemplate("x+1",0,3,"^2").value,"(x+1)^2");
});
test("insertions work between matrix cells and on separate rows",()=>{
  assert.equal(insertTemplate("1,2",2,2,"exp()").value,"1,exp()2");
  assert.equal(insertTemplate("1,2",3,3,"\n").value,"1,2\n");
});
test("paired grouping brackets wrap a selection or place the caret inside",()=>{
  assert.deepEqual(insertTemplate("2+",2,2,"{}"),{value:"2+{}",start:3,end:3});
  assert.equal(insertTemplate("3*(4+1)",0,7,"[]").value,"[3*(4+1)]");
});
test("Chinese text remains intact and backspace handles full Unicode characters",()=>{
  assert.deepEqual(insertTemplate("力=",2,2,"温度"),{value:"力=温度",start:4,end:4});
  assert.equal(backspace("力=𝑥",4,4).value,"力=");
  assert.equal(backspace("力=温度",2,4).value,"力=");
});
