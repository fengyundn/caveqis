/* Shared editing and press feedback for mathematical inputs. */
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
  function installKeyPreviews(document) {
    const keys = "button[data-insert],button[data-edit],button[data-graph-key],button[data-graph-edit]";
    const view = document.defaultView;
    const preview = document.createElement("div");
    preview.className = "math-key-preview";
    preview.setAttribute("aria-hidden","true");
    preview.hidden = true;
    document.body.append(preview);
    let held;
    let releasedKey;

    function placePreview() {
      if (!held) return;
      const bounds = held.button.getBoundingClientRect();
      const halfWidth = preview.offsetWidth / 2;
      const center = bounds.left + bounds.width / 2;
      preview.style.left = Math.max(halfWidth + 8, Math.min(view.innerWidth - halfWidth - 8, center)) + "px";
      const above = bounds.top >= preview.offsetHeight + 12;
      preview.style.top = (above ? bounds.top - preview.offsetHeight - 7 : bounds.bottom + 7) + "px";
    }

    function release(event) {
      if (!held || event?.pointerId !== undefined && event.pointerId !== held.pointerId) return;
      const {button} = held;
      button.classList.remove("math-key-held");
      held = null;
      preview.hidden = true;
      if (event?.type !== "pointerup") return;
      releasedKey = button;
      const bounds = button.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom ||
          button.disabled || !button.isConnected) return;
      // A long touch can lose its native click even when the context menu is cancelled.
      button.dispatchEvent(new view.MouseEvent("click",{bubbles:true,cancelable:true,detail:1}));
    }

    document.addEventListener("pointerdown", event => {
      const button = event.target.closest(keys);
      if (!button || button.disabled || event.button !== 0 || event.isPrimary === false) return;
      release();
      releasedKey = null;
      event.preventDefault();
      held = {button,pointerId:event.pointerId};
      button.classList.add("math-key-held");
      preview.textContent = button.dataset.operator || button.textContent.trim();
      preview.hidden = false;
      placePreview();
    });
    for (const event of ["pointerup","pointercancel","lostpointercapture"]) view.addEventListener(event,release,true);
    document.addEventListener("click",event=>{
      if (!releasedKey || !event.isTrusted || !event.detail || event.target.closest(keys)!==releasedKey) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },true);
    view.addEventListener("blur",release);
    view.addEventListener("scroll",placePreview,true);
    view.addEventListener("resize",placePreview);
    document.addEventListener("contextmenu",event=>{
      if (event.target.closest(keys)) event.preventDefault();
    });
  }
  const api = {insertTemplate, backspace, installKeyPreviews};
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.mathInput = api;
})(typeof window === "undefined" ? globalThis : window);
