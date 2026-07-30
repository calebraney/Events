(()=>{var S=function(e,t){let n=typeof e;return typeof t!="string"||t.trim()===""?e:t?.toLowerCase()==="true"&&n==="boolean"?!0:t?.toLowerCase()==="false"&&n==="boolean"?!1:isNaN(t)&&n==="string"?t:!isNaN(t)&&n==="number"?+t:e};var ge={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};function Y(e,t,n){let{startDate:r,endDate:o,recurringEndDate:a,recurringFrequency:s="None",recurringInterval:d=1,recurringDays:m=[],recurringSkipDates:i=[]}=e;if(!r)return[];if(!s||s==="None"){let h=o||r;return h<t||r>n?[]:[{start:r,end:h}]}let l=d>0?d:1,u=new Set(i),c=w(r),p=a?w(a):null,g=o?o.getHours():r.getHours(),f=o?o.getMinutes():r.getMinutes(),v=s==="Weekly"&&m.length>0,x=o&&!v?U(c,w(o)):0,D=r>t?r:t,y=p&&p<n?p:n,M=w(y),b=D>r?w(D):c;if(b>M)return[];let F=m.length?m.map(h=>ge[h]).filter(h=>h!==void 0):[r.getDay()],R=h=>{switch(s){case"Daily":return U(c,h)%l===0;case"Weekly":return F.includes(h.getDay())&&ye(K(c),K(h))%l===0;case"Monthly (same date)":{let k=Math.min(r.getDate(),V(h.getFullYear(),h.getMonth()));return h.getDate()===k&&Q(c,h)%l===0}case"Monthly (same day of the week)":return h.getDay()===r.getDay()&&Math.ceil(h.getDate()/7)===Math.ceil(r.getDate()/7)&&Q(c,h)%l===0;case"Yearly":{let k=Math.min(r.getDate(),V(h.getFullYear(),r.getMonth()));return h.getMonth()===r.getMonth()&&h.getDate()===k&&(h.getFullYear()-r.getFullYear())%l===0}default:return!1}},E=[];for(;b<=M;)R(b)&&!u.has(De(b))&&E.push({start:ee(b,r.getHours(),r.getMinutes()),end:ee(Z(b,x),g,f)}),b=Z(b,1);return E}function $(e){return{id:e.slug||e.name,name:e.name||"",slug:e.slug||"",startDate:j(e.startDateTime),endDate:j(e.endDateTime),recurringEndDate:he(e.recurringEndDate),showStartTime:H(e.showStartTime),showEndTime:H(e.showEndTime),showEndDate:H(e.showEndDate),eventType:e.eventType||"",shortDescription:e.shortDescription||"",location:e.location||"",address:e.address||"",timezone:e.timezone||"",recurringFrequency:e.recurringFrequency&&e.recurringFrequency.trim()?e.recurringFrequency.trim():"None",recurringInterval:pe(e.recurringInterval),recurringDays:X(e.recurringDays),recurringSkipDates:X(e.recurringSkipDates)}}function j(e){if(!e)return null;let t=e.trim();if(!t)return null;let n=t.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})\s*(am|pm)$/i);if(n){let[,o,a,s,d,m,i]=n,l=parseInt(d,10);return i.toLowerCase()==="pm"&&l<12&&(l+=12),i.toLowerCase()==="am"&&l===12&&(l=0),new Date(+o,+a-1,+s,l,+m)}let r=new Date(t);return isNaN(r.getTime())?null:r}var fe=["January","February","March","April","May","June","July","August","September","October","November","December"];function he(e){if(!e)return null;let t=e.trim();if(!t)return null;let n=t.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);if(n){let[,o,a,s]=n,d=fe.findIndex(m=>m.toLowerCase()===o.toLowerCase());if(d!==-1)return new Date(+s,d,+a)}let r=new Date(t);return isNaN(r.getTime())?null:r}function pe(e){if(e==null)return 1;let t=String(e).trim();if(t===""||t==="-1")return 1;let n=parseInt(t,10);return Number.isFinite(n)&&n>0?n:1}function X(e){return e?e.split(",").map(t=>t.trim()).filter(Boolean):[]}function H(e){return typeof e=="boolean"?e:typeof e=="string"?e.trim().toLowerCase()==="true":!1}function w(e){return new Date(e.getFullYear(),e.getMonth(),e.getDate())}function K(e){let t=w(e);return t.setDate(t.getDate()-t.getDay()),t}function Z(e,t){return new Date(e.getFullYear(),e.getMonth(),e.getDate()+t)}function U(e,t){return Math.round((w(t)-w(e))/864e5)}function ye(e,t){return Math.round(U(e,t)/7)}function Q(e,t){return(t.getFullYear()-e.getFullYear())*12+(t.getMonth()-e.getMonth())}function V(e,t){return new Date(e,t+1,0).getDate()}function ee(e,t,n){return new Date(e.getFullYear(),e.getMonth(),e.getDate(),t,n)}function De(e){let t=e.getFullYear(),n=String(e.getMonth()+1).padStart(2,"0"),r=String(e.getDate()).padStart(2,"0");return`${t}-${n}-${r}`}var te='[data-ix-events="data-wrap"]',ve='[data-ix-events="item"]',be='[data-ix-events="data"]',xe=20,Me=300;function N(e){let t=0,n=()=>{let r=document.querySelectorAll(te);r.length>1&&console.warn(`events: found ${r.length} elements matching ${te} \u2014 using the first one. Remove the extras to avoid duplicate or conflicting event data.`);let o=r[0],a=o?[...o.querySelectorAll(ve)]:[];if(a.length===0){if(t++,t<xe){setTimeout(n,Me);return}e([]);return}let s=a.map(d=>{let m=d.querySelector(be);if(!m)return null;try{let i=$(JSON.parse(m.textContent));return i.startDate?i:null}catch(i){return console.warn("events: could not parse event JSON",d,i),null}}).filter(Boolean);e(s)};n()}var q="events",we="list",Ee='[data-ix-events="wrap"]',_e='[data-ix-events="prev"]',Se='[data-ix-events="next"]',Te='[data-ix-events="today"]',ke='[data-ix-events="label"]',Ae='[data-ix-events="item"]',Fe='[data-ix-events="data"]',Ye='[data-ix-events="card"]',$e='[data-ix-events="date"]',ne="data-ix-events-slug",re="data-ix-events-clone",Ne=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],Le=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],Be=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],W=["January","February","March","April","May","June","July","August","September","October","November","December"],se=function(){let e=[...document.querySelectorAll(Ee)].filter(t=>t.getAttribute("data-ix-events-layout")===we);console.log('[event-list] DEBUG wraps with layout="list" found:',e.length,e),e.length!==0&&N(t=>{console.log("[event-list] DEBUG whenEvents callback fired, events received:",t.length,t);let n=new Map(t.map(o=>[o.slug,o])),r=e.map(o=>Oe(o,n)).filter(Boolean);console.log("[event-list] DEBUG configs built:",r.length,r),r.length!==0&&(window.FinsweetAttributes||(window.FinsweetAttributes=[]),window.FinsweetAttributes.push(["list",o=>{console.log("[event-list] DEBUG Finsweet list callback fired, listInstances found:",o.length,o),r.forEach(a=>{let s=o.find(d=>d.listElement===a.list);if(console.log("[event-list] DEBUG matching Finsweet instance for config.list:",a.list,"-> found:",!!s),!s){console.warn('event-list: no Finsweet List instance found for this Collection List \u2014 add fs-list-element="list" to it.',a.list);return}Ce(a,s)})}]))})};function Oe(e,t){let n=S(!0,e.getAttribute(`data-ix-${q}-duplicate-recurring`)),r=S("month",e.getAttribute(`data-ix-${q}-range`));r!=="month"&&r!=="week"&&(r="month");let o=S("sunday",e.getAttribute(`data-ix-${q}-week-start`))==="monday"?1:0,a=e.querySelector(ke),s=e.querySelector(_e),d=e.querySelector(Se),m=e.querySelector(Te);console.log("[event-list] DEBUG buildListConfig: duplicateRecurring =",n,"| range =",r,"| weekStartDay =",o,"| label found:",!!a,"| prevBtn found:",!!s,"| nextBtn found:",!!d,"| todayBtn found:",!!m);let i=[...e.querySelectorAll(Ae)].filter(c=>c.querySelector(Ye));if(console.log("[event-list] DEBUG buildListConfig: items with a card descendant found in wrap:",i.length,i),i.length===0)return null;let l=i.map(c=>{let p=c.querySelector(Fe),g;if(p)try{g=$(JSON.parse(p.textContent))}catch(f){return console.warn("event-list: could not parse event JSON",c,f),null}else{let f=c.getAttribute(ne);if(g=f?t.get(f):null,!g)return console.warn(`event-list: no matching event data for slug "${f}" \u2014 bind ${ne} on this card to the Slug field.`,c),null}return g.startDate?{item:c,event:g}:null}).filter(Boolean);if(console.log("[event-list] DEBUG buildListConfig: successfully paired entries:",l.length,l),l.length===0)return null;let u=l[0].item.parentElement;return console.log("[event-list] DEBUG buildListConfig: resolved `list` container element:",u),{duplicateRecurring:n,range:r,weekStartDay:o,label:a,prevBtn:s,nextBtn:d,todayBtn:m,entries:l,list:u}}function Ce(e,t){let{duplicateRecurring:n,range:r,weekStartDay:o,label:a,prevBtn:s,nextBtn:d,todayBtn:m,entries:i,list:l}=e,u=new Map(i.map(({item:g,event:f})=>[g,f]));console.log("[event-list] DEBUG initList: registering hook, listInstance =",t);let c=oe(new Date,r,o);t.addHook("filter",g=>{let{start:f,end:v}=Ue(c,r);console.log("[event-list] DEBUG filter hook FIRED. items received from Finsweet:",g.length,g,"| active range:",f,"-",v);let x=l.querySelectorAll(`[${re}]`);console.log("[event-list] DEBUG removing stale clones from previous pass:",x.length),x.forEach(y=>y.remove());let D=[];return g.forEach(y=>{let M=u.get(y.element);if(!M){console.log("[event-list] DEBUG no matching event for this listItem.element (stale/unrecognized) \u2014 dropping:",y.element);return}let b=Y(M,f,v).sort((E,h)=>E.start-h.start);if(console.log("[event-list] DEBUG event",M.name,"-> occurrences in range:",b.length),b.length===0)return;let[F,...R]=b;if(ie(y.element,F,M),D.push({listItem:y,date:F.start,showStartTime:M.showStartTime}),n){let E=y.element;R.forEach((h,k)=>{let _=y.element.cloneNode(!0);_.setAttribute(re,""),ze(_,`occ-${k+1}`),ie(_,h,M),E.insertAdjacentElement("afterend",_),E=_,D.push({listItem:t.createItem(_),date:h.start,showStartTime:M.showStartTime})})}}),D.sort(Re),console.log("[event-list] DEBUG filter hook RETURNING",D.length,"items to Finsweet"),D.map(y=>y.listItem)});let p=()=>{if(console.log("[event-list] DEBUG refresh() called \u2014 range now:",c),a){let g=a.getAttribute("data-ix-events-label-format");a.textContent=r==="week"?Ie(c,g):T(c,g||"MMMM YYYY")}t.triggerHook("filter")};p(),s?.addEventListener("click",()=>{c=ae(c,r,-1),p()}),d?.addEventListener("click",()=>{c=ae(c,r,1),p()}),m?.addEventListener("click",()=>{c=oe(new Date,r,o),p()})}function Re(e,t){let n=B(e.date)-B(t.date);return n!==0?n:e.showStartTime!==t.showStartTime?e.showStartTime?-1:1:e.date-t.date}function B(e){return new Date(e.getFullYear(),e.getMonth(),e.getDate()).getTime()}function O(e,t){return new Date(e.getFullYear(),e.getMonth(),e.getDate()+t)}function He(e,t){let n=(e.getDay()-t+7)%7;return O(e,-n)}function oe(e,t,n){return t==="week"?He(e,n):new Date(e.getFullYear(),e.getMonth(),1)}function Ue(e,t){if(t==="week"){let n=O(e,6);return{start:e,end:new Date(n.getFullYear(),n.getMonth(),n.getDate(),23,59,59)}}return{start:e,end:new Date(e.getFullYear(),e.getMonth()+1,0,23,59,59)}}function ae(e,t,n){if(t==="week")return O(e,7*n);let r=new Date(e.getFullYear(),e.getMonth(),1);return r.setMonth(r.getMonth()+n),r}function ie(e,t,n){e.querySelectorAll($e).forEach(r=>{let o=r.getAttribute("data-ix-events-date-format")||"MMMM D, YYYY";r.textContent=Ge(o)?We(t,n):T(t.start,o)})}var L=e=>String(e).padStart(2,"0"),J=e=>e%10===1&&e%100!==11?`${e}st`:e%10===2&&e%100!==12?`${e}nd`:e%10===3&&e%100!==13?`${e}rd`:`${e}th`,qe=/YYYY|YY|MMMM|MMM|MM|M|DD|Do|D|dddd|ddd|mm|H|h|A|a/g;function T(e,t){let n=e.getHours(),r={YYYY:()=>String(e.getFullYear()),YY:()=>String(e.getFullYear()).slice(-2),MMMM:()=>W[e.getMonth()],MMM:()=>Be[e.getMonth()],MM:()=>L(e.getMonth()+1),M:()=>String(e.getMonth()+1),DD:()=>L(e.getDate()),Do:()=>J(e.getDate()),D:()=>String(e.getDate()),dddd:()=>Le[e.getDay()],ddd:()=>Ne[e.getDay()],mm:()=>L(e.getMinutes()),H:()=>String(n),h:()=>String(n%12||12),A:()=>n>=12?"PM":"AM",a:()=>n>=12?"pm":"am"};return t.replace(qe,o=>r[o]())}function Ie(e,t){let n=O(e,6);if(t)return`${T(e,t)} - ${T(n,t)}`;let o=e.getFullYear()!==n.getFullYear()?"MMM D, YYYY":"MMM D";return`${T(e,o)} - ${T(n,"MMM D, YYYY")}`}function Ge(e){return e.trim().toUpperCase()==="FULLDATE"}function We(e,t){let{start:n,end:r}=e,{showStartTime:o,showEndTime:a,showEndDate:s}=t,m=s&&B(r)!==B(n)?Je(n,r):G(n);if(!o)return m;if(!a)return`${m} at ${I(n)}`;let i=I(n),l=I(r),u=n.getHours()>=12?"pm":"am",c=r.getHours()>=12?"pm":"am",p=n.getHours()%12||12,f=u===c&&p!==12?i.slice(0,-2):i;return`${m}, ${f}-${l}`}function G(e){return`${W[e.getMonth()]} ${J(e.getDate())}`}function Je(e,t){return e.getMonth()===t.getMonth()&&e.getFullYear()===t.getFullYear()?`${W[e.getMonth()]} ${e.getDate()}-${J(t.getDate())}`:`${G(e)} - ${G(t)}`}function I(e){let t=e.getHours(),n=e.getMinutes(),r=t%12||12,o=t>=12?"pm":"am",a=n===0?"":`:${L(n)}`;return`${r}${a}${o}`}function ze(e,t){e.hasAttribute("id")&&(e.id=`${e.id}-${t}`),e.removeAttribute("data-w-id"),e.querySelectorAll("[id]").forEach(n=>{n.id=`${n.id}-${t}`}),e.querySelectorAll("[data-w-id]").forEach(n=>{n.removeAttribute("data-w-id")})}var Pe="events",je="calendar",Xe='[data-ix-events="wrap"]',Ke=["January","February","March","April","May","June","July","August","September","October","November","December"],Ze=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],le=[["--_theme---text--text-accent","#2563eb"],["--_theme---border--border-secondary","#6b7280"],["--_theme---text--text-primary","#1f2937"]],ce=!1,me=function(){let e=[...document.querySelectorAll(Xe)].filter(t=>t.getAttribute("data-ix-events-layout")===je);e.length!==0&&(ut(),e.forEach(t=>Qe(t)))};function Qe(e){let t=S(6,e.getAttribute(`data-ix-${Pe}-months`)),n=new Date,r={year:n.getFullYear(),month:n.getMonth(),events:[],loading:!0};e.classList.add("ix-calendar"),e.style.position="relative",e.innerHTML="";let o=Ve(),a=et(),s=tt(),d=nt();e.append(o.el,a.weekdayRow,a.gridEl,s,d.el);let m=new Date(n.getFullYear(),n.getMonth()-t,1),i=new Date(n.getFullYear(),n.getMonth()+t,1),l=()=>new Date(r.year,r.month-1,1)>=m,u=()=>new Date(r.year,r.month+1,1)<=i;o.prevBtn.addEventListener("click",()=>{l()&&(c(-1),p())}),o.nextBtn.addEventListener("click",()=>{u()&&(c(1),p())});function c(g){let f=new Date(r.year,r.month+g,1);r.year=f.getFullYear(),r.month=f.getMonth()}function p(){o.label.textContent=`${Ke[r.month]} ${r.year}`,o.prevBtn.disabled=!l(),o.nextBtn.disabled=!u();let g=new Date(r.year,r.month-1,1),f=new Date(r.year,r.month+2,0,23,59,59),v=[];r.events.forEach(x=>{Y(x,g,f).forEach(D=>{v.push({event:x,start:D.start,end:D.end})})}),rt(a,r.year,r.month,v,n,d,e)}p(),N(g=>{let f=g.length===0;if(r.events=f?st():g,r.loading=!1,s.style.display="none",f){let v=document.createElement("p");v.className="ix-calendar_demo-note",v.textContent="No events data-wrap found on this page \u2014 showing sample data.",e.append(v)}p()})}function Ve(){let e=document.createElement("div");e.className="ix-calendar_header";let t=document.createElement("button");t.type="button",t.className="ix-calendar_nav-btn",t.setAttribute("aria-label","Previous month"),t.innerHTML=de("M15 18l-6-6 6-6");let n=document.createElement("h2");n.className="ix-calendar_label";let r=document.createElement("button");return r.type="button",r.className="ix-calendar_nav-btn",r.setAttribute("aria-label","Next month"),r.innerHTML=de("M9 18l6-6-6-6"),e.append(t,n,r),{el:e,prevBtn:t,label:n,nextBtn:r}}function de(e){return`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${e}"/></svg>`}function et(){let e=document.createElement("div");e.className="ix-calendar_weekdays",Ze.forEach(n=>{let r=document.createElement("div");r.className="ix-calendar_weekday",r.textContent=n,e.append(r)});let t=document.createElement("div");return t.className="ix-calendar_grid",{weekdayRow:e,gridEl:t}}function tt(){let e=document.createElement("div");return e.className="ix-calendar_loading",e.textContent="Loading events\u2026",e}function nt(){let e=document.createElement("div");return e.className="ix-calendar_tooltip",e.style.display="none",{el:e}}function rt(e,t,n,r,o,a,s){e.gridEl.innerHTML="";let d=new Date(t,n,1).getDay(),m=ue(t,n),i=ue(n===0?t-1:t,n===0?11:n-1),l=[];for(let u=d-1;u>=0;u--){let c=i-u;l.push({date:new Date(n===0?t-1:t,n===0?11:n-1,c),inMonth:!1})}for(let u=1;u<=m;u++)l.push({date:new Date(t,n,u),inMonth:!0});for(;l.length<42;){let u=l[l.length-1].date;l.push({date:lt(u,1),inMonth:!1})}l.forEach((u,c)=>{let p=document.createElement("div");p.className="ix-calendar_day",u.inMonth||p.classList.add("is-outside"),(c+1)%7===0&&p.classList.add("is-last-col");let g=u.inMonth&&A(u.date,o),f=document.createElement("div");f.className="ix-calendar_day-number-row";let v=document.createElement("span");if(v.className="ix-calendar_day-number"+(g?" is-today":""),v.textContent=String(u.date.getDate()),f.append(v),p.append(f),u.inMonth){let x=r.filter(y=>ct(u.date,y.start,y.end)),D=document.createElement("div");if(D.className="ix-calendar_day-events",x.slice(0,2).forEach(y=>{D.append(ot(y,u.date,r,a,s))}),x.length>2){let y=document.createElement("span");y.className="ix-calendar_more",y.textContent=`+${x.length-2} more`,D.append(y)}p.append(D)}e.gridEl.append(p)})}function ot(e,t,n,r,o){let a=A(t,e.start),s=A(t,e.end),d=a&&s?"single":a?"start":s?"end":"middle",m=le[dt(e.event.id)%le.length],i=document.createElement("a");return i.className=`ix-calendar_pill is-${d}`,i.href=`/event/${e.event.slug}`,i.style.setProperty("--pill-color",`var(${m[0]}, ${m[1]})`),i.textContent=d==="single"||d==="start"?e.event.name:"\xA0",i.addEventListener("mouseenter",()=>at(r,e,i,o)),i.addEventListener("mouseleave",()=>it(r)),i}function at(e,t,n,r){let{event:o,start:a,end:s}=t,d=r.getBoundingClientRect(),m=n.getBoundingClientRect(),i=a.toLocaleDateString("en-US",{month:"short",day:"numeric"});A(a,s)||(i+=` \u2013 ${s.toLocaleDateString("en-US",{month:"short",day:"numeric"})}`),o.showStartTime&&(i+=` \xB7 ${P(a)}`),o.showEndTime&&!A(a,s)?i+=` \u2013 ${P(s)}`:o.showEndTime&&o.showStartTime&&s.getTime()!==a.getTime()&&(i+=` \u2013 ${P(s)}`),e.el.innerHTML=`
    <h3 class="ix-calendar_tooltip-title">${C(o.name)}</h3>
    <div class="ix-calendar_tooltip-meta">${C(i)}</div>
    ${o.location?`<div class="ix-calendar_tooltip-meta">${C(o.location)}</div>`:""}
    ${o.shortDescription?`<p class="ix-calendar_tooltip-desc">${C(o.shortDescription)}</p>`:""}
  `;let l=256,u=m.left-d.left+m.width/2,c=Math.max(l/2,Math.min(u,d.width-l/2));e.el.style.left=`${c}px`,e.el.style.top=`${m.top-d.top}px`,e.el.style.display="block"}function it(e){e.el.style.display="none"}function st(){let e=new Date,t=e.getFullYear(),n=e.getMonth();return[{id:"demo-1",name:"Community Meetup",slug:"community-meetup",startDate:new Date(t,n,8,18,0),endDate:new Date(t,n,8,20,0),showStartTime:!0,showEndTime:!0,showEndDate:!1,shortDescription:"Join us for our monthly community gathering.",location:"Community Center",timezone:"",recurringFrequency:"None",recurringInterval:1,recurringDays:[],recurringSkipDates:[]},{id:"demo-2",name:"Volunteer Week",slug:"volunteer-week",startDate:new Date(t,n,20,9,0),endDate:new Date(t,n,24,17,0),showStartTime:!1,showEndTime:!1,showEndDate:!0,shortDescription:"A full week of volunteer opportunities.",location:"Various Locations",timezone:"",recurringFrequency:"None",recurringInterval:1,recurringDays:[],recurringSkipDates:[]},{id:"demo-3",name:"Small Group",slug:"small-group",startDate:new Date(t,n,3,18,0),endDate:new Date(t,n,3,19,30),showStartTime:!0,showEndTime:!0,showEndDate:!1,shortDescription:"Biweekly small group discussion.",location:"Room 204",timezone:"",recurringFrequency:"Weekly",recurringInterval:2,recurringDays:[],recurringSkipDates:[]}]}function ue(e,t){return new Date(e,t+1,0).getDate()}function lt(e,t){return new Date(e.getFullYear(),e.getMonth(),e.getDate()+t)}function z(e){return new Date(e.getFullYear(),e.getMonth(),e.getDate())}function A(e,t){return e.getFullYear()===t.getFullYear()&&e.getMonth()===t.getMonth()&&e.getDate()===t.getDate()}function ct(e,t,n){let r=z(e);return r>=z(t)&&r<=z(n)}function P(e){let t=e.getHours(),n=e.getMinutes(),r=t>=12?"PM":"AM";return t=t%12||12,n===0?`${t} ${r}`:`${t}:${String(n).padStart(2,"0")} ${r}`}function dt(e){let t=0;for(let n=0;n<e.length;n++)t=t*31+e.charCodeAt(n)>>>0;return t}function C(e){let t=document.createElement("div");return t.textContent=e,t.innerHTML}function ut(){if(ce)return;ce=!0;let e=document.createElement("style");e.textContent=`
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
`,document.head.append(e)}document.addEventListener("DOMContentLoaded",function(){se(),me()});})();
