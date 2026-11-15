/**
 * Runs before first paint, so a saved light theme never flashes dark.
 * `?theme=light|dark` overrides for one visit without saving (handy for screenshots).
 */
export const themeScript = `(function(){try{["localStorage","sessionStorage"].forEach(function(n){var s=window[n];for(var i=s.length-1;i>=0;i--){var k=s.key(i);if(k&&k.indexOf("gpuchain.")===0){var nk="ekido."+k.slice(9);if(s.getItem(nk)===null)s.setItem(nk,s.getItem(k));s.removeItem(k);}}})}catch(e){}try{var q=new URLSearchParams(location.search),d=document.documentElement,t=q.get("theme")||localStorage.getItem("ekido.theme");if(t==="light"||t==="dark")d.setAttribute("data-theme",t)}catch(e){}})()`;
