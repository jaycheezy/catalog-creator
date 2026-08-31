"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[117],{117:(e,t,n)=>{n.d(t,{htmlToPngDataUrl:()=>o});async function o(e){let t=e.getBoundingClientRect(),n=Math.round(t.width),o=Math.round(t.height),r=e.cloneNode(!0).outerHTML,a=new Blob([`
    <svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${o}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">${r}</div>
      </foreignObject>
    </svg>
  `.trim()],{type:"image/svg+xml;charset=utf-8"}),g=URL.createObjectURL(a);return new Promise((e,t)=>{let r=new Image;r.crossOrigin="anonymous",r.onload=()=>{let a=document.createElement("canvas");a.width=2*n,a.height=2*o;let h=a.getContext("2d");h?(h.scale(2,2),h.drawImage(r,0,0),URL.revokeObjectURL(g),e(a.toDataURL("image/png"))):t(Error("No 2d context"))},r.onerror=e=>{URL.revokeObjectURL(g),t(e)},r.src=g})}}}]);