(()=>{var M=function(e,t){let n=typeof e;return typeof t!="string"||t.trim()===""?e:t?.toLowerCase()==="true"&&n==="boolean"?!0:t?.toLowerCase()==="false"&&n==="boolean"?!1:isNaN(t)&&n==="string"?t:!isNaN(t)&&n==="number"?+t:e};var ke={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};function N(e,t,n){let{startDate:r,endDate:o,recurringEndDate:a,recurringFrequency:i="None",recurringInterval:l=1,recurringDays:c=[],recurringSkipDates:s=[]}=e;if(!r)return[];if(!i||i==="None"){let f=o||r;return f<t||r>n?[]:[{start:r,end:f}]}let d=l>0?l:1,m=new Set(s),h=k(r),u=a?k(a):null,b=o?o.getHours():r.getHours(),v=o?o.getMinutes():r.getMinutes(),g=i==="Weekly"&&c.length>0,y=o&&!g?P(h,k(o)):0,D=r>t?r:t,x=u&&u<n?u:n,w=k(x),p=D>r?k(D):h;if(p>w)return[];let E=c.length?c.map(f=>ke[f]).filter(f=>f!==void 0):[r.getDay()],S=f=>{switch(i){case"Daily":return P(h,f)%d===0;case"Weekly":return E.includes(f.getDay())&&$e(ee(h),ee(f))%d===0;case"Monthly (same date)":{let _=Math.min(r.getDate(),re(f.getFullYear(),f.getMonth()));return f.getDate()===_&&ne(h,f)%d===0}case"Monthly (same day of the week)":return f.getDay()===r.getDay()&&Math.ceil(f.getDate()/7)===Math.ceil(r.getDate()/7)&&ne(h,f)%d===0;case"Yearly":{let _=Math.min(r.getDate(),re(f.getFullYear(),r.getMonth()));return f.getMonth()===r.getMonth()&&f.getDate()===_&&(f.getFullYear()-r.getFullYear())%d===0}default:return!1}},F=[];for(;p<=w;)S(p)&&!m.has(Ne(p))&&F.push({start:oe(p,r.getHours(),r.getMinutes()),end:oe(te(p,y),b,v)}),p=te(p,1);return F}function R(e){return{id:e.slug||e.name,name:e.name||"",slug:e.slug||"",startDate:Q(e.startDateTime),endDate:Q(e.endDateTime),recurringEndDate:Le(e.recurringEndDate),showStartTime:U(e.showStartTime),showEndTime:U(e.showEndTime),showEndDate:U(e.showEndDate),eventType:e.eventType||"",shortDescription:e.shortDescription||"",location:e.location||"",address:e.address||"",timezone:e.timezone||"",recurringFrequency:e.recurringFrequency&&e.recurringFrequency.trim()?e.recurringFrequency.trim():"None",recurringInterval:Ye(e.recurringInterval),recurringDays:V(e.recurringDays),recurringSkipDates:V(e.recurringSkipDates)}}function Q(e){if(!e)return null;let t=e.trim();if(!t)return null;let n=t.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})\s*(am|pm)$/i);if(n){let[,o,a,i,l,c,s]=n,d=parseInt(l,10);return s.toLowerCase()==="pm"&&d<12&&(d+=12),s.toLowerCase()==="am"&&d===12&&(d=0),new Date(+o,+a-1,+i,d,+c)}let r=new Date(t);return isNaN(r.getTime())?null:r}var Fe=["January","February","March","April","May","June","July","August","September","October","November","December"];function Le(e){if(!e)return null;let t=e.trim();if(!t)return null;let n=t.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);if(n){let[,o,a,i]=n,l=Fe.findIndex(c=>c.toLowerCase()===o.toLowerCase());if(l!==-1)return new Date(+i,l,+a)}let r=new Date(t);return isNaN(r.getTime())?null:r}function Ye(e){if(e==null)return 1;let t=String(e).trim();if(t===""||t==="-1")return 1;let n=parseInt(t,10);return Number.isFinite(n)&&n>0?n:1}function V(e){return e?e.split(",").map(t=>t.trim()).filter(Boolean):[]}function U(e){return typeof e=="boolean"?e:typeof e=="string"?e.trim().toLowerCase()==="true":!1}function k(e){return new Date(e.getFullYear(),e.getMonth(),e.getDate())}function ee(e){let t=k(e);return t.setDate(t.getDate()-t.getDay()),t}function te(e,t){return new Date(e.getFullYear(),e.getMonth(),e.getDate()+t)}function P(e,t){return Math.round((k(t)-k(e))/864e5)}function $e(e,t){return Math.round(P(e,t)/7)}function ne(e,t){return(t.getFullYear()-e.getFullYear())*12+(t.getMonth()-e.getMonth())}function re(e,t){return new Date(e,t+1,0).getDate()}function oe(e,t,n){return new Date(e.getFullYear(),e.getMonth(),e.getDate(),t,n)}function Ne(e){let t=e.getFullYear(),n=String(e.getMonth()+1).padStart(2,"0"),r=String(e.getDate()).padStart(2,"0");return`${t}-${n}-${r}`}var ae='[data-ix-events="data-wrap"]',ie='[data-ix-events="item"]',Be='[data-ix-events="data"]',Ce=20,Oe=300;function B(e){let t=0,n=()=>{let o=document.querySelectorAll(ae);o.length>1&&console.warn(`events: found ${o.length} elements matching ${ae} \u2014 using the first one. Remove the extras to avoid duplicate or conflicting event data.`);let a=o[0];if((a?[...a.querySelectorAll(ie)]:[]).length===0){if(t++,t<Ce){setTimeout(n,Oe);return}e([]);return}if(a.getAttribute("fs-list-element")==="list"){window.FinsweetAttributes||(window.FinsweetAttributes=[]),window.FinsweetAttributes.push(["list",l=>{let c=l.find(s=>s.listElement===a);Promise.resolve(c?.loadingPaginatedItems).then(()=>r(a))}]);return}r(a)},r=o=>{let a=[...o.querySelectorAll(ie)].map(i=>{let l=i.querySelector(Be);if(!l)return null;try{let c=R(JSON.parse(l.textContent));return c.startDate?c:null}catch(c){return console.warn("events: could not parse event JSON",i,c),null}}).filter(Boolean);e(a)};n()}var A="events",Re="list",Ie="feed",he='[data-ix-events="wrap"]',qe='[data-ix-events="prev"]',He='[data-ix-events="next"]',Ue='[data-ix-events="today"]',Pe='[data-ix-events="label"]',Ge='[data-ix-events="item"]',We='[data-ix-events="data"]',ze='[data-ix-events="card"]',Je='[data-ix-events="date"]',se="data-ix-events-slug",pe="data-ix-events-clone",le="is-disabled",je='[fs-list-element="list"]',Xe='[data-ix-events="load-more"]',Ke='[data-ix-events="feed-divider"]',ce='[data-ix-events="feed-divider-text"]',Ze=36,Qe=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],Ve=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],et=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],J=["January","February","March","April","May","June","July","August","September","October","November","December"],ye=function(){let e=[...document.querySelectorAll(he)].filter(t=>t.getAttribute("data-ix-events-layout")===Re);console.log('[event-list] DEBUG wraps with layout="list" found:',e.length,e),e.length!==0&&B(t=>{console.log("[event-list] DEBUG whenEvents callback fired, events received:",t.length,t);let n=new Map(t.map(r=>[r.slug,r]));e.forEach(r=>{be(r,!0,o=>{let a=tt(r,o.listElement,n);console.log("[event-list] DEBUG config built for wrap:",r,"-> ",a),a&&nt(a,o)})})})};function tt(e,t,n){let r=M(!0,e.getAttribute(`data-ix-${A}-duplicate-recurring`)),o=M(!1,e.getAttribute(`data-ix-${A}-hide-past-events`)),a=M("month",e.getAttribute(`data-ix-${A}-range`)?.toLowerCase());a!=="month"&&a!=="week"&&(a="month");let i=M("sunday",e.getAttribute(`data-ix-${A}-week-start`)?.toLowerCase())==="monday"?1:0,l=e.querySelector(Pe),c=e.querySelector(qe),s=e.querySelector(He),d=e.querySelector(Ue);console.log("[event-list] DEBUG buildListConfig: duplicateRecurring =",r,"| hidePastEvents =",o,"| range =",a,"| weekStartDay =",i,"| label found:",!!l,"| prevBtn found:",!!c,"| nextBtn found:",!!s,"| todayBtn found:",!!d);let m=De(e,n);return console.log("[event-list] DEBUG buildListConfig: successfully paired entries:",m.length,m),m.length===0?null:{duplicateRecurring:r,hidePastEvents:o,range:a,weekStartDay:i,label:l,prevBtn:c,nextBtn:s,todayBtn:d,entries:m,list:t}}function nt(e,t){let{duplicateRecurring:n,hidePastEvents:r,range:o,weekStartDay:a,label:i,prevBtn:l,nextBtn:c,todayBtn:s,entries:d,list:m}=e,h=new Map(d.map(({item:g,event:y})=>[g,y]));console.log("[event-list] DEBUG initList: registering hook, listInstance =",t);let u=ge(new Date,o,a);t.addHook("filter",g=>{let{start:y,end:D}=j(u,o);console.log("[event-list] DEBUG filter hook FIRED. items received from Finsweet:",g.length,g,"| active range:",y,"-",D);let x=m.querySelectorAll(`[${pe}]`);console.log("[event-list] DEBUG removing stale clones from previous pass:",x.length),x.forEach(p=>p.remove());let w=[];return g.forEach(p=>{let E=h.get(p.element);if(!E){console.log("[event-list] DEBUG no matching event for this listItem.element (stale/unrecognized) \u2014 dropping:",p.element);return}let S=N(E,y,D).sort((_,T)=>_.start-T.start);if(r){let _=new Date;S=S.filter(T=>T.end>=_)}if(console.log("[event-list] DEBUG event",E.name,"-> occurrences in range:",S.length),p.element.style.display=S.length===0?"none":"",S.length===0)return;let[F,...f]=S;if(Ee(p.element,F,E),w.push({listItem:p,date:F.start,showStartTime:E.showStartTime}),n){let _=p.element;f.forEach((T,H)=>{let $=xe(p.element,T,E,`occ-${H+1}`);_.insertAdjacentElement("afterend",$),_=$,w.push({listItem:t.createItem($),date:T.start,showStartTime:E.showStartTime})})}}),w.sort(rt),console.log("[event-list] DEBUG filter hook RETURNING",w.length,"items to Finsweet"),w.map(p=>p.listItem)});let b=()=>{if(console.log("[event-list] DEBUG refresh() called \u2014 range now:",u),i){let g=M("",i.getAttribute("data-ix-events-label-format"));i.textContent=o==="week"?st(u,g||void 0):L(u,g||"MMMM YYYY")}v(),t.triggerHook("filter")},v=()=>{l&&l.classList.toggle(le,de(u,o,r)),s&&s.classList.toggle(le,ue(u,o))};b(),l?.addEventListener("click",()=>{de(u,o,r)||(u=W(u,o,-1),b())}),c?.addEventListener("click",()=>{u=W(u,o,1),b()}),s?.addEventListener("click",()=>{ue(u,o)||(u=ge(new Date,o,a),b())})}function de(e,t,n){return n?j(W(e,t,-1),t).end<new Date:!1}function ue(e,t){let{start:n,end:r}=j(e,t),o=new Date;return o>=n&&o<=r}function rt(e,t){let n=Y(e.date)-Y(t.date);return n!==0?n:e.showStartTime!==t.showStartTime?e.showStartTime?-1:1:e.date-t.date}var ve=function(){let e=[...document.querySelectorAll(he)].filter(t=>t.getAttribute("data-ix-events-layout")===Ie);console.log('[event-feed] DEBUG wraps with layout="feed" found:',e.length,e),e.length!==0&&B(t=>{console.log("[event-feed] DEBUG whenEvents callback fired, events received:",t.length,t);let n=new Map(t.map(r=>[r.slug,r]));e.forEach(r=>{be(r,!1,()=>ot(r,n))})})};function ot(e,t){let n=De(e,t);if(console.log("[event-feed] DEBUG initFeed: entries found for wrap:",n.length,e),n.length===0)return;let r=M(!0,e.getAttribute(`data-ix-${A}-duplicate-recurring`)),o=M(12,e.getAttribute(`data-ix-${A}-feed-count`)),a=M("month",e.getAttribute(`data-ix-${A}-feed-period`)?.toLowerCase());a!=="month"&&a!=="week"&&(a="month");let i=M(!0,e.getAttribute(`data-ix-${A}-feed-divider`)),l=M(!1,e.getAttribute(`data-ix-${A}-feed-divider-today`)),c=n[0].item.parentElement;n.forEach(({item:g})=>{g.style.display="none"});let s=e.querySelector(Xe),d=e.querySelector(Ke),m=d?.querySelector(ce);console.log("[event-feed] DEBUG initFeed: duplicateRecurring =",r,"| feedCount =",o,"| feedPeriod =",a,"| feedDivider =",i,"| feedDividerToday =",l,"| loadMoreBtn found:",!!s,"| dividerTemplate found:",!!d),i&&!d&&console.warn('event-feed: feed-divider is enabled but no [data-ix-events="feed-divider"] element was found.',e);let h=0,u=null;function b(g){let y=d.cloneNode(!0);y.classList.remove("u-hide"),y.style.gridColumn="1 / -1";let D=y.querySelector(ce);return D&&(D.textContent=g),y}function v(){let g=new Date,y=new Date(g.getFullYear(),g.getMonth(),g.getDate()),D=h+o,x=fe(y,a),w=me(n,y,x,r),p=0;for(;w.length<D&&p<Ze;)x=fe(x,a),w=me(n,y,x,r),p++;let E=w.slice(h,D);if(console.log("[event-feed] DEBUG loadMore: targetCount =",D,"| total merged occurrences found:",w.length,"(after",p,"extra search steps) | batch size:",E.length),E.length===0){s&&(s.style.display="none");return}E.forEach(({item:S,event:F,occurrence:f},_)=>{if(i&&d){let T=`${f.start.getFullYear()}-${f.start.getMonth()}`;if(u===null||T!==u){let H=u===null,$=M("MMMM, YYYY",m?.getAttribute("data-ix-events-date-format")),Ae=H&&l?"Today":L(f.start,$);c.appendChild(b(Ae)),u=T}}c.appendChild(xe(S,f,F,`feed-${h+_}`))}),h+=E.length,E.length<o&&s&&(s.style.display="none")}v(),s?.addEventListener("click",v)}function me(e,t,n,r){let o=[];return e.forEach(({item:a,event:i})=>{let l=N(i,t,n).sort((c,s)=>c.start-s.start);r||(l=l.slice(0,1)),l.forEach(c=>o.push({item:a,event:i,occurrence:c}))}),o.sort((a,i)=>{let l=Y(a.occurrence.start)-Y(i.occurrence.start);return l!==0?l:a.event.showStartTime!==i.event.showStartTime?a.event.showStartTime?-1:1:a.occurrence.start-i.occurrence.start}),o}function De(e,t){let n=[...e.querySelectorAll(Ge)].filter(r=>r.querySelector(ze));return n.length===0?[]:n.map(r=>{let o=r.querySelector(We),a;if(o)try{a=R(JSON.parse(o.textContent))}catch(i){return console.warn("event-list: could not parse event JSON",r,i),null}else{let i=r.getAttribute(se);if(a=i?t.get(i):null,!a)return console.warn(`event-list: no matching event data for slug "${i}" \u2014 bind ${se} on this card to the Slug field.`,r),null}return a.startDate?{item:r,event:a}:null}).filter(Boolean)}function be(e,t,n){let r=e.querySelector(je);if(!r){if(t){console.warn('event-list: no element with fs-list-element="list" found inside this wrap.',e);return}n(null);return}window.FinsweetAttributes||(window.FinsweetAttributes=[]),window.FinsweetAttributes.push(["list",o=>{let a=o.find(i=>i.listElement===r);if(!a){if(t){console.warn('event-list: no Finsweet List instance found for this Collection List \u2014 add fs-list-element="list" to it.',r);return}n(null);return}Promise.resolve(a.loadingPaginatedItems).then(()=>n(a))}])}function xe(e,t,n,r){let o=e.cloneNode(!0);return o.style.display="",o.setAttribute(pe,""),mt(o,r),Ee(o,t,n),ut(o),o}function Y(e){return new Date(e.getFullYear(),e.getMonth(),e.getDate()).getTime()}function C(e,t){return new Date(e.getFullYear(),e.getMonth(),e.getDate()+t)}function at(e,t){let n=(e.getDay()-t+7)%7;return C(e,-n)}function ge(e,t,n){return t==="week"?at(e,n):new Date(e.getFullYear(),e.getMonth(),1)}function j(e,t){if(t==="week"){let n=C(e,6);return{start:e,end:new Date(n.getFullYear(),n.getMonth(),n.getDate(),23,59,59)}}return{start:e,end:new Date(e.getFullYear(),e.getMonth()+1,0,23,59,59)}}function W(e,t,n){if(t==="week")return C(e,7*n);let r=new Date(e.getFullYear(),e.getMonth(),1);return r.setMonth(r.getMonth()+n),r}function fe(e,t){if(t==="week")return C(e,7);let n=new Date(e.getFullYear(),e.getMonth(),1);return n.setMonth(n.getMonth()+1),n}function Ee(e,t,n){e.querySelectorAll(Je).forEach(r=>{let o=M("MMMM D, YYYY",r.getAttribute("data-ix-events-date-format"));r.textContent=lt(o)?ct(t,n):L(t.start,o)})}var I=e=>String(e).padStart(2,"0"),X=e=>e%10===1&&e%100!==11?`${e}st`:e%10===2&&e%100!==12?`${e}nd`:e%10===3&&e%100!==13?`${e}rd`:`${e}th`,it=/YYYY|YY|MMMM|MMM|MM|M|DD|Do|D|dddd|ddd|mm|H|h|A|a/g;function L(e,t){let n=e.getHours(),r={YYYY:()=>String(e.getFullYear()),YY:()=>String(e.getFullYear()).slice(-2),MMMM:()=>J[e.getMonth()],MMM:()=>et[e.getMonth()],MM:()=>I(e.getMonth()+1),M:()=>String(e.getMonth()+1),DD:()=>I(e.getDate()),Do:()=>X(e.getDate()),D:()=>String(e.getDate()),dddd:()=>Ve[e.getDay()],ddd:()=>Qe[e.getDay()],mm:()=>I(e.getMinutes()),H:()=>String(n),h:()=>String(n%12||12),A:()=>n>=12?"PM":"AM",a:()=>n>=12?"pm":"am"};return t.replace(it,o=>r[o]())}function st(e,t){let n=C(e,6);if(t)return`${L(e,t)} - ${L(n,t)}`;let o=e.getFullYear()!==n.getFullYear()?"MMM D, YYYY":"MMM D";return`${L(e,o)} - ${L(n,"MMM D, YYYY")}`}function lt(e){return e.trim().toUpperCase()==="FULLDATE"}function ct(e,t){let{start:n,end:r}=e,{showStartTime:o,showEndTime:a,showEndDate:i}=t,c=i&&Y(r)!==Y(n)?dt(n,r):z(n);if(!o)return c;if(!a)return`${c} at ${G(n)}`;let s=G(n),d=G(r),m=n.getHours()>=12?"pm":"am",h=r.getHours()>=12?"pm":"am",u=n.getHours()%12||12,v=m===h&&u!==12?s.slice(0,-2):s;return`${c}, ${v}-${d}`}function z(e){return`${J[e.getMonth()]} ${X(e.getDate())}`}function dt(e,t){return e.getMonth()===t.getMonth()&&e.getFullYear()===t.getFullYear()?`${J[e.getMonth()]} ${e.getDate()}-${X(t.getDate())}`:`${z(e)} - ${z(t)}`}function G(e){let t=e.getHours(),n=e.getMinutes(),r=t%12||12,o=t>=12?"pm":"am",a=n===0?"":`:${I(n)}`;return`${r}${a}${o}`}function ut(e){new MutationObserver(()=>{e.style.display==="none"&&(e.style.display="")}).observe(e,{attributes:!0,attributeFilter:["style"]})}function mt(e,t){e.hasAttribute("id")&&(e.id=`${e.id}-${t}`),e.removeAttribute("data-w-id"),e.querySelectorAll("[id]").forEach(n=>{n.id=`${n.id}-${t}`}),e.querySelectorAll("[data-w-id]").forEach(n=>{n.removeAttribute("data-w-id")})}var gt="events",ft="calendar",ht='[data-ix-events="wrap"]',pt=["January","February","March","April","May","June","July","August","September","October","November","December"],yt=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],Me=[["--_theme---text--text-accent","#2563eb"],["--_theme---border--border-secondary","#6b7280"],["--_theme---text--text-primary","#1f2937"]],we=!1,Te=function(){let e=[...document.querySelectorAll(ht)].filter(t=>t.getAttribute("data-ix-events-layout")===ft);e.length!==0&&(Lt(),e.forEach(t=>vt(t)))};function vt(e){let t=M(6,e.getAttribute(`data-ix-${gt}-months`)),n=new Date,r={year:n.getFullYear(),month:n.getMonth(),events:[],loading:!0};e.classList.add("ix-calendar"),e.style.position="relative",e.innerHTML="";let o=Dt(),a=bt(),i=xt(),l=Et();e.append(o.el,a.weekdayRow,a.gridEl,i,l.el);let c=new Date(n.getFullYear(),n.getMonth()-t,1),s=new Date(n.getFullYear(),n.getMonth()+t,1),d=()=>new Date(r.year,r.month-1,1)>=c,m=()=>new Date(r.year,r.month+1,1)<=s;o.prevBtn.addEventListener("click",()=>{d()&&(h(-1),u())}),o.nextBtn.addEventListener("click",()=>{m()&&(h(1),u())});function h(b){let v=new Date(r.year,r.month+b,1);r.year=v.getFullYear(),r.month=v.getMonth()}function u(){o.label.textContent=`${pt[r.month]} ${r.year}`,o.prevBtn.disabled=!d(),o.nextBtn.disabled=!m();let b=new Date(r.year,r.month-1,1),v=new Date(r.year,r.month+2,0,23,59,59),g=[];r.events.forEach(y=>{N(y,b,v).forEach(D=>{g.push({event:y,start:D.start,end:D.end})})}),Mt(a,r.year,r.month,g,n,l,e)}u(),B(b=>{let v=b.length===0;if(r.events=v?Tt():b,r.loading=!1,i.style.display="none",v){let g=document.createElement("p");g.className="ix-calendar_demo-note",g.textContent="No events data-wrap found on this page \u2014 showing sample data.",e.append(g)}u()})}function Dt(){let e=document.createElement("div");e.className="ix-calendar_header";let t=document.createElement("button");t.type="button",t.className="ix-calendar_nav-btn",t.setAttribute("aria-label","Previous month"),t.innerHTML=_e("M15 18l-6-6 6-6");let n=document.createElement("h2");n.className="ix-calendar_label";let r=document.createElement("button");return r.type="button",r.className="ix-calendar_nav-btn",r.setAttribute("aria-label","Next month"),r.innerHTML=_e("M9 18l6-6-6-6"),e.append(t,n,r),{el:e,prevBtn:t,label:n,nextBtn:r}}function _e(e){return`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${e}"/></svg>`}function bt(){let e=document.createElement("div");e.className="ix-calendar_weekdays",yt.forEach(n=>{let r=document.createElement("div");r.className="ix-calendar_weekday",r.textContent=n,e.append(r)});let t=document.createElement("div");return t.className="ix-calendar_grid",{weekdayRow:e,gridEl:t}}function xt(){let e=document.createElement("div");return e.className="ix-calendar_loading",e.textContent="Loading events\u2026",e}function Et(){let e=document.createElement("div");return e.className="ix-calendar_tooltip",e.style.display="none",{el:e}}function Mt(e,t,n,r,o,a,i){e.gridEl.innerHTML="";let l=new Date(t,n,1).getDay(),c=Se(t,n),s=Se(n===0?t-1:t,n===0?11:n-1),d=[];for(let m=l-1;m>=0;m--){let h=s-m;d.push({date:new Date(n===0?t-1:t,n===0?11:n-1,h),inMonth:!1})}for(let m=1;m<=c;m++)d.push({date:new Date(t,n,m),inMonth:!0});for(;d.length<42;){let m=d[d.length-1].date;d.push({date:At(m,1),inMonth:!1})}d.forEach((m,h)=>{let u=document.createElement("div");u.className="ix-calendar_day",m.inMonth||u.classList.add("is-outside"),(h+1)%7===0&&u.classList.add("is-last-col");let b=m.inMonth&&O(m.date,o),v=document.createElement("div");v.className="ix-calendar_day-number-row";let g=document.createElement("span");if(g.className="ix-calendar_day-number"+(b?" is-today":""),g.textContent=String(m.date.getDate()),v.append(g),u.append(v),m.inMonth){let y=r.filter(x=>kt(m.date,x.start,x.end)),D=document.createElement("div");if(D.className="ix-calendar_day-events",y.slice(0,2).forEach(x=>{D.append(wt(x,m.date,r,a,i))}),y.length>2){let x=document.createElement("span");x.className="ix-calendar_more",x.textContent=`+${y.length-2} more`,D.append(x)}u.append(D)}e.gridEl.append(u)})}function wt(e,t,n,r,o){let a=O(t,e.start),i=O(t,e.end),l=a&&i?"single":a?"start":i?"end":"middle",c=Me[Ft(e.event.id)%Me.length],s=document.createElement("a");return s.className=`ix-calendar_pill is-${l}`,s.href=`/event/${e.event.slug}`,s.style.setProperty("--pill-color",`var(${c[0]}, ${c[1]})`),s.textContent=l==="single"||l==="start"?e.event.name:"\xA0",s.addEventListener("mouseenter",()=>_t(r,e,s,o)),s.addEventListener("mouseleave",()=>St(r)),s}function _t(e,t,n,r){let{event:o,start:a,end:i}=t,l=r.getBoundingClientRect(),c=n.getBoundingClientRect(),s=a.toLocaleDateString("en-US",{month:"short",day:"numeric"});O(a,i)||(s+=` \u2013 ${i.toLocaleDateString("en-US",{month:"short",day:"numeric"})}`),o.showStartTime&&(s+=` \xB7 ${Z(a)}`),o.showEndTime&&!O(a,i)?s+=` \u2013 ${Z(i)}`:o.showEndTime&&o.showStartTime&&i.getTime()!==a.getTime()&&(s+=` \u2013 ${Z(i)}`),e.el.innerHTML=`
    <h3 class="ix-calendar_tooltip-title">${q(o.name)}</h3>
    <div class="ix-calendar_tooltip-meta">${q(s)}</div>
    ${o.location?`<div class="ix-calendar_tooltip-meta">${q(o.location)}</div>`:""}
    ${o.shortDescription?`<p class="ix-calendar_tooltip-desc">${q(o.shortDescription)}</p>`:""}
  `;let d=256,m=c.left-l.left+c.width/2,h=Math.max(d/2,Math.min(m,l.width-d/2));e.el.style.left=`${h}px`,e.el.style.top=`${c.top-l.top}px`,e.el.style.display="block"}function St(e){e.el.style.display="none"}function Tt(){let e=new Date,t=e.getFullYear(),n=e.getMonth();return[{id:"demo-1",name:"Community Meetup",slug:"community-meetup",startDate:new Date(t,n,8,18,0),endDate:new Date(t,n,8,20,0),showStartTime:!0,showEndTime:!0,showEndDate:!1,shortDescription:"Join us for our monthly community gathering.",location:"Community Center",timezone:"",recurringFrequency:"None",recurringInterval:1,recurringDays:[],recurringSkipDates:[]},{id:"demo-2",name:"Volunteer Week",slug:"volunteer-week",startDate:new Date(t,n,20,9,0),endDate:new Date(t,n,24,17,0),showStartTime:!1,showEndTime:!1,showEndDate:!0,shortDescription:"A full week of volunteer opportunities.",location:"Various Locations",timezone:"",recurringFrequency:"None",recurringInterval:1,recurringDays:[],recurringSkipDates:[]},{id:"demo-3",name:"Small Group",slug:"small-group",startDate:new Date(t,n,3,18,0),endDate:new Date(t,n,3,19,30),showStartTime:!0,showEndTime:!0,showEndDate:!1,shortDescription:"Biweekly small group discussion.",location:"Room 204",timezone:"",recurringFrequency:"Weekly",recurringInterval:2,recurringDays:[],recurringSkipDates:[]}]}function Se(e,t){return new Date(e,t+1,0).getDate()}function At(e,t){return new Date(e.getFullYear(),e.getMonth(),e.getDate()+t)}function K(e){return new Date(e.getFullYear(),e.getMonth(),e.getDate())}function O(e,t){return e.getFullYear()===t.getFullYear()&&e.getMonth()===t.getMonth()&&e.getDate()===t.getDate()}function kt(e,t,n){let r=K(e);return r>=K(t)&&r<=K(n)}function Z(e){let t=e.getHours(),n=e.getMinutes(),r=t>=12?"PM":"AM";return t=t%12||12,n===0?`${t} ${r}`:`${t}:${String(n).padStart(2,"0")} ${r}`}function Ft(e){let t=0;for(let n=0;n<e.length;n++)t=t*31+e.charCodeAt(n)>>>0;return t}function q(e){let t=document.createElement("div");return t.textContent=e,t.innerHTML}function Lt(){if(we)return;we=!0;let e=document.createElement("style");e.textContent=`
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
`,document.head.append(e)}document.addEventListener("DOMContentLoaded",function(){ye(),ve(),Te()});})();
