/* KinWeave - 界面交互模块
 * 职责：弹窗管理、搜索定位、导入导出、事件绑定
 */
(function (global) {
  'use strict';

  var Core = global.FamilyCore;
  var Graph = global.GraphManager;
  var Person = global.PersonManager;
  var Edge = global.EdgeManager;
  var History = global.HistoryManager;
  var Render = global.RenderManager;

  var store = null;
  var editingPersonId = null;
  var editingEdgeId = null;
  var pendingFocusId = null;

  function $(id) { return document.getElementById(id); }

  var el = {};
  function cacheDom() {
    el = {
      network: $('network'), empty: $('empty'), toast: $('toast'), fileInput: $('fileInput'),
      graphSelect: $('graphSelect'), graphModal: $('graphModal'), graphList: $('graphList'),
      searchBar: $('searchBar'), searchInput: $('searchInput'),
      layoutModal: $('layoutModal'), layoutGrid: $('layoutGrid'),
      moreModal: $('moreModal'),
      personModal: $('personModal'), personTitle: $('personTitle'),
      personName: $('personName'), personGender: $('personGender'), personBio: $('personBio'), personDelete: $('personDelete'),
      edgeModal: $('edgeModal'), edgeFrom: $('edgeFrom'), edgeTo: $('edgeTo'),
      edgeFromSearch: $('edgeFromSearch'), edgeToSearch: $('edgeToSearch'),
      edgeLabel: $('edgeLabel'), edgePresets: $('edgePresets'), edgeDirection: $('edgeDirection'),
      edgeActionModal: $('edgeActionModal'), edgeActionInfo: $('edgeActionInfo'),
      edgeActionLabel: $('edgeActionLabel'), edgeActionDirection: $('edgeActionDirection'),
      statusName: $('statusName'), statusCount: $('statusCount')
    };
  }

  var toastTimer = null;
  function toast(msg) {
    if (!el.toast) return;
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.add('hidden'); }, 2200);
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function graph() { return Graph.getCurrent(store); }

  function persistOnly() { Core.saveLocal(store); }

  function commit() {
    persistOnly();
    History.push(store);
    Render.rebuild(store);
    updateAll();
  }

  function updateAll() {
    updateGraphSelect();
    updateStatusBar();
    updateEmptyState();
    updateHistoryButtons();
  }

  function updateEmptyState() {
    var g = graph();
    if (g.persons.length === 0) el.empty.classList.remove('hidden');
    else el.empty.classList.add('hidden');
  }

  function updateStatusBar() {
    var g = graph();
    if (el.statusName) el.statusName.textContent = g.name;
    if (el.statusCount) el.statusCount.textContent = g.persons.length + ' 人 · ' + g.edges.length + ' 条关系';
  }

  function updateHistoryButtons() {
    var undoBtn = $('btnUndo');
    var redoBtn = $('btnRedo');
    if (undoBtn) undoBtn.disabled = !History.canUndo();
    if (redoBtn) redoBtn.disabled = !History.canRedo();
  }

  /* ---------- 关系图下拉与列表 ---------- */
  function updateGraphSelect() {
    if (!el.graphSelect) return;
    el.graphSelect.innerHTML = '';
    store.graphs.forEach(function (g) {
      var opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name + '（' + g.persons.length + '）';
      if (g.id === store.currentGraphId) opt.selected = true;
      el.graphSelect.appendChild(opt);
    });
  }

  function switchGraph(id) {
    var g = Graph.findGraph(store, id);
    if (!g) return;
    if (Render.isLocked()) Render.savePositions(store);
    store.currentGraphId = id;
    persistOnly();
    Render.rebuild(store);
    updateAll();
  }

  function renderGraphList() {
    el.graphList.innerHTML = '';
    store.graphs.forEach(function (g) {
      var item = document.createElement('div');
      item.className = 'list-item' + (g.id === store.currentGraphId ? ' active' : '');
      var nameWrap = document.createElement('div');
      nameWrap.className = 'list-name';
      nameWrap.innerHTML = '<div class="ln">' + escapeHtml(g.name) + '</div><div class="ls">' + g.persons.length + ' 人 · ' + g.edges.length + ' 条关系</div>';
      item.appendChild(nameWrap);
      var ops = document.createElement('div');
      ops.className = 'list-ops';
      if (g.id !== store.currentGraphId) {
        var bSwitch = document.createElement('button');
        bSwitch.className = 'btn small'; bSwitch.textContent = '切换';
        bSwitch.addEventListener('click', function () { switchGraph(g.id); renderGraphList(); toast('已切换到「' + g.name + '」'); });
        ops.appendChild(bSwitch);
      }
      var bRename = document.createElement('button');
      bRename.className = 'btn small'; bRename.textContent = '重命名';
      bRename.addEventListener('click', function () { startRename(item, g); });
      ops.appendChild(bRename);
      var bCopy = document.createElement('button');
      bCopy.className = 'btn small'; bCopy.textContent = '复制';
      bCopy.addEventListener('click', function () { Graph.duplicateGraph(store, g.id); commit(); renderGraphList(); toast('已复制为副本'); });
      ops.appendChild(bCopy);
      if (store.graphs.length > 1) {
        var bDel = document.createElement('button');
        bDel.className = 'btn small danger'; bDel.textContent = '删除';
        bDel.addEventListener('click', function () {
          if (Graph.removeGraph(store, g.id)) { commit(); renderGraphList(); toast('已删除「' + g.name + '」'); }
          else toast('至少保留一份关系图');
        });
        ops.appendChild(bDel);
      }
      item.appendChild(ops);
      el.graphList.appendChild(item);
    });
  }

  function startRename(item, g) {
    item.innerHTML = '';
    var input = document.createElement('input');
    input.type = 'text'; input.value = g.name; input.className = 'rename-input';
    item.appendChild(input);
    var ops = document.createElement('div'); ops.className = 'list-ops';
    var ok = document.createElement('button'); ok.className = 'btn small primary'; ok.textContent = '确定';
    ok.addEventListener('click', function () { Graph.renameGraph(store, g.id, input.value); commit(); renderGraphList(); toast('已重命名'); });
    ops.appendChild(ok);
    var cancel = document.createElement('button'); cancel.className = 'btn small ghost'; cancel.textContent = '取消';
    cancel.addEventListener('click', renderGraphList);
    ops.appendChild(cancel);
    item.appendChild(ops);
    input.focus();
  }

  /* ---------- 人物编辑 ---------- */
  function fillGenderSelect(value) {
    el.personGender.innerHTML = '';
    Core.GENDERS.forEach(function (g) {
      var opt = document.createElement('option');
      opt.value = g; opt.textContent = g;
      if (g === value) opt.selected = true;
      el.personGender.appendChild(opt);
    });
  }

  function openPersonEditor(id) {
    var person = Person.findPerson(graph(), id);
    if (!person) return;
    editingPersonId = id;
    el.personTitle.textContent = '编辑人物';
    el.personName.value = person.name || '';
    el.personBio.value = person.bio || '';
    fillGenderSelect(person.gender || '未设置');
    el.personDelete.classList.remove('hidden');
    el.personModal.classList.remove('hidden');
  }

  function openPersonCreator() {
    editingPersonId = null;
    el.personTitle.textContent = '添加人物';
    el.personName.value = ''; el.personBio.value = '';
    fillGenderSelect('未设置');
    el.personDelete.classList.add('hidden');
    el.personModal.classList.remove('hidden');
    setTimeout(function () { el.personName.focus(); }, 120);
  }

  function closePersonEditor() { editingPersonId = null; el.personModal.classList.add('hidden'); }

  function savePerson() {
    var data = { name: el.personName.value.trim(), bio: el.personBio.value.trim(), gender: el.personGender.value };
    var g = graph();
    if (editingPersonId) { Person.updatePerson(g, editingPersonId, data); toast('已保存修改'); }
    else { var person = Person.addPerson(g, data); pendingFocusId = person.id; toast('已添加人物'); }
    closePersonEditor();
    commit();
    if (pendingFocusId) { Render.focusNode(pendingFocusId); pendingFocusId = null; }
  }

  function deletePerson() {
    if (!editingPersonId) return;
    Person.removePerson(graph(), editingPersonId);
    toast('已删除人物及其关系');
    closePersonEditor();
    commit();
  }

  /* ---------- 关系编辑 ---------- */
  function renderPresets() {
    el.edgePresets.innerHTML = '';
    Core.RELATION_PRESETS.forEach(function (r) {
      var chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'chip'; chip.textContent = r.label;
      chip.addEventListener('click', function () { el.edgeLabel.value = r.label; el.edgeDirection.value = r.directed ? 'directed' : 'undirected'; });
      el.edgePresets.appendChild(chip);
    });
  }

  function fillFilteredSelect(select, keyword, selectedId) {
    var g = graph();
    select.innerHTML = '';
    var kw = (keyword || '').trim().toLowerCase();
    var list = g.persons.filter(function (p) { return !kw || (p.name || '').toLowerCase().indexOf(kw) >= 0; });
    if (list.length === 0) { var empty = document.createElement('option'); empty.disabled = true; empty.textContent = '没有匹配的人物'; select.appendChild(empty); return; }
    list.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.id; opt.textContent = Person.displayName(p);
      if (p.id === selectedId) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function openEdgeCreator() {
    var g = graph();
    if (g.persons.length < 2) { toast('至少需要两个人物才能建立关系'); return; }
    editingEdgeId = null;
    el.edgeFromSearch.value = ''; el.edgeToSearch.value = ''; el.edgeLabel.value = '';
    el.edgeDirection.value = 'directed';
    fillFilteredSelect(el.edgeFrom, '', g.persons[0].id);
    fillFilteredSelect(el.edgeTo, '', g.persons[1].id);
    renderPresets();
    el.edgeModal.classList.remove('hidden');
  }

  function closeEdgeCreator() { el.edgeModal.classList.add('hidden'); }

  function saveEdge() {
    var from = el.edgeFrom.value, to = el.edgeTo.value, label = el.edgeLabel.value.trim();
    if (!label) { toast('请填写关系名称'); return; }
    var directed = el.edgeDirection.value === 'directed';
    var result = Edge.addEdge(graph(), { from: from, to: to, label: label, directed: directed });
    if (result.error) { toast(result.error); return; }
    toast('已添加关系');
    closeEdgeCreator();
    commit();
  }

  function openEdgeAction(id) {
    var g = graph();
    var edge = Edge.findEdge(g, id);
    if (!edge) return;
    editingEdgeId = id;
    var from = Person.findPerson(g, edge.from), to = Person.findPerson(g, edge.to);
    var dirText = edge.directed ? ' → ' : ' — ';
    el.edgeActionInfo.innerHTML = '<div>' + escapeHtml(Person.displayName(from)) + dirText + escapeHtml(edge.label || '（未命名关系）') + dirText + escapeHtml(Person.displayName(to)) + '</div>';
    el.edgeActionLabel.value = edge.label || '';
    el.edgeActionDirection.value = edge.directed ? 'directed' : 'undirected';
    el.edgeActionModal.classList.remove('hidden');
  }

  function closeEdgeAction() { editingEdgeId = null; el.edgeActionModal.classList.add('hidden'); }

  function saveEdgeAction() {
    if (!editingEdgeId) return;
    var directed = el.edgeActionDirection.value === 'directed';
    Edge.updateEdge(graph(), editingEdgeId, { label: el.edgeActionLabel.value.trim(), directed: directed });
    toast('已更新关系');
    closeEdgeAction();
    commit();
  }

  function deleteEdge() {
    if (!editingEdgeId) return;
    Edge.removeEdge(graph(), editingEdgeId);
    toast('已删除关系');
    closeEdgeAction();
    commit();
  }

  /* ---------- 搜索定位 ---------- */
  function toggleSearch(show) {
    el.searchBar.classList.toggle('hidden', show === false);
    if (show !== false) setTimeout(function () { el.searchInput.focus(); }, 120);
  }

  function doSearch() {
    var g = graph();
    var kw = el.searchInput.value.trim().toLowerCase();
    if (!kw) return;
    var matches = g.persons.filter(function (p) { return (p.name || '').toLowerCase().indexOf(kw) >= 0; });
    if (matches.length === 0) { toast('未找到匹配的人物'); return; }
    Render.focusNode(matches[0].id);
    toast(matches.length > 1 ? ('找到 ' + matches.length + ' 人，已定位到第一个') : ('已定位到 ' + Person.displayName(matches[0])));
  }

  /* ---------- 导入导出 ---------- */
  function exportData() {
    var payload = JSON.stringify(store, null, 2);
    var blob = new Blob([payload], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'kinweave-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
    toast('已导出全部关系图');
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var result = Core.validateImport(String(reader.result));
      if (!result.ok) { toast('导入失败：' + result.error); return; }
      store = result.data;
      persistentReset();
      toast('导入成功：' + store.graphs.length + ' 份关系图');
      setTimeout(function () { Render.fitView(); }, 300);
    };
    reader.onerror = function () { toast('文件读取失败'); };
    reader.readAsText(file);
  }

  function persistentReset() {
    Core.saveLocal(store);
    History.reset(store);
    Render.rebuild(store);
    updateAll();
  }

  /* ---------- 撤销/重做 ---------- */
  function undo() {
    var restored = History.undo(store);
    if (!restored) { toast('没有可撤销的操作'); return; }
    store = restored;
    persistOnly();
    Render.rebuild(store);
    updateAll();
    toast('已撤销');
  }

  function redo() {
    var restored = History.redo(store);
    if (!restored) { toast('没有可重做的操作'); return; }
    store = restored;
    persistOnly();
    Render.rebuild(store);
    updateAll();
    toast('已重做');
  }

  /* ---------- 布局 ---------- */
  function renderLayoutGrid() {
    el.layoutGrid.innerHTML = '';
    var layouts = Render.getLayouts();
    var current = Render.getCurrentLayout();
    layouts.forEach(function (l) {
      var item = document.createElement('div');
      item.className = 'layout-item' + (l.key === current ? ' active' : '');
      item.innerHTML = '<div class="li-name">' + l.name + '</div><div class="li-desc">' + l.desc + '</div>';
      item.addEventListener('click', function () {
        Render.applyLayout(store, l.key);
        el.layoutModal.classList.add('hidden');
        var layoutName = layouts.filter(function (x) { return x.key === l.key; })[0];
        toast('已切换为' + (layoutName ? layoutName.name : l.key));
      });
      el.layoutGrid.appendChild(item);
    });
  }

  function updateLockButton() {
    var btn = $('moreLock');
    if (!btn) return;
    btn.textContent = Render.isLocked() ? '📌 已锁定（点击解除）' : '📌 锁定位置';
  }

  function toggleLock() {
    var locked = Render.toggleLock(store);
    persistOnly();
    updateLockButton();
    toast(locked ? '已锁定位置，拖拽不会被打乱' : '已解除锁定');
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents() {
    $('btnAddPerson').addEventListener('click', openPersonCreator);
    $('btnAddEdge').addEventListener('click', openEdgeCreator);
    $('btnSearch').addEventListener('click', function () { toggleSearch(); });
    $('btnUndo').addEventListener('click', undo);
    $('btnRedo').addEventListener('click', redo);

    $('btnMore').addEventListener('click', function () { updateLockButton(); el.moreModal.classList.remove('hidden'); });
    $('moreClose').addEventListener('click', function () { el.moreModal.classList.add('hidden'); });
    $('moreLayout').addEventListener('click', function () { el.moreModal.classList.add('hidden'); renderLayoutGrid(); el.layoutModal.classList.remove('hidden'); });
    $('moreLock').addEventListener('click', function () { el.moreModal.classList.add('hidden'); toggleLock(); });
    $('moreFit').addEventListener('click', function () { el.moreModal.classList.add('hidden'); Render.fitView(); });
    $('moreExport').addEventListener('click', function () { el.moreModal.classList.add('hidden'); exportData(); });
    $('moreImport').addEventListener('click', function () { el.moreModal.classList.add('hidden'); el.fileInput.click(); });

    $('layoutClose').addEventListener('click', function () { el.layoutModal.classList.add('hidden'); });

    $('btnGraphMenu').addEventListener('click', function () { renderGraphList(); el.graphModal.classList.remove('hidden'); });
    $('graphClose').addEventListener('click', function () { el.graphModal.classList.add('hidden'); });
    $('graphNew').addEventListener('click', function () { var g = Graph.addGraph(store, null); commit(); renderGraphList(); toast('已新建「' + g.name + '」'); });

    el.graphSelect.addEventListener('change', function () { switchGraph(el.graphSelect.value); });

    $('searchClose').addEventListener('click', function () { toggleSearch(false); el.searchInput.value = ''; });
    el.searchInput.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') doSearch(); });
    el.searchInput.addEventListener('input', function () { if (el.searchInput.value.trim().length >= 2) doSearch(); });

    el.edgeFromSearch.addEventListener('input', function () { fillFilteredSelect(el.edgeFrom, el.edgeFromSearch.value, null); });
    el.edgeToSearch.addEventListener('input', function () { fillFilteredSelect(el.edgeTo, el.edgeToSearch.value, null); });

    $('personSave').addEventListener('click', savePerson);
    $('personCancel').addEventListener('click', closePersonEditor);
    $('personDelete').addEventListener('click', deletePerson);

    $('edgeSave').addEventListener('click', saveEdge);
    $('edgeCancel').addEventListener('click', closeEdgeCreator);

    $('edgeActionDel').addEventListener('click', deleteEdge);
    $('edgeActionCancel').addEventListener('click', closeEdgeAction);
    $('edgeActionSave').addEventListener('click', saveEdgeAction);

    el.fileInput.addEventListener('change', function (ev) { var f = ev.target.files && ev.target.files[0]; if (f) importData(f); el.fileInput.value = ''; });

    [$('graphModal'), $('layoutModal'), $('moreModal'), $('personModal'), $('edgeModal'), $('edgeActionModal')].forEach(function (modal) {
      modal.addEventListener('click', function (ev) { if (ev.target === modal) modal.classList.add('hidden'); });
    });

    window.addEventListener('resize', function () { Render.rebuild(store); });

    document.addEventListener('keydown', function (ev) {
      var mod = ev.ctrlKey || ev.metaKey;
      if (mod && ev.key.toLowerCase() === 'z' && !ev.shiftKey) { ev.preventDefault(); undo(); }
      if (mod && (ev.key.toLowerCase() === 'y' || (ev.key.toLowerCase() === 'z' && ev.shiftKey))) { ev.preventDefault(); redo(); }
    });
  }

  /* ---------- 启动 ---------- */
  function boot() {
    cacheDom();
    store = Core.loadLocal() || Core.createStore();
    Graph.getCurrent(store);
    var g = graph();
    if (g.persons.length === 0 && g.edges.length === 0 && store.graphs.length === 1) {
      store = Core.sampleData();
      Core.saveLocal(store);
    }
    Render.initNetwork(el.network, store, function (params) {
      if (params.nodes && params.nodes.length > 0) openPersonEditor(params.nodes[0]);
      else if (params.edges && params.edges.length > 0) openEdgeAction(params.edges[0]);
    });
    History.reset(store);
    updateAll();
    bindEvents();
    setTimeout(function () { Render.fitView(); }, 600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
