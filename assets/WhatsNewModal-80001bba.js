import{B as m}from"./dialog-shell-7bd3e949.js";import{f9 as f,d$ as b,v as y,fa as x}from"./editor-core-dc7d484e.js";import{d as u,e as t,z as k,A as p,y as v,g as n,f as o,F as l,v as d,u as s,l as S,x as w,S as _}from"./vendor-87b27f67.js";import{_ as T}from"./framework-d0a2e991.js";import"./focusable-12131836.js";import"./shortcuts-39d500ec.js";import"./serialization-20433395.js";const W=`# Changelog

What changed for people who use SereneTab, newest first. The app shows the newest entry once
after an update (File → What's new). Write for players, not developers: one line per change,
\`##\` headings, \`-\` points; \`**bold**\` and \`\` \`code\` \`\` work inside a line. The heading is what
"seen" remembers, so give every release a new one.

## November 2026: SereneTab is online

SereneTab is now a public website. Everything still runs in your browser: no account, no
cookies, and your songs stay on your device.

- **Sound in seconds:** the instruments now load piece by piece, the ones your song needs first, instead of one 32 MB download before the first note.
- **Fretboard or keyboard under the tab** (practice options): see where your fingers go now and on the next beats.
- **Loop handles:** drag the A and B flags on the tab to move the loop's start and end, or type the bars in the practice options. With the speed trainer, each section starts slow and remembers how far it got.
- **On phones**, the ⋯ menu has the practice options, the tuner and Print.
- **Export audio** (File menu): the song or the loop as WAV or Opus, with metronome and count-in if you like: a backing track to play along with.
- **Getting started guide** with the full shortcut list, in the File menu.
- **What's new** (this window) tells you once after an update what changed.
- **Example songs:** classical guitar pieces to listen to and play along with, under File → Example songs.
- **Score view** shows several tracks under each other; **two voices** per track, the second in its own colour.
- **Drum tracks** with drum letters on the keyboard and a step grid.
- **Lyrics** under the tab (Shift+L), read from and saved to Guitar Pro and MusicXML.
- **Practice:** loop a selection or a marked section, slow it down, and let the speed trainer bring it up to tempo; speed and loop are remembered per song.
- **About, credits and legal** under File, with the licences of the sounds and libraries.
`,N={class:"modal-stack whats-new"},B={class:"whats-new__entries",tabindex:"0",role:"region","aria-label":"Changes"},E={class:"whats-new__title"},F={class:"whats-new__items"},A={class:"whats-new__links"},L=["href"],M=u({__name:"WhatsNewModal",setup(G){const g=f(W).slice(0,5),h=u({props:{text:{type:String,required:!0}},setup(c){return()=>x(c.text).map(e=>e.strong?_("strong",e.text):e.code?_("code",e.text):e.text)}});return(c,e)=>(t(),k(m,{"modal-id":s(y).WHATS_NEW.id},{title:p(()=>[...e[0]||(e[0]=[v("What's new",-1)])]),default:p(()=>[n("div",N,[n("div",B,[(t(!0),o(l,null,d(s(g),a=>(t(),o("section",{key:a.title,class:"whats-new__entry"},[n("h3",E,S(a.title),1),(t(!0),o(l,null,d(a.intro,(r,i)=>(t(),o("p",{key:i,class:"modal-body-text"},[w(s(h),{text:r},null,8,["text"])]))),128)),n("ul",F,[(t(!0),o(l,null,d(a.items,(r,i)=>(t(),o("li",{key:i},[w(s(h),{text:r},null,8,["text"])]))),128))])]))),128))]),n("p",A,[n("a",{href:s(b),target:"_blank",rel:"noopener"},"Getting started guide",8,L)])])]),_:1},8,["modal-id"]))}});const q=T(M,[["__scopeId","data-v-53be88aa"]]);export{q as default};
