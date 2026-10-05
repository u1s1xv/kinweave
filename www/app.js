/* 家谱关系图 - 交互逻辑 */
(function () {
  'use strict';

  var Core = window.FamilyCore;
  var store = Core.loadLocal() || Core.createStore();
  var network = null;
  var nodesDS = null;
  var edgesDS = null;
  var editingPersonId = null;
  var editingEdgeId = null;

  /* ---------- DOM ---------- */
  function $(id) { return document.getElementById(id); }

  var el = {
    network: $('network'),
    empty: $('empty'),
    toast: $('toast'),
    fileInput: $('fileInput'),
    personModal: $('personModal'),
    personTitle: $('personTitle'),
    personName: $('personName'),
    personBio: $('personBio'),
    personDelete: $('personDelete'),
    personSave: $('personSave'),
    personCancel: $('personCancel'),
    edgeModal: $('edgeModal'),
    edgeFrom: $('edgeFrom'),
    edgeTo: $('edgeTo'),
    edgeLabel: $('edgeLabel'),
    edgeSave: $('edgeSave'),
    edgeCancel: $('edgeCancel'),
    edgeActionModal: $('edgeActionModal'),
    edgeActionInfo: $('edgeActionInfo'),
    edgeActionDel: $('edgeActionDel'),
    edgeActionCancel: $('edgeActionCancel')
  };

  var toastTimer = null;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.toast.classList.add('hidden');
    }, 2200);
  }

  /* ---------- 图形节点与连线 ---------- */
  function nodeOptions(count) {
    var size = count > 30 ? 16 : 20;
    return {
      shape: 'dot',
      size: size,
      color: {
        background: '#38bdf8',
        border: '#0ea5e9',
        highlight: { background: '#7dd3fc', border: '#0284c7' }
      },
      font: {
        color: '#e2e8f0',
        size: count > 30 ? 12 : 14,
        face: 'sans-serif'
      },
      borderWidth: 2
    };
  }

  function toNodes() {
    var opts = nodeOptions(store.persons.length);
    return store.persons.map(function (p) {
      var display = Core.displayName(p);
      var title = p.bio ? '<div style="max-width:240px">' + escapeHtml(p.bio) + '</div>' : '';
      return {
        id: p.id,
        label: display,
        title: title,
        shape: opts.shape,
        size: opts.size,
        color: opts.color,
        font: opts.font,
        borderWidth: opts.borderWidth
      };
    });
  }

  function toEdges() {
    return store.edges.map(function (e) {
      return {
        id: e.id,
        from: e.from,
        to: e.to,
        label: e.label || '',
        font: {
          color: '#cbd5e1',
          size: 12,
          strokeWidth: 4,
          strokeColor: '#0f172a',
          align: 'middle'
        },
        color: { color: '#64748b', highlight: '#38bdf8', hover: '#38bdf8' },
        width: 1.6,
        smooth: { type: 'dynamic' }
      };
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------- 初始化图形 ---------- */
  function initNetwork() {
    nodesDS = new vis.DataSet(toNodes());
    edgesDS = new vis.DataSet(toEdges());

    var data = { nodes: nodesDS, edges: edgesDS };
    var options = {
      autoResize: true,
      interaction: {
        hover: true,
        multiselect: false,
        navigationButtons: false,
        zoomView: true,
        dragView: true,
        tooltipDelay: 250
      },
      physics: {
        enabled: true,
        stabilization: { enabled: true, iterations: 400, updateInterval: 30 },
        barnesHut: {
          gravitationalConstant: -6000,
          centralGravity: 0.28,
          springLength: 140,
          springConstant: 0.05,
          damping: 0.4
        }
      },
      edges: {
        arrows: { to: { enabled: false } },
        font: { size: 12, color: '#cbd5e1', strokeWidth: 4, strokeColor: '#0f172a' }
      },
      nodes: {
        shape: 'dot',
        size: 20,
        font: { color: '#e2e8f0', size: 14 }
      },
      layout: { improvedLayout: true }
    };

    network = new vis.Network(el.network, data, options);

    network.on('click', function (params) {
      if (params.nodes && params.nodes.length > 0) {
        openPersonEditor(params.nodes[0]);
      } else if (params.edges && params.edges.length > 0) {
        openEdgeAction(params.edges[0]);
      }
    });
  }

  function refresh() {
    if (!nodesDS || !edgesDS) return;
    nodesDS.clear();
    nodesDS.add(toNodes());
    edgesDS.clear();
    edgesDS.add(toEdges());
    updateEmptyState();
    if (network) network.unselectAll();
  }

  function updateEmptyState() {
    if (store.persons.length === 0) {
      el.empty.classList.remove('hidden');
    } else {
      el.empty.classList.add('hidden');
    }
  }

  /* ---------- 持久化 ---------- */
  function persist() {
    if (!Core.saveLocal(store)) {
      toast('本地保存失败，请检查存储空间');
    }
  }

  function commit() {
    persist();
    refresh();
  }

  /* ---------- 人物编辑 ---------- */
  function openPersonEditor(id) {
    var person = Core.findPerson(store, id);
    if (!person) return;
    editingPersonId = id;
    el.personTitle.textContent = '编辑人物';
    el.personName.value = person.name || '';
    el.personBio.value = person.bio || '';
    el.personDelete.classList.remove('hidden');
    el.personModal.classList.remove('hidden');
  }

  function openPersonCreator() {
    if (store.persons.length === 0) {
      /* 首次创建时直接进入编辑，不额外提示 */
    }
    editingPersonId = null;
    el.personTitle.textContent = '添加人物';
    el.personName.value = '';
    el.personBio.value = '';
    el.personDelete.classList.add('hidden');
    el.personModal.classList.remove('hidden');
    setTimeout(function () { el.personName.focus(); }, 120);
  }

  function closePersonEditor() {
    editingPersonId = null;
    el.personModal.classList.add('hidden');
  }

  function savePerson() {
    var data = {
      name: el.personName.value.trim(),
      bio: el.personBio.value.trim()
    };
    if (editingPersonId) {
      Core.updatePerson(store, editingPersonId, data);
      toast('已保存修改');
    } else {
      Core.addPerson(store, data);
      toast('已添加人物');
    }
    closePersonEditor();
    commit();
  }

  function deletePerson() {
    if (!editingPersonId) return;
    Core.removePerson(store, editingPersonId);
    toast('已删除人物及其关系');
    closePersonEditor();
    commit();
  }

  /* ---------- 关系编辑 ---------- */
  function fillPersonSelect(select, selectedId) {
    select.innerHTML = '';
    store.persons.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = Core.displayName(p);
      if (p.id === selectedId) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function openEdgeCreator() {
    if (store.persons.length < 2) {
      toast('至少需要两个人物才能建立关系');
      return;
    }
    editingEdgeId = null;
    fillPersonSelect(el.edgeFrom, store.persons[0].id);
    fillPersonSelect(el.edgeTo, store.persons[1].id);
    el.edgeLabel.value = '';
    el.edgeModal.classList.remove('hidden');
  }

  function closeEdgeCreator() {
    el.edgeModal.classList.add('hidden');
  }

  function saveEdge() {
    var from = el.edgeFrom.value;
    var to = el.edgeTo.value;
    var label = el.edgeLabel.value.trim();
    if (!label) {
      toast('请填写关系名称，它会显示在连线上');
      return;
    }
    var result = Core.addEdge(store, { from: from, to: to, label: label });
    if (result.error) {
      toast(result.error);
      return;
    }
    toast('已添加关系');
    closeEdgeCreator();
    commit();
  }

  function openEdgeAction(id) {
    var edge = Core.findEdge(store, id);
    if (!edge) return;
    editingEdgeId = id;
    var from = Core.findPerson(store, edge.from);
    var to = Core.findPerson(store, edge.to);
    el.edgeActionInfo.innerHTML =
      '<div>' + escapeHtml(Core.displayName(from)) + ' — ' + escapeHtml(edge.label || '（未命名关系）') + ' — ' + escapeHtml(Core.displayName(to)) + '</div>';
    el.edgeActionModal.classList.remove('hidden');
  }

  function closeEdgeAction() {
    editingEdgeId = null;
    el.edgeActionModal.classList.add('hidden');
  }

  function deleteEdge() {
    if (!editingEdgeId) return;
    Core.removeEdge(store, editingEdgeId);
    toast('已删除关系');
    closeEdgeAction();
    commit();
  }

  /* ---------- 导入导出 ---------- */
  function exportData() {
    var payload = JSON.stringify(store, null, 2);
    var blob = new Blob([payload], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = 'family-tree-' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
    toast('数据已导出');
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var result = Core.validateImport(String(reader.result));
      if (!result.ok) {
        toast('导入失败：' + result.error);
        return;
      }
      store = result.data;
      commit();
      toast('导入成功：' + store.persons.length + ' 人，' + store.edges.length + ' 条关系');
      setTimeout(fitView, 300);
    };
    reader.onerror = function () {
      toast('文件读取失败');
    };
    reader.readAsText(file);
  }

  function fitView() {
    if (network && store.persons.length > 0) {
      network.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
    }
  }

  function relayout() {
    if (!network) return;
    network.setOptions({ physics: { enabled: true, stabilization: { enabled: true, iterations: 400 } } });
    network.stabilize(400);
    toast('已重新布局');
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents() {
    $('btnAddPerson').addEventListener('click', openPersonCreator);
    $('btnAddEdge').addEventListener('click', openEdgeCreator);
    $('btnFit').addEventListener('click', fitView);
    $('btnLayout').addEventListener('click', relayout);
    $('btnExport').addEventListener('click', exportData);
    $('btnImport').addEventListener('click', function () { el.fileInput.click(); });

    el.personSave.addEventListener('click', savePerson);
    el.personCancel.addEventListener('click', closePersonEditor);
    el.personDelete.addEventListener('click', deletePerson);

    el.edgeSave.addEventListener('click', saveEdge);
    el.edgeCancel.addEventListener('click', closeEdgeCreator);

    el.edgeActionDel.addEventListener('click', deleteEdge);
    el.edgeActionCancel.addEventListener('click', closeEdgeAction);

    el.fileInput.addEventListener('change', function (ev) {
      var f = ev.target.files && ev.target.files[0];
      if (f) importData(f);
      el.fileInput.value = '';
    });

    [el.personModal, el.edgeModal, el.edgeActionModal].forEach(function (modal) {
      modal.addEventListener('click', function (ev) {
        if (ev.target === modal) {
          modal.classList.add('hidden');
        }
      });
    });

    window.addEventListener('resize', function () {
      if (network) network.redraw();
    });
  }

  /* ---------- 启动 ---------- */
  function boot() {
    if (store.persons.length === 0 && store.edges.length === 0) {
      /* 首次打开，注入示例数据供参考，用户可自行删除 */
      store = Core.sampleData();
      Core.saveLocal(store);
    }
    initNetwork();
    updateEmptyState();
    bindEvents();
    setTimeout(fitView, 600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
