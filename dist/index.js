(()=>{var w=function(e,t){let r=typeof e;return typeof t!="string"||t.trim()===""?e:t?.toLowerCase()==="true"&&r==="boolean"?!0:t?.toLowerCase()==="false"&&r==="boolean"?!1:isNaN(t)&&r==="string"?t:!isNaN(t)&&r==="number"?+t:e};var T=function(e,t){if(!e||!t){console.error(`GSAP check Run Error in ${t}`);return}let r=`data-ix-${t}-run`;return w(!0,e.getAttribute(r))!==!1};var M=function(e,t){if(!e){console.error("No interactionID provided to getIxConfig");return}let r=document.querySelector(`[data-ix-${e}-page-run]`);if(w(!0,r?.getAttribute(`data-ix-${e}-page-run`))===!1)return document.querySelector("body").setAttribute(`data-ix-${e}-page-run`,"false"),!1;if(typeof window.ixConfig>"u")return t;let o=window.ixConfig[e];return o===!1?!1:!o||typeof o!="object"?t:Object.assign({},t,o)};var ae={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};function A(e,t,r){let{startDate:n,endDate:o,recurringFrequency:l="None",recurringInterval:u=1,recurringDays:m=[],recurringSkipDates:p=[]}=e;if(!n)return[];if(!l||l==="None"){let h=o||n;return h<t||n>r?[]:[{start:n,end:h}]}let a=u>0?u:1,d=new Set(p),s=E(n),y=o?E(o):null,c=y&&y.getTime()!==s.getTime()?y:null,i=o?o.getHours():n.getHours(),g=o?o.getMinutes():n.getMinutes(),x=n>t?n:t,v=c&&c<r?c:r,b=E(v),f=x>n?E(x):s;if(f>b)return[];let S=m.length?m.map(h=>ae[h]).filter(h=>h!==void 0):[n.getDay()],N=h=>{switch(l){case"Daily":return j(s,h)%a===0;case"Weekly":return S.includes(h.getDay())&&ce(z(s),z(h))%a===0;case"Monthly (same date)":{let R=Math.min(n.getDate(),J(h.getFullYear(),h.getMonth()));return h.getDate()===R&&H(s,h)%a===0}case"Monthly (same day of the week)":return h.getDay()===n.getDay()&&Math.ceil(h.getDate()/7)===Math.ceil(n.getDate()/7)&&H(s,h)%a===0;case"Yearly":{let R=Math.min(n.getDate(),J(h.getFullYear(),n.getMonth()));return h.getMonth()===n.getMonth()&&h.getDate()===R&&(h.getFullYear()-n.getFullYear())%a===0}default:return!1}},D=[];for(;f<=b;)N(f)&&!d.has(le(f))&&D.push({start:P(f,n.getHours(),n.getMinutes()),end:P(f,i,g)}),f=ie(f,1);return D}function L(e){return{id:e.slug||e.name,name:e.name||"",slug:e.slug||"",startDate:B(e.startDateTime),endDate:B(e.endDateTime),showStartTime:F(e.showStartTime),showEndTime:F(e.showEndTime),showEndDate:F(e.showEndDate),eventType:e.eventType||"",shortDescription:e.shortDescription||"",location:e.location||"",address:e.address||"",timezone:e.timezone||"",recurringFrequency:e.recurringFrequency&&e.recurringFrequency.trim()?e.recurringFrequency.trim():"None",recurringInterval:se(e.recurringInterval),recurringDays:W(e.recurringDays),recurringSkipDates:W(e.recurringSkipDates)}}function B(e){if(!e)return null;let t=e.trim();if(!t)return null;let r=t.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})\s*(am|pm)$/i);if(r){let[,o,l,u,m,p,a]=r,d=parseInt(m,10);return a.toLowerCase()==="pm"&&d<12&&(d+=12),a.toLowerCase()==="am"&&d===12&&(d=0),new Date(+o,+l-1,+u,d,+p)}let n=new Date(t);return isNaN(n.getTime())?null:n}function se(e){if(e==null)return 1;let t=String(e).trim();if(t===""||t==="-1")return 1;let r=parseInt(t,10);return Number.isFinite(r)&&r>0?r:1}function W(e){return e?e.split(",").map(t=>t.trim()).filter(Boolean):[]}function F(e){return typeof e=="boolean"?e:typeof e=="string"?e.trim().toLowerCase()==="true":!1}function E(e){return new Date(e.getFullYear(),e.getMonth(),e.getDate())}function z(e){let t=E(e);return t.setDate(t.getDate()-t.getDay()),t}function ie(e,t){return new Date(e.getFullYear(),e.getMonth(),e.getDate()+t)}function j(e,t){return Math.round((E(t)-E(e))/864e5)}function ce(e,t){return Math.round(j(e,t)/7)}function H(e,t){return(t.getFullYear()-e.getFullYear())*12+(t.getMonth()-e.getMonth())}function J(e,t){return new Date(e,t+1,0).getDate()}function P(e,t,r){return new Date(e.getFullYear(),e.getMonth(),e.getDate(),t,r)}function le(e){let t=e.getFullYear(),r=String(e.getMonth()+1).padStart(2,"0"),n=String(e.getDate()).padStart(2,"0");return`${t}-${r}-${n}`}var U='[data-ix-events="data-wrap"]',de='[data-ix-events="item"]',ue='[data-ix-events="data"]',me=20,fe=300;function C(e){let t=0,r=()=>{let n=document.querySelectorAll(U);n.length>1&&console.warn(`events: found ${n.length} elements matching ${U} \u2014 using the first one. Remove the extras to avoid duplicate or conflicting event data.`);let o=n[0],l=o?[...o.querySelectorAll(de)]:[];if(l.length===0){if(t++,t<me){setTimeout(r,fe);return}e([]);return}let u=l.map(m=>{let p=m.querySelector(ue);if(!p)return null;try{let a=L(JSON.parse(p.textContent));return a.startDate?a:null}catch(a){return console.warn("events: could not parse event JSON",m,a),null}}).filter(Boolean);e(u)};r()}var O="events",ge="list",he='[data-ix-events="wrap"]',pe='[data-ix-events="prev"]',ye='[data-ix-events="next"]',xe='[data-ix-events="label"]',be='[data-ix-events="item"]',ve='[data-ix-events="data"]',De='[data-ix-events="card"]',Ee="[data-ix-events-date]",G="data-ix-events-slug",X="data-ix-events-clone",Se=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],we=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],K=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],Z=["January","February","March","April","May","June","July","August","September","October","November","December"],V=function(){if(M(O,!0)===!1)return;let t=[...document.querySelectorAll(he)].filter(r=>r.getAttribute("data-ix-events-layout")===ge);t.length!==0&&C(r=>{let n=new Map(r.map(o=>[o.slug,o]));t.forEach(o=>_e(o,n))})};function _e(e,t){if(T(e,O)===!1)return;let r=w("expand",e.getAttribute(`data-ix-${O}-mode`)),n=e.querySelector(xe),o=e.querySelector(pe),l=e.querySelector(ye),u=[...e.querySelectorAll(be)].filter(s=>s.querySelector(De));if(u.length===0)return;let m=u.map(s=>{let y=s.querySelector(ve),c;if(y)try{c=L(JSON.parse(y.textContent))}catch(i){return console.warn("event-list: could not parse event JSON",s,i),null}else{let i=s.getAttribute(G);if(c=i?t.get(i):null,!c)return console.warn(`event-list: no matching event data for slug "${i}" \u2014 bind ${G} on this card to the Slug field.`,s),null}return c.startDate?{item:s,event:c}:null}).filter(Boolean);if(m.length===0)return;let p=m[0].item.parentElement,a=new Date;a.setDate(1);let d=()=>{p.querySelectorAll(`[${X}]`).forEach(i=>i.remove());let s=new Date(a.getFullYear(),a.getMonth(),1),y=new Date(a.getFullYear(),a.getMonth()+1,0,23,59,59),c=[];m.forEach(({item:i,event:g})=>{let x=A(g,s,y).sort((f,S)=>f.start-S.start);if(x.length===0){i.style.display="none";return}i.style.display="";let[v,...b]=x;if(Q(i,v,g),c.push({el:i,date:v.start}),r!=="single"){let f=i;b.forEach((S,N)=>{let D=i.cloneNode(!0);D.setAttribute(X,""),Me(D,`occ-${N+1}`),Q(D,S,g),f.insertAdjacentElement("afterend",D),f=D,c.push({el:D,date:S.start})})}}),c.sort((i,g)=>i.date-g.date),c.forEach(({el:i},g)=>{i.style.order=g}),n&&(n.textContent=a.toLocaleDateString("en-US",{month:"long",year:"numeric"}))};d(),o?.addEventListener("click",()=>{a.setMonth(a.getMonth()-1),d()}),l?.addEventListener("click",()=>{a.setMonth(a.getMonth()+1),d()})}function Q(e,t,r){e.querySelectorAll(Ee).forEach(n=>{let o=n.getAttribute("data-ix-events-date");n.textContent=Te(o,t,r)})}function Te(e,t,r){let{start:n,end:o}=t;switch(e){case"day":return String(n.getDate());case"weekday-short":return Se[n.getDay()];case"weekday-full":return we[n.getDay()];case"month-short":return K[n.getMonth()];case"month-full":return Z[n.getMonth()];case"year":return String(n.getFullYear());case"date-short":return`${K[n.getMonth()]} ${n.getDate()}`;case"date-full":return`${Z[n.getMonth()]} ${n.getDate()}, ${n.getFullYear()}`;case"time":return r.showStartTime?k(n):"";case"time-range":return r.showEndTime?`${k(n)} \u2013 ${k(o)}`:k(n);default:return""}}function k(e){let t=e.getHours(),r=e.getMinutes(),n=t>=12?"PM":"AM";return t=t%12||12,r===0?`${t} ${n}`:`${t}:${String(r).padStart(2,"0")} ${n}`}function Me(e,t){e.hasAttribute("id")&&(e.id=`${e.id}-${t}`),e.removeAttribute("data-w-id"),e.querySelectorAll("[id]").forEach(r=>{r.id=`${r.id}-${t}`}),e.querySelectorAll("[data-w-id]").forEach(r=>{r.removeAttribute("data-w-id")})}var I="events",Ae="calendar",Le='[data-ix-events="wrap"]',Ce=["January","February","March","April","May","June","July","August","September","October","November","December"],ke=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],ee=[["--_theme---text--text-accent","#2563eb"],["--_theme---border--border-secondary","#6b7280"],["--_theme---text--text-primary","#1f2937"]],te=!1,oe=function(){if(M(I,!0)===!1)return;let t=[...document.querySelectorAll(Le)].filter(r=>r.getAttribute("data-ix-events-layout")===Ae);t.length!==0&&(Pe(),t.forEach(r=>{T(r,I)!==!1&&$e(r)}))};function $e(e){let t=w(6,e.getAttribute(`data-ix-${I}-months`)),r=new Date,n={year:r.getFullYear(),month:r.getMonth(),events:[],loading:!0};e.classList.add("ix-calendar"),e.style.position="relative",e.innerHTML="";let o=Ne(),l=Re(),u=Fe(),m=Oe();e.append(o.el,l.weekdayRow,l.gridEl,u,m.el);let p=new Date(r.getFullYear(),r.getMonth()-t,1),a=new Date(r.getFullYear(),r.getMonth()+t,1),d=()=>new Date(n.year,n.month-1,1)>=p,s=()=>new Date(n.year,n.month+1,1)<=a;o.prevBtn.addEventListener("click",()=>{d()&&(y(-1),c())}),o.nextBtn.addEventListener("click",()=>{s()&&(y(1),c())});function y(i){let g=new Date(n.year,n.month+i,1);n.year=g.getFullYear(),n.month=g.getMonth()}function c(){o.label.textContent=`${Ce[n.month]} ${n.year}`,o.prevBtn.disabled=!d(),o.nextBtn.disabled=!s();let i=new Date(n.year,n.month-1,1),g=new Date(n.year,n.month+2,0,23,59,59),x=[];n.events.forEach(v=>{A(v,i,g).forEach(b=>{x.push({event:v,start:b.start,end:b.end})})}),Ye(l,n.year,n.month,x,r,m,e)}c(),C(i=>{let g=i.length===0;if(n.events=g?We():i,n.loading=!1,u.style.display="none",g){let x=document.createElement("p");x.className="ix-calendar_demo-note",x.textContent="No events data-wrap found on this page \u2014 showing sample data.",e.append(x)}c()})}function Ne(){let e=document.createElement("div");e.className="ix-calendar_header";let t=document.createElement("button");t.type="button",t.className="ix-calendar_nav-btn",t.setAttribute("aria-label","Previous month"),t.innerHTML=ne("M15 18l-6-6 6-6");let r=document.createElement("h2");r.className="ix-calendar_label";let n=document.createElement("button");return n.type="button",n.className="ix-calendar_nav-btn",n.setAttribute("aria-label","Next month"),n.innerHTML=ne("M9 18l6-6-6-6"),e.append(t,r,n),{el:e,prevBtn:t,label:r,nextBtn:n}}function ne(e){return`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${e}"/></svg>`}function Re(){let e=document.createElement("div");e.className="ix-calendar_weekdays",ke.forEach(r=>{let n=document.createElement("div");n.className="ix-calendar_weekday",n.textContent=r,e.append(n)});let t=document.createElement("div");return t.className="ix-calendar_grid",{weekdayRow:e,gridEl:t}}function Fe(){let e=document.createElement("div");return e.className="ix-calendar_loading",e.textContent="Loading events\u2026",e}function Oe(){let e=document.createElement("div");return e.className="ix-calendar_tooltip",e.style.display="none",{el:e}}function Ye(e,t,r,n,o,l,u){e.gridEl.innerHTML="";let m=new Date(t,r,1).getDay(),p=re(t,r),a=re(r===0?t-1:t,r===0?11:r-1),d=[];for(let s=m-1;s>=0;s--){let y=a-s;d.push({date:new Date(r===0?t-1:t,r===0?11:r-1,y),inMonth:!1})}for(let s=1;s<=p;s++)d.push({date:new Date(t,r,s),inMonth:!0});for(;d.length<42;){let s=d[d.length-1].date;d.push({date:ze(s,1),inMonth:!1})}d.forEach((s,y)=>{let c=document.createElement("div");c.className="ix-calendar_day",s.inMonth||c.classList.add("is-outside"),(y+1)%7===0&&c.classList.add("is-last-col");let i=s.inMonth&&_(s.date,o),g=document.createElement("div");g.className="ix-calendar_day-number-row";let x=document.createElement("span");if(x.className="ix-calendar_day-number"+(i?" is-today":""),x.textContent=String(s.date.getDate()),g.append(x),c.append(g),s.inMonth){let v=n.filter(f=>He(s.date,f.start,f.end)),b=document.createElement("div");if(b.className="ix-calendar_day-events",v.slice(0,2).forEach(f=>{b.append(qe(f,s.date,n,l,u))}),v.length>2){let f=document.createElement("span");f.className="ix-calendar_more",f.textContent=`+${v.length-2} more`,b.append(f)}c.append(b)}e.gridEl.append(c)})}function qe(e,t,r,n,o){let l=_(t,e.start),u=_(t,e.end),m=l&&u?"single":l?"start":u?"end":"middle",p=ee[Je(e.event.id)%ee.length],a=document.createElement("a");return a.className=`ix-calendar_pill is-${m}`,a.href=`/event/${e.event.slug}`,a.style.setProperty("--pill-color",`var(${p[0]}, ${p[1]})`),a.textContent=m==="single"||m==="start"?e.event.name:"\xA0",a.addEventListener("mouseenter",()=>Ie(n,e,a,o)),a.addEventListener("mouseleave",()=>Be(n)),a}function Ie(e,t,r,n){let{event:o,start:l,end:u}=t,m=n.getBoundingClientRect(),p=r.getBoundingClientRect(),a=l.toLocaleDateString("en-US",{month:"short",day:"numeric"});_(l,u)||(a+=` \u2013 ${u.toLocaleDateString("en-US",{month:"short",day:"numeric"})}`),o.showStartTime&&(a+=` \xB7 ${q(l)}`),o.showEndTime&&!_(l,u)?a+=` \u2013 ${q(u)}`:o.showEndTime&&o.showStartTime&&u.getTime()!==l.getTime()&&(a+=` \u2013 ${q(u)}`),e.el.innerHTML=`
    <h3 class="ix-calendar_tooltip-title">${$(o.name)}</h3>
    <div class="ix-calendar_tooltip-meta">${$(a)}</div>
    ${o.location?`<div class="ix-calendar_tooltip-meta">${$(o.location)}</div>`:""}
    ${o.shortDescription?`<p class="ix-calendar_tooltip-desc">${$(o.shortDescription)}</p>`:""}
  `;let d=256,s=p.left-m.left+p.width/2,y=Math.max(d/2,Math.min(s,m.width-d/2));e.el.style.left=`${y}px`,e.el.style.top=`${p.top-m.top}px`,e.el.style.display="block"}function Be(e){e.el.style.display="none"}function We(){let e=new Date,t=e.getFullYear(),r=e.getMonth();return[{id:"demo-1",name:"Community Meetup",slug:"community-meetup",startDate:new Date(t,r,8,18,0),endDate:new Date(t,r,8,20,0),showStartTime:!0,showEndTime:!0,showEndDate:!1,shortDescription:"Join us for our monthly community gathering.",location:"Community Center",timezone:"",recurringFrequency:"None",recurringInterval:1,recurringDays:[],recurringSkipDates:[]},{id:"demo-2",name:"Volunteer Week",slug:"volunteer-week",startDate:new Date(t,r,20,9,0),endDate:new Date(t,r,24,17,0),showStartTime:!1,showEndTime:!1,showEndDate:!0,shortDescription:"A full week of volunteer opportunities.",location:"Various Locations",timezone:"",recurringFrequency:"None",recurringInterval:1,recurringDays:[],recurringSkipDates:[]},{id:"demo-3",name:"Small Group",slug:"small-group",startDate:new Date(t,r,3,18,0),endDate:new Date(t,r,3,19,30),showStartTime:!0,showEndTime:!0,showEndDate:!1,shortDescription:"Biweekly small group discussion.",location:"Room 204",timezone:"",recurringFrequency:"Weekly",recurringInterval:2,recurringDays:[],recurringSkipDates:[]}]}function re(e,t){return new Date(e,t+1,0).getDate()}function ze(e,t){return new Date(e.getFullYear(),e.getMonth(),e.getDate()+t)}function Y(e){return new Date(e.getFullYear(),e.getMonth(),e.getDate())}function _(e,t){return e.getFullYear()===t.getFullYear()&&e.getMonth()===t.getMonth()&&e.getDate()===t.getDate()}function He(e,t,r){let n=Y(e);return n>=Y(t)&&n<=Y(r)}function q(e){let t=e.getHours(),r=e.getMinutes(),n=t>=12?"PM":"AM";return t=t%12||12,r===0?`${t} ${n}`:`${t}:${String(r).padStart(2,"0")} ${n}`}function Je(e){let t=0;for(let r=0;r<e.length;r++)t=t*31+e.charCodeAt(r)>>>0;return t}function $(e){let t=document.createElement("div");return t.textContent=e,t.innerHTML}function Pe(){if(te)return;te=!0;let e=document.createElement("style");e.textContent=`
.ix-calendar {
  font-family: inherit;
  color: var(--_theme---text--text-primary, #1f2937);
}
.ix-calendar_header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--_theme---border--border-primary, #e5e7eb);
}
.ix-calendar_label {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.ix-calendar_nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.375rem;
  border: 1px solid var(--_theme---button-secondary--border, var(--_theme---border--border-primary, #e5e7eb));
  background: var(--_theme---button-secondary--background, transparent);
  color: var(--_theme---icon--icon-primary, var(--_theme---text--text-primary, #1f2937));
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
}
.ix-calendar_nav-btn:hover:not(:disabled) {
  background: var(--_theme---button-secondary--background-hover, var(--_theme---text--text-primary, #1f2937));
  border-color: var(--_theme---button-secondary--border-hover, transparent);
  color: var(--_theme---button-secondary--text-hover, var(--_theme---background--background-primary, #fff));
}
.ix-calendar_nav-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.ix-calendar_weekdays,
.ix-calendar_grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}
.ix-calendar_weekday {
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.5rem 0;
  color: var(--_theme---text--text-faded, #9ca3af);
}
.ix-calendar_grid {
  border-top: 1px solid var(--_theme---border--border-primary, #e5e7eb);
  border-left: 1px solid var(--_theme---border--border-primary, #e5e7eb);
  border-radius: 0.5rem;
  overflow: hidden;
}
.ix-calendar_day {
  min-height: 5.5rem;
  padding: 0.375rem;
  border-right: 1px solid var(--_theme---border--border-primary, #e5e7eb);
  border-bottom: 1px solid var(--_theme---border--border-primary, #e5e7eb);
  background: var(--_theme---background--background-primary, #fff);
}
.ix-calendar_day.is-outside {
  background: var(--_theme---background--background-secondary, #f9fafb);
}
.ix-calendar_day-number-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.25rem;
}
.ix-calendar_day-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: var(--_theme---text--text-faded, #9ca3af);
}
.ix-calendar_day:not(.is-outside) .ix-calendar_day-number {
  color: var(--_theme---text--text-primary, #1f2937);
}
.ix-calendar_day-number.is-today {
  width: 1.625rem;
  height: 1.625rem;
  font-weight: 700;
  border-radius: 100vw;
  background: var(--_theme---text--text-primary, #1f2937);
  color: var(--_theme---background--background-primary, #fff);
}
.ix-calendar_day-events {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ix-calendar_pill {
  display: block;
  font-size: 0.625rem;
  font-weight: 500;
  line-height: 1.3;
  padding: 2px 4px;
  background: var(--pill-color);
  color: #fff;
  text-decoration: none;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: pointer;
}
.ix-calendar_pill.is-single { border-radius: 3px; }
.ix-calendar_pill.is-start { border-radius: 3px 0 0 3px; margin-right: -0.375rem; }
.ix-calendar_pill.is-end { border-radius: 0 3px 3px 0; margin-left: -0.375rem; }
.ix-calendar_pill.is-middle { border-radius: 0; margin-left: -0.375rem; margin-right: -0.375rem; }
.ix-calendar_more {
  font-size: 0.6rem;
  font-weight: 500;
  color: var(--_theme---text--text-faded, #6b7280);
  padding-left: 2px;
}
.ix-calendar_loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--_theme---background--background-skeleton, rgba(255, 255, 255, 0.7));
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: var(--_theme---text--text-faded, #6b7280);
  z-index: 10;
}
.ix-calendar_demo-note {
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: var(--_theme---text--text-faded, #6b7280);
  background: var(--_theme---background--background-secondary, #f9fafb);
  border-radius: 0.375rem;
  border: 1px solid var(--_theme---border--border-primary, #e5e7eb);
}
.ix-calendar_tooltip {
  position: absolute;
  transform: translate(-50%, -100%) translateY(-8px);
  z-index: 50;
  width: 16rem;
  padding: 0.75rem;
  background: var(--_theme---background--background-primary, #fff);
  border: 1px solid var(--_theme---border--border-primary, #e5e7eb);
  border-radius: 0.375rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1), 0 1px 4px rgba(0, 0, 0, 0.06);
}
.ix-calendar_tooltip-title {
  margin: 0 0 0.375rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--_theme---text--text-primary, #1f2937);
}
.ix-calendar_tooltip-meta {
  font-size: 0.6875rem;
  color: var(--_theme---text--text-faded, #6b7280);
  margin-bottom: 0.375rem;
}
.ix-calendar_tooltip-desc {
  margin: 0;
  font-size: 0.6875rem;
  line-height: 1.5;
  color: var(--_theme---text--text-faded, #6b7280);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
`,document.head.append(e)}document.addEventListener("DOMContentLoaded",function(){V(),oe()});})();
