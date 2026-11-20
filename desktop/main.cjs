const { app, BrowserWindow, Menu, dialog, session } = require("electron");
const { spawn } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const { mkdtempSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const readline = require("node:readline");

const smokeOption = process.argv.find((arg) => arg.startsWith("--smoke-report="));
const smokeReport = smokeOption?.slice("--smoke-report=".length);
const port = smokeReport ? 18766 : 18765;
const origin = `http://127.0.0.1:${port}`;
const token = randomBytes(32).toString("hex");
const resources = process.resourcesPath;
let window;
let engine;
let closing = false;

if (smokeReport) {
  app.setPath("userData", mkdtempSync(path.join(tmpdir(), "caveqis-smoke-")));
  app.setAppLogsPath(path.join(app.getPath("userData"), "logs"));
}

function startEngine() {
  return new Promise((resolve, reject) => {
    engine = spawn(path.join(resources, "engine", "caveqis-engine.exe"), [], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: {
        ...process.env,
        CAVEQIS_DESKTOP_PORT: String(port),
        CAVEQIS_DESKTOP_TOKEN: token,
        CAVEQIS_DESKTOP_PARENT: String(process.pid),
        MATH_TRUST_PROXY: "0",
      },
    });
    let ready = false;
    let diagnostics = "";
    engine.stderr.on("data", (chunk) => {
      diagnostics = (diagnostics + chunk).slice(-1800);
    });

    const timeout = setTimeout(() => reject(new Error("计算服务启动超时。")), 15000);
    engine.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    engine.once("close", (code) => {
      clearTimeout(timeout);
      const error = new Error(`本机计算服务已退出 (${code})。\n${diagnostics}`);
      if (!ready) reject(error);
      else if (!closing) fail(error);
    });
    const lines = readline.createInterface({ input: engine.stdout });
    lines.on("line", (line) => {
      if (line !== "CAVEQIS_READY") return;
      clearTimeout(timeout);
      ready = true;
      resolve();
    });
  });
}

function fail(error) {
  if (closing) return;
  if (smokeReport) {
    writeFileSync(smokeReport, JSON.stringify({ ok: false, error: String(error) }));
  } else {
    dialog.showErrorBox("CAVEQIS", String(error));
  }
  markClosing();
  app.exit(1);
}

function markClosing() {
  closing = true;
}

async function openWindow() {
  await startEngine();
  const browserSession = session.defaultSession;
  await browserSession.setProxy({ mode: "direct" });
  browserSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  browserSession.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    const local = url.origin === origin || url.protocol === "data:";
    callback({ cancel: !local });
  });
  browserSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = details.requestHeaders;
    if (new URL(details.url).origin === origin) headers["X-CAVEQIS-Session"] = token;
    callback({ requestHeaders: headers });
  });

  Menu.setApplicationMenu(null);
  window = new BrowserWindow({
    title: "CAVEQIS",
    width: 1340,
    height: 880,
    minWidth: 440,
    minHeight: 580,
    show: false,
    icon: path.join(resources, "caveqis.png"),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== origin) event.preventDefault();
  });
  window.once("close", markClosing);
  window.once("closed", () => { window = null; });
  await window.loadURL(origin);
  if (!smokeReport) {
    window.show();
  } else {
    const result = await window.webContents.executeJavaScript(`(async () => {
      const response = await fetch("/api/calculate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "calculate", operation: "evaluate", expression: "1/3+2/5" }),
      });
      const result = await response.json();
      const icon = await fetch("/static/caveqis.png");
      document.querySelector('[data-category="graph"]').click();
      document.querySelector("#graph-examples").click();
      document.querySelector('[data-graph-example-group="trigonometry"]').click();
      document.querySelector('[data-graph-example="sliders"]').click();
      const graphLoaded = !document.querySelector("#graph-panel").hidden
        && !document.querySelector("#graph-parameters").hidden;
      const ok = document.title.includes("CAVEQIS") && icon.ok
        && result.ok && result.items[0].text === "11/15" && graphLoaded;
      return { ok, title: document.title, icon: icon.status, calculation: result, graphLoaded };
    })()`);
    result.profile = app.getPath("userData");
    writeFileSync(smokeReport, JSON.stringify(result, null, 2));
    markClosing();
    app.exit(result.ok ? 0 : 1);
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", markClosing);
  app.whenReady().then(openWindow).catch(fail);
}
