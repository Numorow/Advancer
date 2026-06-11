/**
 * The dark-mode boot script — applies the saved/system theme before first
 * paint so dark mode never flashes. It runs inline in <head> (app/layout.tsx),
 * so a strict CSP must allow it.
 *
 * We authorise it by content HASH rather than a nonce: a nonce on an inline
 * script triggers a hydration mismatch (browsers blank the nonce attribute
 * after applying CSP, so SSR≠client), and a static script doesn't need a
 * per-request token anyway. THEME_BOOT_HASH below is that script's sha256 —
 * csp.ts adds it to script-src. If you edit THEME_BOOT, the hash must change
 * too; the guard test in __tests__/theme-boot.test.ts fails until it does.
 */

export const THEME_BOOT = `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})()`;

export const THEME_BOOT_HASH = "sha256-4fE4H44zk9/obXVtrkM5DwdD9Js/CTWhcII5monr6TY=";
