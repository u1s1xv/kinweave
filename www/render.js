/* KinWeave - 图形渲染模块
 * 职责：节点/连线构建、布局切换、位置锁定、画布初始化
 */
(function (global) {
  'use strict';

  var Person = global.PersonManager;
  var Graph = global.GraphManager;

  var network = null;
  var nodesDS = null;
  var edgesDS = null;
  var currentLayout = 'force';
  var locked = false;

  var LAYOUTS = [
    { key: 'force', name: '自动网状', desc: '自动排布，适合查看全局' },
    { key: 'hier-UD', name: '树状（上→下）', desc: '长辈在上，晚辈在下' },
    { key: 'hier-DU', name: '树状（下→上）', desc: '反向层级' },
    { key: 'hier-LR', name: '树状（左→右）', desc: '横向展开' },
    { key: 'hier-RL', name: '树状（右→左）', desc: '横向反向展开' }
  ];

  function genderColor(gender) {
    if (gender === '男') return { background: '#3b82f6', border: '#2563eb' };
    if (gender === '女') return { background: '#ec4899', border: '#db2777' };
    return { background: '#94a3b8', border: '#64748b' };
  }

  function toNodes(graph) {
    var many = graph.persons.length > 30;
    var positions = graph.positions || {};
    return graph.persons.map(function (p) {
      var c = genderColor(p.gender);
      var node = {
        id: p.id,
        label: Person.displayName(p),
        title: p.bio ? '<div style="max-width:240px">' + escapeHtml(p.bio) + '</div>' : '',
        shape: 'dot',
        size: many ? 16 : 22,
        borderWidth: 2.5,
        color: { background: c.background, border: c.border, highlight: { background: '#7dd3fc', border: '#0284c7' } },
        font: { color: '#e2e8f0', size: many ? 12 : 14, face: 'sans-serif' }
      };
      var pos = positions[p.id];
      if (pos && typeof pos.x === 'number') {
        node.x = pos.x;
        node.y = pos.y;
        if (locked) node.fixed = true;
      }
      return node;
    });
  }

  function toEdges(graph) {
    return graph.edges.map(function (e) {
      var isDirected = !!e.directed;
      return {
        id: e.id, from: e.from, to: e.to, label: e.label || '',
        arrows: isDirected ? { to: { enabled: true, scaleFactor: 0.8 } } : { to: { enabled: false } },
        font: { color: '#cbd5e1', size: 12, strokeWidth: 4, strokeColor: '#0f172a', align: 'middle' },
        color: { color: isDirected ? '#60a5fa' : '#64748b', highlight: '#38bdf8', hover: '#38bdf8' },
        width: isDirected ? 2 : 1.6,
        smooth: currentLayout === 'force' ? { type: 'dynamic' } : { type: 'continuous' }
      };
    });
  }

  function networkOptions() {
    var base = {
      autoResize: true,
      interaction: { hover: true, multiselect: false, zoomView: true, dragView: true, tooltipDelay: 250 },
      nodes: { shape: 'dot', size: 22, font: { color: '#e2e8f0', size: 14 } },
      edges: { font: { size: 12, color: '#cbd5e1', strokeWidth: 4, strokeColor: '#0f172a' } }
    };
    if (currentLayout === 'force') {
      base.physics = {
        enabled: !locked,
        stabilization: { enabled: true, iterations: 400, updateInterval: 30 },
        barnesHut: { gravitationalConstant: -6000, centralGravity: 0.28, springLength: 140, springConstant: 0.05, damping: 0.4 }
      };
      base.layout = { improvedLayout: true };
    } else {
      var dir = currentLayout.split('-')[1] || 'UD';
      base.physics = { enabled: false };
      base.layout = {
        hierarchical: { enabled: true, direction: dir, sortMethod: 'directed',
          levelSeparation: 150, nodeSpacing: 140, treeSpacing: 200,
          blockShifting: true, edgeMinimization: true, parentCentralization: true }
      };
    }
    return base;
  }

  function initNetwork(container, store, onClick) {
    var graph = Graph.getCurrent(store);
    nodesDS = new vis.DataSet(toNodes(graph));
    edgesDS = new vis.DataSet(toEdges(graph));
    network = new vis.Network(container, { nodes: nodesDS, edges: edgesDS }, networkOptions());
    network.on('click', onClick);
    network.on('dragEnd', function (params) {
      if (params.nodes && params.nodes.length > 0 && locked) savePositions(store);
    });
  }

  function rebuild(store) {
    if (!network) return;
    var graph = Graph.getCurrent(store);
    nodesDS.clear();
    nodesDS.add(toNodes(graph));
    edgesDS.clear();
    edgesDS.add(toEdges(graph));
    network.setOptions(networkOptions());
    if (graph.persons.length > 0) network.fit({ animation: { duration: 350 } });
  }

  function focusNode(id) {
    if (!network) return;
    network.focus(id, { scale: 1.2, animation: { duration: 500 } });
    network.selectNodes([id]);
  }

  function fitView() {
    if (network) network.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
  }

  function savePositions(store) {
    if (!network) return;
    var graph = Graph.getCurrent(store);
    var positions = network.getPositions();
    var out = {};
    Object.keys(positions).forEach(function (id) { out[id] = { x: positions[id].x, y: positions[id].y }; });
    graph.positions = out;
  }

  /* 布局切换 —— 修复：每次切换彻底清除节点坐标与固定状态，并强制重新稳定化 */
  function applyLayout(store, key) {
    currentLayout = key;
    var graph = Graph.getCurrent(store);
    /* 清除所有旧坐标缓存，防止树状布局的层级坐标污染网状布局 */
    graph.positions = {};
    locked = false;
    /* 清除所有节点的固定状态和坐标 */
    if (nodesDS) {
      nodesDS.get().forEach(function (n) {
        nodesDS.update({ id: n.id, fixed: false, x: undefined, y: undefined });
      });
    }
    if (network) {
      var opts = networkOptions();
      /* 网状布局需要强制启用物理引擎并触发稳定化 */
      if (key === 'force') {
        opts.physics = { enabled: true, stabilization: { enabled: true, iterations: 400 },
          barnesHut: { gravitationalConstant: -6000, centralGravity: 0.28, springLength: 140, springConstant: 0.05, damping: 0.4 } };
      }
      network.setOptions(opts);
      if (key === 'force') {
        /* 强制触发稳定化，让节点从零开始散开 */
        network.stabilize(400);
      }
      setTimeout(function () { network.fit({ animation: { duration: 400 } }); }, 150);
    }
  }

  function toggleLock(store) {
    locked = !locked;
    var graph = Graph.getCurrent(store);
    if (locked) {
      savePositions(store);
      var nodes = nodesDS.get();
      nodes.forEach(function (n) {
        var pos = (graph.positions || {})[n.id];
        if (pos) nodesDS.update({ id: n.id, x: pos.x, y: pos.y, fixed: true });
      });
      network.setOptions({ physics: { enabled: false } });
    } else {
      nodesDS.get().forEach(function (n) { nodesDS.update({ id: n.id, fixed: false }); });
      network.setOptions(networkOptions());
    }
    return locked;
  }

  function isLocked() { return locked; }
  function getCurrentLayout() { return currentLayout; }
  function getLayouts() { return LAYOUTS; }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  global.RenderManager = {
    initNetwork: initNetwork,
    rebuild: rebuild,
    focusNode: focusNode,
    fitView: fitView,
    savePositions: savePositions,
    applyLayout: applyLayout,
    toggleLock: toggleLock,
    isLocked: isLocked,
    getCurrentLayout: getCurrentLayout,
    getLayouts: getLayouts
  };
})(window);
