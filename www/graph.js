/* KinWeave - 关系图管理模块
 * 职责：关系图的增删改查、切换、复制
 */
(function (global) {
  'use strict';

  var Core = global.FamilyCore;

  function getCurrent(store) {
    for (var i = 0; i < store.graphs.length; i++) {
      if (store.graphs[i].id === store.currentGraphId) return store.graphs[i];
    }
    if (store.graphs.length > 0) {
      store.currentGraphId = store.graphs[0].id;
      return store.graphs[0];
    }
    var g = Core.createGraph('我的家谱');
    store.graphs.push(g);
    store.currentGraphId = g.id;
    return g;
  }

  function findGraph(store, id) {
    for (var i = 0; i < store.graphs.length; i++) {
      if (store.graphs[i].id === id) return store.graphs[i];
    }
    return null;
  }

  function addGraph(store, name) {
    var g = Core.createGraph(name || '关系图 ' + (store.graphs.length + 1));
    store.graphs.push(g);
    store.currentGraphId = g.id;
    return g;
  }

  function renameGraph(store, id, name) {
    var g = findGraph(store, id);
    if (!g) return null;
    var trimmed = (name || '').trim();
    if (trimmed) g.name = trimmed;
    return g;
  }

  function duplicateGraph(store, id) {
    var src = findGraph(store, id);
    if (!src) return null;
    var copy = { id: Core.uid('g'), name: src.name + ' 副本', positions: {}, persons: [], edges: [] };
    var map = {};
    src.persons.forEach(function (p) {
      var np = { id: Core.uid('p'), name: p.name, bio: p.bio, gender: p.gender };
      map[p.id] = np.id;
      copy.persons.push(np);
    });
    src.edges.forEach(function (e) {
      copy.edges.push({ id: Core.uid('e'), from: map[e.from], to: map[e.to], label: e.label, directed: !!e.directed });
    });
    store.graphs.push(copy);
    store.currentGraphId = copy.id;
    return copy;
  }

  function removeGraph(store, id) {
    if (store.graphs.length <= 1) return false;
    var before = store.graphs.length;
    store.graphs = store.graphs.filter(function (g) { return g.id !== id; });
    if (store.graphs.length === before) return false;
    var stillThere = store.graphs.some(function (g) { return g.id === store.currentGraphId; });
    if (!stillThere) store.currentGraphId = store.graphs[0].id;
    return true;
  }

  global.GraphManager = {
    getCurrent: getCurrent,
    findGraph: findGraph,
    addGraph: addGraph,
    renameGraph: renameGraph,
    duplicateGraph: duplicateGraph,
    removeGraph: removeGraph
  };
})(window);
