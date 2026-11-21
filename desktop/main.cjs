const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, nativeTheme, session } = require("electron");
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
const iconPath = path.join(resources, "caveqis.png");
let window;
let engine;
let tray;
let closing = false;
let closeBehavior = "background";
let windowLanguage = "en";

if (smokeReport) {
  app.setPath("userData", mkdtempSync(path.join(tmpdir(), "caveqis-smoke-")));
  app.setAppLogsPath(path.join(app.getPath("userData"), "logs"));
}

function startEngine() {
  return new Promise((resolve, reject) => {
    const executable = process.platform === "win32" ? "caveqis-engine.exe" : "caveqis-engine";
    engine = spawn(path.join(resources, "engine", executable), [], {
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

function restoreWindow() {
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

function updateTrayMenu() {
  const chinese = windowLanguage === "zh";
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: chinese ? "打开 CAVEQIS" : "Open CAVEQIS", click: restoreWindow },
    { label: chinese ? "退出 CAVEQIS" : "Quit CAVEQIS", click: () => app.quit() },
  ]));
}

function backgroundWindow() {
  if (!tray) {
    try {
      tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 32, height: 32 }));
      tray.setToolTip("CAVEQIS");
      tray.on("click", restoreWindow);
      updateTrayMenu();
    } catch {
      tray?.destroy();
      tray = null;
    }
  }
  if (process.platform === "win32" && tray) window.hide();
  else window.minimize();
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
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#121622" : "#f4f6fc",
    icon: iconPath,
    webPreferences: {
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== origin) event.preventDefault();
  });
  window.on("close", event => {
    if (closing || closeBehavior === "quit") {
      markClosing();
      return;
    }
    event.preventDefault();
    backgroundWindow();
  });
  window.once("closed", () => { window = null; });
  await window.loadURL(origin);
  if (!smokeReport) {
    window.show();
    await window.webContents.executeJavaScript("window.dispatchEvent(new Event('caveqis-window-shown'))");
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
      const closeSettingLoaded = !document.querySelector("#close-behavior-row").hidden
        && document.querySelector("#close-behavior").value === "background";
      const ok = document.title.includes("CAVEQIS") && icon.ok
        && result.ok && result.items[0].text === "11/15" && graphLoaded && closeSettingLoaded;
      return { ok, title: document.title, icon: icon.status, calculation: result, graphLoaded, closeSettingLoaded };
    })()`);
    restoreWindow();
    window.close();
    result.keptRunningOnClose = Boolean(window);
    if (result.keptRunningOnClose) {
      restoreWindow();
      await window.webContents.executeJavaScript('window.CaveqisDesktop?.setWindowOptions("quit","en")');
    }
    result.ok = result.ok && result.keptRunningOnClose && closeBehavior === "quit";
    result.profile = app.getPath("userData");
    writeFileSync(smokeReport, JSON.stringify(result, null, 2));
    if (result.ok) window.close();
    else app.exit(1);
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", restoreWindow);
  ipcMain.handle("caveqis:window-options", (event, behavior, language) => {
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) return;
    if (!["background", "quit"].includes(behavior) || !["en", "zh"].includes(language)) return;
    closeBehavior = behavior;
    windowLanguage = language;
    if (!tray) return;
    if (closeBehavior === "quit") {
      tray.destroy();
      tray = null;
    } else {
      updateTrayMenu();
    }
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", markClosing);
  app.whenReady().then(openWindow).catch(fail);
}
