// P3R Companion — Tartarus Shadow Database Logic

let tartRoot;

function parseResists(r){if(!r)return{};const o={};for(let i=0;i<Math.min(r.length,RESIST_KEYS.length);i++)o[RESIST_KEYS[i]]=r[i]||'-';return o}

function parseArea(area){
  const R={block:null,subBlock:null,floorMin:null,floorMax:null,type:'other',raw:area};
  if(!area)return R;
  const bm=area.match(/^(Thebel|Arqa|Yabbashah|Tziah|Harabah|Adamah)/i);
  if(bm)R.block=bm[1].toLowerCase();
  const sm=area.match(/(I{1,2})\s/);
  if(sm)R.subBlock=sm[1];
  if(/Full Moon/.test(area))R.type='fullmoon';
  else if(/\sD\d/.test(area))R.type='monad-door';
  else if(/\sP\d/.test(area))R.type='monad-passage';
  else if(/\d+-\d+/.test(area)){R.type='regular';const fm=area.match(/(\d+)-(\d+)/);if(fm){R.floorMin=+fm[1];R.floorMax=+fm[2]}}
  else if(/\d+$/.test(area)){R.type='gatekeeper';const fm=area.match(/(\d+)$/);if(fm){R.floorMin=+fm[1];R.floorMax=+fm[1]}}
  return R;
}

const ALL_SHADOWS=Object.entries(ENEMY_RAW).map(([name,data])=>{
  const p=parseArea(data.area),r=parseResists(data.resists),isBoss=!!data.boss;
  return{name,...data,...p,resists:r,type:p.type,isBoss,arcana:data.race?data.race.replace(/\s*[BP]$/,''):'Unknown',
    hp:data.stats?data.stats[0]:0,sp:data.stats?data.stats[1]:0,st:data.stats?data.stats[2]:0,
    ma:data.stats?data.stats[3]:0,en:data.stats?data.stats[4]:0,ag:data.stats?data.stats[5]:0,lu:data.stats?data.stats[6]:0};
});

let state={query:'',blockFilter:null,typeFilters:new Set(),weakFilter:'',ailmentFilter:'',lvlMin:0,lvlMax:99,sortCol:'lvl',sortDir:'asc',expandedRow:null,view:'database'};

const RESIST_ORDER={z:-2,Z:-2,v:-1,V:-1,w:-1,W:-1,'-':0,'_':0,u:0,t:1,s:1,S:1,T:2,n:2,r:3,d:4};
function filterShadows(){
  let list=ALL_SHADOWS;
  if(state.blockFilter)list=list.filter(s=>s.block===state.blockFilter);
  if(state.typeFilters.size>0)list=list.filter(s=>state.typeFilters.has(s.type));
  if(state.query){const q=state.query.toLowerCase();list=list.filter(s=>s.name.toLowerCase().includes(q)||(s.skills&&s.skills.some(sk=>sk.toLowerCase().includes(q)))||(s.dodds&&Object.keys(s.dodds).some(d=>d.toLowerCase().includes(q)))||(s.arcana&&s.arcana.toLowerCase().includes(q)))}
  if(state.weakFilter)list=list.filter(s=>{const c=s.resists[state.weakFilter];return c==='w'||c==='W'||c==='v'||c==='V'||c==='z'||c==='Z'});
  if(state.ailmentFilter){const ai=state.ailmentFilter;list=list.filter(s=>s.ailments&&s.ailments[ai]==='v')}
  if(state.lvlMin)list=list.filter(s=>s.lvl>=state.lvlMin);
  if(state.lvlMax&&state.lvlMax<99)list=list.filter(s=>s.lvl<=state.lvlMax);
  return sortShadows(list);
}

function sortShadows(list){
  const col=state.sortCol,dir=state.sortDir==='asc'?1:-1;
  return[...list].sort((a,b)=>{
    if(col==='name')return a.name.localeCompare(b.name)*dir;
    if(col==='lvl')return(a.lvl-b.lvl)*dir;
    if(col==='race')return(a.arcana||'').localeCompare(b.arcana||'')*dir;
    if(col==='area')return(a.area||'').localeCompare(b.area||'')*dir;
    if(col==='type')return a.type.localeCompare(b.type)*dir;
    if(RESIST_KEYS.includes(col)){const va=RESIST_ORDER[a.resists[col]]??0,vb=RESIST_ORDER[b.resists[col]]??0;return(va-vb)*dir}
    return 0;
  });
}

function affBadge(code){
  if(!code||code==='-'||code==='_')return'<span class="aff aff-n">\u2014</span>';
  const map={w:'WK',W:'WK',v:'WK',V:'WK',z:'WK!',Z:'WK!',s:'RS',S:'RS',t:'RS',T:'NU',n:'NU',r:'RP',d:'ABS',u:'\u2014'};
  const cls={w:'aff-wk',W:'aff-wk',v:'aff-wk',V:'aff-wk',z:'aff-z',Z:'aff-z',s:'aff-rs',S:'aff-rs',t:'aff-rs',T:'aff-nu',n:'aff-nu',r:'aff-rp',d:'aff-dr',u:'aff-n'};
  return'<span class="aff '+(cls[code]||'')+'">'+(map[code]||code)+'</span>';
}

function typeBadge(type){
  const labels={regular:'Regular',gatekeeper:'Gatekeeper',fullmoon:'Full Moon','monad-door':'M.Door','monad-passage':'M.Pass',other:'Other'};
  return'<span class="type-badge type-'+type+'">'+(labels[type]||type)+'</span>';
}

function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

function renderTable(){
  const shadows=filterShadows(),tbody=tartRoot.querySelector('#tableBody'),count=tartRoot.querySelector('#resultCount');
  count.textContent=shadows.length+' shadow'+(shadows.length!==1?'s':'')+' found';
  let html='';
  shadows.forEach(s=>{
    const rowClass=(s.isBoss?' boss-row':'')+(s.type==='rare'?' rare-row':'');
    const isExpanded=state.expandedRow===s.name;
    html+='<tr class="shadow-row'+rowClass+'" data-name="'+esc(s.name)+'">';
    html+='<td style="font-weight:600">'+esc(s.name)+'</td>';
    html+='<td>'+s.lvl+'</td><td>'+esc(s.arcana)+'</td><td>'+esc(s.area||'')+'</td>';
    html+='<td>'+typeBadge(s.type)+'</td>';
    RESIST_KEYS.slice(0,9).forEach(k=>{html+='<td>'+affBadge(s.resists[k])+'</td>'});
    html+='</tr>';
    if(isExpanded)html+=renderDetailRow(s);
  });
  tbody.innerHTML=html;
  tartRoot.querySelectorAll('#tableHead th').forEach(th=>{
    th.classList.remove('sorted-asc','sorted-desc');
    if(th.dataset.col===state.sortCol)th.classList.add('sorted-'+state.sortDir);
  });
}

function renderDetailRow(s){
  let h='<tr class="detail-row"><td colspan="14"><div class="detail-card">';
  h+='<h3>'+esc(s.name)+'</h3>';
  if(s.stats){h+='<div class="detail-section"><div class="stat-bar">';const sn=['HP','SP','St','Ma','En','Ag','Lu'];s.stats.forEach((v,i)=>{h+='<div class="stat-item"><div class="stat-label">'+sn[i]+'</div><div class="stat-val">'+v+'</div></div>'});h+='</div></div>'}
  if(s.ailments){const an=['Burn','Freeze','Shock','Poison','Charm','Distress'],ac={v:'Vuln',n:'Null',s:'Resist'},acol={v:'var(--wk)',s:'var(--rs)',n:'var(--nu)'};h+='<div class="detail-section"><span class="label">Ailments: </span>';for(let i=0;i<s.ailments.length&&i<an.length;i++){const c=s.ailments[i],color=acol[c]||'var(--text-dim)';h+='<span style="color:'+color+';margin-right:8px;font-size:0.85rem">'+an[i]+': '+(ac[c]||c)+'</span>'}h+='</div>'}
  if(s.skills&&s.skills.length>0){h+='<div class="detail-section"><div class="label">Skills</div><div class="value">';s.skills.forEach(sk=>{var ski=typeof SKILLS!=='undefined'?SKILLS[sk]:null;var tip=ski?(' data-tooltip="'+(ELEM_NAMES[ski.elem]||ski.elem)+' | '+ski.target+(ski.cost?' | Cost '+ski.cost:'')+(ski.power?' | Pow '+ski.power:'')+(ski.effect?' | '+ski.effect:'')+'"'):'';h+='<span class="skill-tag"'+tip+'>'+esc(sk)+'</span>'});h+='</div></div>'}
  if(s.dodds&&Object.keys(s.dodds).length>0){h+='<div class="detail-section"><div class="label">Drops</div><div class="value">';Object.entries(s.dodds).forEach(([item,chance])=>{h+='<span class="drop-item">'+esc(item)+' <span class="drop-chance">('+chance+'%)</span></span>'});h+='</div></div>'}
  h+='<div class="detail-section"><span class="label">EXP: </span><span class="value" style="display:inline">'+(s.exp||0)+'</span></div>';
  const strat=BOSS_STRATS[s.name];
  if(strat){h+='<div class="strategy-box"><div class="strat-title">Strategy (Rec. Lv '+strat.recLevel+')</div>';
    if(strat.quickTip)h+='<p class="strat-quick">'+strat.quickTip+'</p>';
    if(strat.party)h+='<div class="strat-row"><span class="strat-label">Party:</span> '+strat.party.map(function(p){return'<span class="strat-badge strat-party">'+esc(p)+'</span>'}).join(' ')+'</div>';
    if(strat.personas)h+='<div class="strat-row"><span class="strat-label">Personas:</span> '+strat.personas.map(function(p){return'<span class="strat-badge strat-persona">'+esc(p)+'</span>'}).join(' ')+'</div>';
    if(strat.items)h+='<div class="strat-row"><span class="strat-label">Items:</span> '+strat.items.map(function(p){return'<span class="strat-badge strat-item">'+esc(p)+'</span>'}).join(' ')+'</div>';
    if(strat.phases)strat.phases.forEach(function(ph,pi){h+='<div class="strat-phase"><div class="strat-phase-name">'+(pi+1)+'. '+esc(ph.name)+'</div><p>'+ph.tips+'</p></div>'});
    if(strat.strategy)h+='<p>'+strat.strategy+'</p>';
    h+='</div>'}
  h+='</div></td></tr>';return h;
}

function renderFloorScout(floor){
  const info=tartRoot.querySelector('#floorInfo');
  if(!floor||floor<2||floor>264){info.innerHTML='<div style="color:var(--text-dim);font-size:0.85rem;margin-top:0.5rem">Enter a floor (2-264)</div>';return}
  const block=BLOCKS.find(b=>floor>=b.fMin&&floor<=b.fMax);
  if(!block){info.innerHTML='<div style="color:var(--text-dim)">No block for this floor.</div>';return}
  let h='<div class="floor-block-name" style="color:'+block.color+'">'+block.name+' \u2014 '+block.floors+'</div>';
  h+='<div style="font-size:0.8rem;color:var(--text-dim)">Rec. Level: '+block.recLvl+' | Unlocked: '+block.unlock+'</div>';
  const shadows=ALL_SHADOWS.filter(s=>s.block===block.id&&(s.type==='regular'||s.type==='monad-passage'||s.type==='monad-door')&&s.floorMin&&s.floorMax&&floor>=s.floorMin&&floor<=s.floorMax);
  if(shadows.length>0){
    shadows.sort((a,b)=>a.lvl-b.lvl);
    h+='<div class="floor-enemies" style="margin-top:0.75rem"><div class="label">Shadows on this floor</div>';
    shadows.forEach(s=>{
      h+='<div class="floor-enemy"><div class="floor-enemy-name">'+esc(s.name)+' (Lv '+s.lvl+')</div>';
      h+='<div class="floor-enemy-affs">';
      const affMap={w:{label:'WK',cls:'floor-aff-wk'},W:{label:'WK',cls:'floor-aff-wk'},v:{label:'WK',cls:'floor-aff-wk'},V:{label:'WK',cls:'floor-aff-wk'},z:{label:'WK!',cls:'floor-aff-z'},Z:{label:'WK!',cls:'floor-aff-z'},s:{label:'RS',cls:'floor-aff-rs'},S:{label:'RS',cls:'floor-aff-rs'},t:{label:'RS',cls:'floor-aff-rs'},T:{label:'NU',cls:'floor-aff-nu'},n:{label:'NU',cls:'floor-aff-nu'},r:{label:'RP',cls:'floor-aff-rp'},d:{label:'ABS',cls:'floor-aff-abs'}};
      RESIST_KEYS.slice(0,9).forEach((k,i)=>{const c=s.resists[k];if(c&&c!=='-'&&c!=='_'&&c!=='u'&&affMap[c]){h+='<span class="floor-aff '+affMap[c].cls+'">'+RESIST_LABELS[i]+' '+affMap[c].label+'</span>'}});
      h+='</div></div>'});
    h+='</div>';
    const wkCounts={};shadows.forEach(s=>{RESIST_KEYS.slice(0,9).forEach(k=>{const c=s.resists[k];if(c==='w'||c==='W'||c==='v'||c==='V'||c==='z'||c==='Z')wkCounts[k]=(wkCounts[k]||0)+1})});
    const sorted=Object.entries(wkCounts).sort((a,b)=>b[1]-a[1]);
    if(sorted.length>0){h+='<div class="floor-tip"><strong>Tip:</strong> Most effective elements: '+sorted.slice(0,3).map(([k,c])=>RESIST_LABELS[RESIST_KEYS.indexOf(k)]+' ('+c+')').join(', ')+'</div>'}
  }
  // Floor EXP summary
  if(shadows.length>0){
    var totalExp=shadows.reduce(function(sum,s){return sum+(s.exp||0)},0);
    var blockShadows=ALL_SHADOWS.filter(function(s2){return s2.block===block.id&&(s2.type==='regular'||s2.type==='monad-passage'||s2.type==='monad-door')&&s2.exp});
    var avgBlockExp=blockShadows.length>0?Math.round(blockShadows.reduce(function(s,e){return s+e.exp},0)/blockShadows.length):0;
    var avgFloorExp=Math.round(totalExp/shadows.length);
    var indicator=avgFloorExp>avgBlockExp*1.15?'\u2191 Above avg':avgFloorExp<avgBlockExp*0.85?'\u2193 Below avg':'\u2248 Average';
    h+='<div class="floor-exp-summary"><span class="label">Floor EXP: </span><strong>'+totalExp+'</strong> total ('+avgFloorExp+'/shadow) <span class="floor-exp-ind">'+indicator+'</span></div>';
  }
  const gks=ALL_SHADOWS.filter(s=>s.block===block.id&&s.type==='gatekeeper'&&s.floorMin&&s.floorMin>=floor).sort((a,b)=>a.floorMin-b.floorMin);
  if(gks.length>0){const gk=gks[0];h+='<div style="margin-top:0.75rem;padding:0.5rem;border-radius:4px;background:rgba(255,23,68,0.08);border:1px solid rgba(255,23,68,0.2)">';h+='<div style="font-size:0.8rem;color:var(--wk);font-weight:600">Next Gatekeeper: Floor '+gk.floorMin+'</div>';h+='<div style="font-size:0.85rem">'+esc(gk.name)+' (Lv '+gk.lvl+')</div>';const gkAffMap={w:{label:'WK',cls:'floor-aff-wk'},W:{label:'WK',cls:'floor-aff-wk'},v:{label:'WK',cls:'floor-aff-wk'},V:{label:'WK',cls:'floor-aff-wk'},z:{label:'WK!',cls:'floor-aff-z'},Z:{label:'WK!',cls:'floor-aff-z'},s:{label:'RS',cls:'floor-aff-rs'},S:{label:'RS',cls:'floor-aff-rs'},t:{label:'RS',cls:'floor-aff-rs'},T:{label:'NU',cls:'floor-aff-nu'},n:{label:'NU',cls:'floor-aff-nu'},r:{label:'RP',cls:'floor-aff-rp'},d:{label:'ABS',cls:'floor-aff-abs'}};h+='<div class="floor-enemy-affs" style="margin-top:4px">';RESIST_KEYS.slice(0,9).forEach((k,i)=>{const c=gk.resists[k];if(c&&c!=='-'&&c!=='_'&&c!=='u'&&gkAffMap[c]){h+='<span class="floor-aff '+gkAffMap[c].cls+'">'+RESIST_LABELS[i]+' '+gkAffMap[c].label+'</span>'}});h+='</div>';h+='</div>'}
  // Loadout Advisor — recommend personas from roster for this floor
  if(typeof roster!=='undefined'&&roster.size>0&&typeof PERSONAS!=='undefined'&&typeof SKILLS!=='undefined'&&shadows.length>0){
    h+=renderLoadoutAdvice(shadows);
  }
  info.innerHTML=h;
}

function renderLoadoutAdvice(shadows){
  // Collect floor weakness profile: which elements hit the most enemies
  var floorWeaknesses={};
  RESIST_KEYS.slice(0,9).forEach(function(k){floorWeaknesses[k]=0});
  shadows.forEach(function(s){
    RESIST_KEYS.slice(0,9).forEach(function(k){
      var c=s.resists[k];
      if(c==='w'||c==='W'||c==='v'||c==='V'||c==='z'||c==='Z')floorWeaknesses[k]++;
    });
  });

  // Score each roster persona
  var scored=[];
  roster.forEach(function(name){
    var p=PERSONAS[name];
    if(!p)return;
    var score=0,hits=[],resists=[];

    // Attack scoring: check which skills exploit floor weaknesses
    var coveredElems=new Set();
    Object.keys(p.skills).forEach(function(skName){
      var sk=SKILLS[skName];
      if(!sk||!sk.elem)return;
      var elem=sk.elem;
      if(floorWeaknesses[elem]&&floorWeaknesses[elem]>0&&!coveredElems.has(elem)){
        coveredElems.add(elem);
        score+=floorWeaknesses[elem]*2;
        hits.push(RESIST_LABELS[RESIST_KEYS.indexOf(elem)]+' ('+floorWeaknesses[elem]+')');
      }
    });

    // Defense scoring: check if persona resists common enemy elements
    var enemySkillElems={};
    shadows.forEach(function(s){
      if(!s.skills)return;
      s.skills.forEach(function(skName){
        var sk=SKILLS[skName];
        if(sk&&sk.elem&&RESIST_KEYS.indexOf(sk.elem)!==-1){
          enemySkillElems[sk.elem]=(enemySkillElems[sk.elem]||0)+1;
        }
      });
    });
    // Parse persona resists
    var pResists=p.resists||'';
    RESIST_KEYS.slice(0,9).forEach(function(k,i){
      var c=pResists[i]||'-';
      if((c==='s'||c==='n'||c==='r'||c==='d')&&enemySkillElems[k]){
        score+=1;
        resists.push(RESIST_LABELS[RESIST_KEYS.indexOf(k)]);
      }
      if(c==='w'&&enemySkillElems[k]){
        score-=2;
      }
    });

    if(score>0){
      scored.push({name:name,lvl:p.lvl,race:p.race,score:score,hits:hits,resists:resists});
    }
  });

  if(scored.length===0)return'';

  scored.sort(function(a,b){return b.score-a.score||b.lvl-a.lvl});
  var top=scored.slice(0,4);

  var h='<div class="loadout-section">';
  h+='<div class="loadout-title">Recommended Loadout</div>';
  top.forEach(function(p){
    h+='<div class="loadout-persona">';
    h+='<div class="loadout-name">'+esc(p.name)+' <span class="loadout-lvl">Lv'+p.lvl+'</span> <span class="loadout-arcana">'+esc(p.race)+'</span></div>';
    var reasons=[];
    if(p.hits.length)reasons.push('Hits: '+p.hits.join(', '));
    if(p.resists.length)reasons.push('Resists: '+p.resists.join(', '));
    if(reasons.length)h+='<div class="loadout-reason">'+reasons.join(' · ')+'</div>';
    h+='</div>';
  });
  h+='</div>';
  return h;
}

function renderFullMoon(){
  const c=tartRoot.querySelector('#timeline');let h='';
  FULL_MOON_DATES.forEach((fm,i)=>{
    // Find primary boss strategy (use first named shadow's strat)
    const primaryStrat=fm.names.length>0?BOSS_STRATS[fm.names[0]]:null;
    h+='<div class="moon-card" data-idx="'+i+'"><div class="moon-header"><div class="moon-icon"></div><div><div class="moon-date">'+fm.date+'</div><div class="moon-boss">'+esc(fm.boss)+'</div>';
    if(primaryStrat&&primaryStrat.quickTip)h+='<div class="moon-quick-tip">'+primaryStrat.quickTip+'</div>';
    h+='</div></div><div class="moon-details">';
    // Boss guide section (party, items, personas)
    if(primaryStrat){
      if(primaryStrat.party)h+='<div class="strat-row"><span class="strat-label">Ideal Party:</span> '+primaryStrat.party.map(function(p){return'<span class="strat-badge strat-party">'+esc(p)+'</span>'}).join(' ')+'</div>';
      if(primaryStrat.personas)h+='<div class="strat-row"><span class="strat-label">Bring Personas:</span> '+primaryStrat.personas.map(function(p){return'<span class="strat-badge strat-persona">'+esc(p)+'</span>'}).join(' ')+'</div>';
      if(primaryStrat.items)h+='<div class="strat-row"><span class="strat-label">Stock Items:</span> '+primaryStrat.items.map(function(p){return'<span class="strat-badge strat-item">'+esc(p)+'</span>'}).join(' ')+'</div>';
      if(primaryStrat.recLevel)h+='<div class="strat-row"><span class="strat-label">Rec. Level:</span> <span class="strat-badge strat-lvl">Lv '+primaryStrat.recLevel+'</span></div>';
    }
    // Phase-by-phase tactics
    if(primaryStrat&&primaryStrat.phases){
      h+='<div class="moon-phases">';
      primaryStrat.phases.forEach(function(ph,pi){h+='<div class="strat-phase"><div class="strat-phase-name">'+(pi+1)+'. '+esc(ph.name)+'</div><p>'+ph.tips+'</p></div>'});
      h+='</div>';
    }
    // Shadow stat cards
    const fmS=ALL_SHADOWS.filter(s=>fm.names.includes(s.name));
    if(fmS.length>0){h+='<div class="moon-shadows-label">Enemy Data</div>';fmS.forEach(s=>{
      h+='<div style="margin-top:0.5rem;padding:0.5rem;background:rgba(0,0,0,0.2);border-radius:4px">';
      h+='<div style="font-weight:600;color:var(--text-bright)">'+esc(s.name)+' <span style="color:var(--text-dim);font-size:0.85rem">Lv '+s.lvl+'</span></div>';
      h+='<div class="moon-aff-row">';RESIST_KEYS.slice(0,9).forEach((k,j)=>{h+='<div style="text-align:center;min-width:32px"><div style="font-size:0.65rem;color:var(--text-dim)">'+RESIST_LABELS[j].slice(0,3)+'</div>'+affBadge(s.resists[k])+'</div>'});h+='</div>';
      if(s.skills&&s.skills.length>0){h+='<div style="margin-top:0.5rem"><span class="label">Skills: </span>';s.skills.forEach(sk=>{var ski=typeof SKILLS!=='undefined'?SKILLS[sk]:null;var tip=ski?(' data-tooltip="'+(ELEM_NAMES[ski.elem]||ski.elem)+' | '+ski.target+(ski.cost?' | Cost '+ski.cost:'')+(ski.power?' | Pow '+ski.power:'')+(ski.effect?' | '+ski.effect:'')+'"'):'';h+='<span class="skill-tag"'+tip+'>'+esc(sk)+'</span>'});h+='</div>'}
      h+='</div>'})}else if(!primaryStrat){h+='<div style="color:var(--text-dim);font-size:0.85rem;margin-top:0.5rem">No detailed data available for this encounter.</div>'}
    h+='</div></div>'});
  c.innerHTML=h;
  c.querySelectorAll('.moon-card').forEach(card=>{card.addEventListener('click',()=>{card.classList.toggle('expanded')})});
}

// ========== GRINDING GUIDE ==========
function renderGrindingGuide(playerLvl){
  var info=tartRoot.querySelector('#grindInfo');
  if(!playerLvl||playerLvl<1){info.innerHTML='<div style="color:var(--text-dim);font-size:0.85rem">Enter your level to see best grinding spots.</div>';return}
  // Group shadows by block+floor range and compute EXP density
  var spots={};
  ALL_SHADOWS.forEach(function(s){
    if(!s.block||!s.floorMin||!s.floorMax||!s.exp||s.type==='fullmoon')return;
    var key=s.block+':'+s.floorMin+'-'+s.floorMax;
    if(!spots[key])spots[key]={block:s.block,fMin:s.floorMin,fMax:s.floorMax,totalExp:0,count:0,avgLvl:0,shadows:[]};
    spots[key].totalExp+=s.exp;spots[key].count++;spots[key].avgLvl+=s.lvl;spots[key].shadows.push(s.name);
  });
  var arr=Object.values(spots).map(function(sp){
    sp.avgLvl=Math.round(sp.avgLvl/sp.count);
    var lvlDiff=Math.abs(sp.avgLvl-playerLvl);
    sp.efficiency=Math.round(sp.totalExp/(1+lvlDiff*0.15));
    var b=BLOCKS.find(function(bl){return bl.id===sp.block});
    sp.blockName=b?b.name:sp.block;sp.blockColor=b?b.color:'#fff';
    return sp;
  });
  arr.sort(function(a,b){return b.efficiency-a.efficiency});
  var top=arr.slice(0,5);
  var h='';
  top.forEach(function(sp,i){
    h+='<div class="grind-spot"><div class="grind-rank">#'+(i+1)+'</div><div class="grind-info"><div class="grind-block" style="color:'+sp.blockColor+'">'+esc(sp.blockName)+' F'+sp.fMin+'-'+sp.fMax+'</div><div class="grind-meta">'+sp.totalExp+' EXP \u00b7 Avg Lv'+sp.avgLvl+' \u00b7 '+sp.count+' shadows</div></div></div>';
  });
  info.innerHTML=h||'<div style="color:var(--text-dim);font-size:0.85rem">No grinding data available.</div>';
}

// ========== LOOT FINDER ==========
var lootIndex=null;
function buildLootIndex(){
  if(lootIndex)return;
  lootIndex={};
  ALL_SHADOWS.forEach(function(s){
    if(!s.dodds)return;
    Object.entries(s.dodds).forEach(function(entry){
      var item=entry[0],chance=entry[1];
      if(!lootIndex[item])lootIndex[item]=[];
      lootIndex[item].push({enemy:s.name,chance:chance,area:s.area||'',lvl:s.lvl});
    });
  });
  for(var item in lootIndex)lootIndex[item].sort(function(a,b){return b.chance-a.chance});
}

function renderLootGuide(query){
  var info=tartRoot.querySelector('#lootInfo');
  buildLootIndex();
  if(!query){
    var allItems=Object.keys(lootIndex).sort();
    info.innerHTML='<div style="color:var(--text-dim);font-size:0.85rem">'+allItems.length+' unique items. Type to search.</div>';
    return;
  }
  var q=query.toLowerCase();
  var matches=Object.entries(lootIndex).filter(function(e){return e[0].toLowerCase().includes(q)});
  if(matches.length===0){info.innerHTML='<div style="color:var(--text-dim);font-size:0.85rem">No items match "'+esc(query)+'".</div>';return}
  var h='';
  matches.slice(0,10).forEach(function(entry){
    var item=entry[0],sources=entry[1];
    h+='<div class="loot-item-group"><div class="loot-item-name">'+esc(item)+'</div>';
    sources.slice(0,5).forEach(function(src){
      h+='<div class="loot-source"><span class="loot-chance">'+src.chance+'%</span> <span class="loot-enemy">'+esc(src.enemy)+'</span> <span class="loot-area">Lv'+src.lvl+' \u00b7 '+esc(src.area)+'</span></div>';
    });
    if(sources.length>5)h+='<div class="loot-source" style="color:var(--text-dim)">...+'+(sources.length-5)+' more</div>';
    h+='</div>';
  });
  if(matches.length>10)h+='<div style="color:var(--text-dim);font-size:0.85rem;margin-top:0.3rem">Showing 10 of '+matches.length+' matches.</div>';
  info.innerHTML=h;
}

function initTartarus(){
  tartRoot=document.getElementById('tartarus');
  const root=tartRoot;
  renderTable();renderFullMoon();renderFloorScout(null);
  root.querySelector('#tableBody').addEventListener('click',e=>{const row=e.target.closest('.shadow-row');if(!row)return;const name=row.dataset.name;state.expandedRow=state.expandedRow===name?null:name;renderTable()});
  root.querySelector('#searchBox').addEventListener('input',e=>{state.query=e.target.value;state.expandedRow=null;renderTable()});
  root.querySelectorAll('.nav-tab').forEach(tab=>{tab.addEventListener('click',()=>{
    root.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));tab.classList.add('active');
    const view=tab.dataset.view,block=tab.dataset.block;
    if(view==='fullmoon'){state.view='fullmoon';root.querySelector('#mainView').style.display='none';root.querySelector('#controls').style.display='none';root.querySelector('#fullmoonSection').classList.add('active')}
    else{state.view='database';root.querySelector('#mainView').style.display='flex';root.querySelector('#controls').style.display='flex';root.querySelector('#fullmoonSection').classList.remove('active');state.blockFilter=block||null;state.expandedRow=null;renderTable()}
  })});
  root.querySelectorAll('.filter-btn[data-type]').forEach(btn=>{btn.addEventListener('click',()=>{
    const type=btn.dataset.type;if(state.typeFilters.has(type)){state.typeFilters.delete(type);btn.classList.remove('active')}else{state.typeFilters.add(type);btn.classList.add('active')}state.expandedRow=null;renderTable()})});
  root.querySelector('#weakFilter').addEventListener('change',e=>{state.weakFilter=e.target.value;state.expandedRow=null;renderTable()});
  root.querySelector('#lvlMin').addEventListener('input',e=>{state.lvlMin=+e.target.value||0;state.expandedRow=null;renderTable()});
  root.querySelector('#lvlMax').addEventListener('input',e=>{state.lvlMax=+e.target.value||99;state.expandedRow=null;renderTable()});
  root.querySelectorAll('#tableHead th').forEach(th=>{th.addEventListener('click',()=>{
    const col=th.dataset.col;if(state.sortCol===col)state.sortDir=state.sortDir==='asc'?'desc':'asc';else{state.sortCol=col;state.sortDir='asc'}renderTable()})});
  root.querySelector('#floorInput').addEventListener('input',e=>{renderFloorScout(+e.target.value)});
  // Ailment filter
  var ailF=root.querySelector('#ailmentFilter');
  if(ailF)ailF.addEventListener('change',e=>{state.ailmentFilter=e.target.value;state.expandedRow=null;renderTable()});
  // Grinding guide
  var grindIn=root.querySelector('#grindInput');
  if(grindIn)grindIn.addEventListener('input',e=>{renderGrindingGuide(+e.target.value)});
  // Loot finder
  var lootIn=root.querySelector('#lootSearch');
  if(lootIn)lootIn.addEventListener('input',e=>{renderLootGuide(e.target.value.trim())});
}
