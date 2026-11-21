(() => {
  const native = window.CaveqisNative;
  if (!native) return;

  const pending = new Map();
  let nextId = 1;
  const localized = (en, zh) => document.documentElement.lang.startsWith("zh") ? zh : en;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "android-keypad-toggle";
  button.setAttribute("aria-controls", "android-keypad");
  button.setAttribute("aria-expanded", "false");

  const drawer = document.createElement("section");
  drawer.id = "android-keypad";
  drawer.className = "android-keypad";
  drawer.hidden = true;
  drawer.innerHTML = '<div class="android-keypad-header"><strong></strong><button type="button"></button></div>'
    + '<div class="android-keypad-grid"></div>';
  const heading = drawer.querySelector("strong");
  const close = drawer.querySelector(".android-keypad-header button");
  const grid = drawer.querySelector(".android-keypad-grid");
  const keys = [
    ["7","7"], ["8","8"], ["9","9"], ["÷","/"], ["⌫","back"],
    ["4","4"], ["5","5"], ["6","6"], ["×","*"], ["(","("],
    ["1","1"], ["2","2"], ["3","3"], ["−","-"], [")",")"],
    ["0","0"], [".","."], [",",","], ["+","+"], ["=","="]
  ];
  for (const [label, value] of keys) {
    const key = document.createElement("button");
    key.type = "button";
    key.textContent = label;
    key.dataset.value = value;
    grid.append(key);
  }
  document.body.append(button, drawer);

  const makeLabels = () => {
    button.textContent = localized("Number keypad", "数字键盘");
    heading.textContent = button.textContent;
    drawer.setAttribute("aria-label", button.textContent);
    close.textContent = localized("Done", "收起");
    grid.querySelector('[data-value="back"]').setAttribute("aria-label", localized("Backspace", "退格"));
  };
  makeLabels();
  new MutationObserver(makeLabels).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  const inputs = 'textarea, input[type="text"], input[type="number"], input:not([type])';
  const numericDrafts = new WeakMap();
  const editable = field => field?.matches(inputs) && !field.disabled && !field.readOnly
    && field.getClientRects().length > 0;
  let lastInput;
  document.addEventListener("focusin", event => {
    if (editable(event.target)) lastInput = event.target;
  });
  button.addEventListener("pointerdown", event => event.preventDefault());
  drawer.addEventListener("pointerdown", event => event.preventDefault());

  function fieldForKeypad() {
    if (editable(lastInput)) return lastInput;
    return [...document.querySelectorAll("main textarea, main input")].find(editable);
  }

  function setOpen(open) {
    drawer.hidden = !open;
    button.hidden = open;
    button.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("android-keypad-open", open);
    if (open) {
      const field = fieldForKeypad();
      native.hideKeyboard();
      requestAnimationFrame(() => field?.scrollIntoView({ block: "center" }));
    } else {
      button.focus({ preventScroll: true });
    }
  }
  button.addEventListener("click", () => setOpen(true));
  close.addEventListener("click", () => setOpen(false));
  grid.addEventListener("click", event => {
    const key = event.target.closest("button");
    const field = fieldForKeypad();
    if (!key || !field) return;
    const value = key.dataset.value;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    if (start === null || end === null) {
      if (value !== "back" && !/^[0-9.\-]$/.test(value)) return;
      const draft = numericDrafts.get(field);
      const current = draft?.display === field.value ? draft.value : field.value;
      const next = value === "back" ? current.slice(0, -1) : current + value;
      if (next === "" || /^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/.test(next)) {
        field.value = next;
      } else if (!/^-?(?:[0-9]+)?\.?$/.test(next)) {
        return;
      }
      numericDrafts.set(field, { display: field.value, value: next });
    } else if (value === "back") {
      const previous = [...field.value.slice(0, start)].pop() || "";
      field.setRangeText("", start === end ? start - previous.length : start, end, "end");
    } else {
      field.setRangeText(value, start, end, "end");
    }
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });

  function response(payload) {
    return { json: async () => JSON.parse(payload) };
  }

  window.CaveqisPlatform = {
    request(url, options = {}) {
      if (url === "api/health") {
        return Promise.resolve(response('{"ok":true,"engine":"SymPy","timeout":12}'));
      }
      if (url !== "api/calculate") return null;
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const abort = () => {
          pending.delete(id);
          reject(new DOMException("Aborted", "AbortError"));
        };
        if (options.signal?.aborted) {
          abort();
          return;
        }
        options.signal?.addEventListener("abort", abort, { once: true });
        pending.set(id, payload => {
          options.signal?.removeEventListener("abort", abort);
          resolve(response(payload));
        });
        native.calculate(id, options.body);
      });
    },
    receive(id, payload) {
      const finish = pending.get(id);
      pending.delete(id);
      finish?.(payload);
    },
    copyText(text) { native.copyText(text); },
    saveFile(name, blob) {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const encoded = reader.result.split(",", 2)[1];
        native.saveFile(name, blob.type.split(";", 1)[0], encoded);
      });
      reader.addEventListener("error", () => this.fileStatus("save-error"));
      reader.readAsDataURL(blob);
    },
    fileStatus(code) {
      const messages = {
        saved: localized("File saved", "文件已保存"),
        "save-error": localized("Could not save the file", "无法保存文件"),
        "open-error": localized("Could not open the file picker", "无法打开文件选择器"),
      };
      window.toast?.(messages[code]);
    },
    handleBack() {
      if (!drawer.hidden) {
        setOpen(false);
        return true;
      }
      const dialog = [...document.querySelectorAll("dialog[open]")].pop();
      if (dialog) {
        dialog.close();
        return true;
      }
      const sidebar = document.getElementById("sidebar");
      if (sidebar?.classList.contains("open")) {
        document.getElementById("sidebar-close")?.click();
        return true;
      }
      return false;
    },
  };
})();
