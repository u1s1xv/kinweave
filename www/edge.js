/* KinWeave - 关系操作模块
 * 职责：关系的增删改查、方向处理、预设标签
 */
(function (global) {
  'use strict';

  var Core = global.FamilyCore;
  var Person = global.PersonManager;

  function findEdge(graph, id) {
    for (var i = 0; i < graph.edges.length; i++) {
      if (graph.edges[i].id === id) return graph.edges[i];
    }
    return null;
  }

  function addEdge(graph, data) {
    if (!data || !Person.findPerson(graph, data.from) || !Person.findPerson(graph, data.to)) {
      return { error: '请选择有效的人物' };
    }
    if (data.from === data.to) {
      return { error: '关系的两端不能是同一个人' };
    }
    var exists = graph.edges.some(function (e) {
      return (e.from === data.from && e.to === data.to) ||
             (e.from === data.to && e.to === data.from);
    });
    if (exists) {
      return { error: '这两个人之间已存在关系' };
    }
    var edge = {
      id: Core.uid('e'),
      from: data.from,
      to: data.to,
      label: typeof data.label === 'string' ? data.label : '',
      directed: !!data.directed
    };
    graph.edges.push(edge);
    return { edge: edge };
  }

  function updateEdge(graph, id, data) {
    var edge = findEdge(graph, id);
    if (!edge) return null;
    if (data && typeof data.label === 'string') edge.label = data.label;
    if (data && typeof data.directed === 'boolean') edge.directed = data.directed;
    return edge;
  }

  function removeEdge(graph, id) {
    var before = graph.edges.length;
    graph.edges = graph.edges.filter(function (e) { return e.id !== id; });
    return graph.edges.length < before;
  }

  global.EdgeManager = {
    findEdge: findEdge,
    addEdge: addEdge,
    updateEdge: updateEdge,
    removeEdge: removeEdge
  };
})(window);
