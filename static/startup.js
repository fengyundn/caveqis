(() => {
  "use strict";
  function preference(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }

  const theme = preference("shuyan-theme", "system");
  const dark = theme === "dark" || theme === "system" &&
    (window.CaveqisNative?.isSystemDark?.() ?? window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.body.classList.toggle("dark", dark);
  if (preference("caveqis-startup-animation", true) === false) return;

  const splash = document.getElementById("app-splash");
  const play = () => {
    splash.classList.add("playing");
    window.setTimeout(() => { splash.hidden = true; }, 750);
  };
  splash.hidden = false;
  if (/\bElectron\//.test(navigator.userAgent)) {
    window.addEventListener("caveqis-window-shown", play, {once:true});
  } else {
    play();
  }
})();
