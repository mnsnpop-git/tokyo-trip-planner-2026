/*
 * Runs in <head> before the page paints (layout.tsx): puts the saved theme, or the device's,
 * on <html data-theme>. Kept outside the "use client" theme hook so the server layout can import it.
 */

export const THEME_KEY = "tokyo-trip-planner:theme";

export const THEME_SCRIPT = `(function(){try{var m=localStorage.getItem("${THEME_KEY}");var d=m==="dark"||(m!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})()`;
