(() => {
  const native = window.CaveqisNative;
  if (!native) return;

  const pending = new Map();
  const pendingMcp = new Map();
  let nextId = 1;
  const localized = (en, zh) => document.documentElement.lang.startsWith("zh") ? zh : en;

  document.documentElement.classList.add("mobile-app");
  const chart = document.querySelector(".graph-chart-card");
  const parameters = document.getElementById("graph-parameters");
  parameters.before(chart);

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
    isSystemDark() { return native.isSystemDark(); },
    configureMcp: typeof native.configureMcp === "function" ? enabled => new Promise(resolve => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pendingMcp.delete(id);
        resolve({enabled:false,error:true});
      },6000);
      pendingMcp.set(id, status => { clearTimeout(timer); resolve(status); });
      native.configureMcp(id, enabled);
    }) : undefined,
    receiveMcp(id, payload) {
      const status = JSON.parse(payload);
      const finish = pendingMcp.get(id);
      pendingMcp.delete(id);
      finish?.(status);
      if (id === 0) window.dispatchEvent(new CustomEvent("caveqis-mcp-status",{detail:status}));
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
      const dialog = [...document.querySelectorAll("dialog[open]")].pop();
      if (dialog) {
        dialog.close();
        return "handled";
      }
      const sidebar = document.getElementById("sidebar");
      if (sidebar?.classList.contains("open")) {
        document.getElementById("sidebar-close")?.click();
        return "handled";
      }
      return document.getElementById("close-behavior")?.value === "quit" ? "quit" : "background";
    },
  };
})();
