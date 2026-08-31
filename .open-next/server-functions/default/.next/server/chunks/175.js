"use strict";exports.id=175,exports.ids=[175],exports.modules={1175:(a,b,c)=>{c.d(b,{htmlToPngDataUrl:()=>d});async function d(a){let b=a.getBoundingClientRect(),c=Math.round(b.width),d=Math.round(b.height),e=a.cloneNode(!0).outerHTML,f=new Blob([`
    <svg xmlns="http://www.w3.org/2000/svg" width="${c}" height="${d}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">${e}</div>
      </foreignObject>
    </svg>
  `.trim()],{type:"image/svg+xml;charset=utf-8"}),g=URL.createObjectURL(f);return new Promise((a,b)=>{let e=new Image;e.crossOrigin="anonymous",e.onload=()=>{let f=document.createElement("canvas");f.width=2*c,f.height=2*d;let h=f.getContext("2d");h?(h.scale(2,2),h.drawImage(e,0,0),URL.revokeObjectURL(g),a(f.toDataURL("image/png"))):b(Error("No 2d context"))},e.onerror=a=>{URL.revokeObjectURL(g),b(a)},e.src=g})}}};