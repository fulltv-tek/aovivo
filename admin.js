/* admin.js — Painel Fulltv (ID sempre novo, exporta em aba) */
(function(){
  let channels = Array.isArray(CHANNELS) ? JSON.parse(JSON.stringify(CHANNELS)) : [];
  let editIndex = null;

  const $ = (id) => document.getElementById(id);
  const tbody = $('tbody');

  // ===== Utilidades =====
  const genId = () => (crypto?.randomUUID?.() || ('id_' + Date.now().toString(36) + Math.random().toString(36).slice(2,9)));
  const toInt = (v, d=1) => { const n = parseInt(v,10); return Number.isNaN(n) ? d : n; };
  const compare = (a,b) => (toInt(a.number)-toInt(b.number)) || (a.name||'').localeCompare(b.name||'');

  function sortByNumber(){ channels.sort(compare); }
  function clampForAdd(n){ return Math.min(Math.max(1, n), channels.length+1); }
  function clampForEdit(n){ return Math.min(Math.max(1, n), channels.length+1); }

  function shiftUpFrom(n){ channels.forEach(c => { if (toInt(c.number) >= n) c.number = toInt(c.number)+1; }); }
  function shiftDownFrom(n){ channels.forEach(c => { if (toInt(c.number) > n) c.number = toInt(c.number)-1; }); }

  function readForm(){
    const data = {
      number:   toInt(($('fNumber').value||'').trim(), NaN),
      name:     ($('fName').value||'').trim(),
      category: ($('fCategory').value||'').trim() || 'Abertos',
      quality:  ($('fQuality').value||'').trim() || 'HD',
      logoUrl:  ($('fLogo').value||'').trim(),
      streamUrl:($('fStream').value||'').trim(),
      live:     $('fLive').checked
    };
    if (!data.name) throw new Error('Informe o nome do canal');
    if (!data.streamUrl) throw new Error('Informe o link do player');
    if (Number.isNaN(data.number)) throw new Error('Informe o número do canal');
    return data;
  }

  function fillForm(ch){
    $('fNumber').value = ch.number ?? '';
    $('fName').value = ch.name ?? '';
    $('fCategory').value = ch.category ?? 'Abertos';
    $('fQuality').value = ch.quality ?? 'HD';
    $('fLogo').value = ch.logoUrl ?? '';
    $('fStream').value = ch.streamUrl ?? '';
    $('fLive').checked = !!ch.live;
  }
  function resetForm(){ editIndex=null; $('fNumber').value=''; $('fName').value=''; $('fCategory').value='Abertos'; $('fQuality').value='HD'; $('fLogo').value=''; $('fStream').value=''; $('fLive').checked=true; }

  // ===== CRUD =====
  function addNew(data){
    sortByNumber();
    const n = clampForAdd(toInt(data.number));
    shiftUpFrom(n);
    channels.push({ id: genId(), ...data, number: n });
    sortByNumber(); renderTable(); resetForm();
  }

  function updateExisting(idx, data){
    sortByNumber();
    const old = channels[idx]; if (!old) return;
    const oldN = toInt(old.number), newN = clampForEdit(toInt(data.number));
    channels.splice(idx,1); shiftDownFrom(oldN);
    shiftUpFrom(newN);
    channels.push({ id: genId(), ...data, number: newN });
    sortByNumber(); renderTable(); resetForm();
  }

  function deleteAt(idx){
    sortByNumber();
    const removed = channels[idx]; if (!removed) return;
    const n = toInt(removed.number);
    channels.splice(idx,1); shiftDownFrom(n);
    sortByNumber(); renderTable();
  }

  // ===== Tabela =====
  function renderTable(){
    sortByNumber(); tbody.innerHTML='';
    channels.forEach((ch, idx) => {
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td>${ch.number??''}</td>
        <td>${ch.name??''}</td>
        <td>${ch.category??''}</td>
        <td>${ch.quality??''}</td>
        <td>${ch.live?'Sim':'Não'}</td>
        <td>${ch.logoUrl?`<a href="${ch.logoUrl}" target="_blank">logo</a>`:'—'}</td>
        <td>${ch.streamUrl?`<a href="${ch.streamUrl}" target="_blank">abrir</a>`:'—'}</td>
        <td class="td-actions"></td>`;
      const tdAct=tr.querySelector('.td-actions');
      const bEdit=document.createElement('button'); bEdit.className='btn'; bEdit.textContent='Editar';
      const bDel=document.createElement('button'); bDel.className='btn danger'; bDel.textContent='Excluir';
      const bUp=document.createElement('button'); bUp.className='btn'; bUp.textContent='↑';
      const bDown=document.createElement('button'); bDown.className='btn'; bDown.textContent='↓';
      bEdit.onclick=()=>{editIndex=idx; fillForm(ch); window.scrollTo({top:0,behavior:'smooth'});};
      bDel.onclick=()=>{if(confirm(`Excluir "${ch.name}"?`)) deleteAt(idx);};
      bUp.onclick=()=>{if(idx>0){[channels[idx-1].number,channels[idx].number]=[channels[idx].number,channels[idx-1].number];sortByNumber();renderTable();}};
      bDown.onclick=()=>{if(idx<channels.length-1){[channels[idx+1].number,channels[idx].number]=[channels[idx].number,channels[idx+1].number];sortByNumber();renderTable();}};
      tdAct.append(bEdit,bDel,bUp,bDown);
      tbody.appendChild(tr);
    });
  }

  // ===== Export =====
  function exportJS(){
    sortByNumber();
    const code='// channels.js — gerado pelo painel Fulltv\n' +
               'const CHANNELS = ' + JSON.stringify(channels,null,2) + ';\n';
    const win=window.open('','_blank');
    win.document.write('<pre style="white-space:pre-wrap;font-size:14px">'+
                       code.replace(/</g,'&lt;').replace(/>/g,'&gt;')+
                       '</pre>');
    win.document.close();
  }
  function exportJSON(){
    sortByNumber();
    const code=JSON.stringify(channels,null,2);
    const win=window.open('','_blank');
    win.document.write('<pre style="white-space:pre-wrap;font-size:14px">'+
                       code.replace(/</g,'&lt;').replace(/>/g,'&gt;')+
                       '</pre>');
    win.document.close();
  }

  function savePreview(){sortByNumber();localStorage.setItem('CHANNELS_OVERRIDE',JSON.stringify(channels));alert('Pré-visualização salva! Abra o index.html para testar.');}
  function clearPreview(){localStorage.removeItem('CHANNELS_OVERRIDE');alert('Pré-visualização removida.');}

  function importFile(file){
    const reader=new FileReader();
    reader.onload=()=>{try{
      let data;
      if(/const\s+CHANNELS\s*=/.test(reader.result)){
        const jsonPart=reader.result.slice(reader.result.indexOf('['),reader.result.lastIndexOf(']')+1);
        data=JSON.parse(jsonPart);
      } else data=JSON.parse(reader.result);
      if(!Array.isArray(data)) throw new Error('Formato inválido');
      channels=data.map(c=>({id:genId(),number:toInt(c.number),name:c.name||'',category:c.category||'Abertos',quality:c.quality||'HD',logoUrl:c.logoUrl||'',live:!!c.live,streamUrl:c.streamUrl||''}));
      sortByNumber(); renderTable(); alert('Importado com sucesso!');
    }catch(e){alert('Erro ao importar: '+e.message);}};
    reader.readAsText(file,'utf-8');
  }

  // ===== Eventos =====
  $('btnAdd').onclick=()=>{try{const d=readForm(); editIndex===null?addNew(d):updateExisting(editIndex,d);}catch(e){alert(e.message);}};
  $('btnResetForm').onclick=resetForm;
  $('btnExportJS').onclick=exportJS;
  $('btnExportJSON').onclick=exportJSON;
  $('btnSavePreview').onclick=savePreview;
  $('btnClearPreview').onclick=clearPreview;
  $('fileImport').addEventListener('change',e=>{const f=e.target.files?.[0]; if(f) importFile(f); e.target.value='';});

  sortByNumber(); renderTable();
})();
