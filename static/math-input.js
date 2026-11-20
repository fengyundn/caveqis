/* Shared, DOM-independent cursor handling for every mathematical input. */
(function (root) {
  "use strict";
  function insertTemplate(value, start, end, template) {
    const selected = value.slice(start, end);
    const slot = template.indexOf("□");
    if (slot >= 0) {
      const inserted = template.slice(0, slot) + selected + template.slice(slot + 1);
      const caret = start + slot + selected.length;
      return {value:value.slice(0,start) + inserted + value.slice(end), start:caret, end:caret};
    }
    let inserted = template;
    const opening = template.search(/[([{]/);
    if (selected && opening >= 0) inserted = template.slice(0, opening + 1) + selected + template.slice(opening + 1);
    else if (selected && template.startsWith("^")) inserted = "(" + selected + ")" + template;
    let caret = start + inserted.length;
    if (!selected && opening >= 0) caret = start + opening + 1;
    return {value:value.slice(0,start) + inserted + value.slice(end), start:caret, end:caret};
  }
  function backspace(value, start, end) {
    if (start === end && start > 0) start -= [...value.slice(0,start)].at(-1).length;
    return {value:value.slice(0,start) + value.slice(end), start, end:start};
  }
  const api = {insertTemplate, backspace};
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.mathInput = api;
})(typeof window === "undefined" ? globalThis : window);
