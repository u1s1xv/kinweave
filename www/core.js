/* 家谱关系图 - 数据核心模块
 * 数据模型：
 *   person = { id, name, bio }
 *   edge   = { id, from, to, label }
 */

(function (global) {
  'use strict';

  var STORAGE_KEY = 'family-tree-data-v1';

  function uid(prefix) {
    var rand = Math.random().toString(36).slice(2, 8);
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + rand;
  }

  function createStore() {
    return {
      version: 1,
      persons: [],
      edges: []
    };
  }

  /* ---------- 校验与规范化 ---------- */

  function normalize(input) {
    var store = createStore();
    if (!input || typeof input !== 'object') return store;

    var rawPersons = Array.isArray(input.persons) ? input.persons : [];
    var seenPersonIds = {};

    rawPersons.forEach(function (p) {
      if (!p || typeof p !== 'object') return;
      var id = (typeof p.id === 'string' && p.id) ? p.id : uid('p');
      if (seenPersonIds[id]) return;
      seenPersonIds[id] = true;
      store.persons.push({
        id: id,
        name: typeof p.name === 'string' ? p.name : '',
        bio: typeof p.bio === 'string' ? p.bio : ''
      });
    });

    var rawEdges = Array.isArray(input.edges) ? input.edges : [];
    var seenEdgeIds = {};

    rawEdges.forEach(function (e) {
      if (!e || typeof e !== 'object') return;
      var from = e.from;
      var to = e.to;
      if (!seenPersonIds[from] || !seenPersonIds[to]) return;
      if (from === to) return;
      var id = (typeof e.id === 'string' && e.id) ? e.id : uid('e');
      if (seenEdgeIds[id]) return;
      seenEdgeIds[id] = true;
      store.edges.push({
        id: id,
        from: from,
        to: to,
        label: typeof e.label === 'string' ? e.label : ''
      });
    });

    return store;
  }

  function validateImport(text) {
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return { ok: false, error: '文件内容不是合法的 JSON 格式' };
    }
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: '文件内容不是有效的数据对象' };
    }
    if (!Array.isArray(parsed.persons) && !Array.isArray(parsed.edges)) {
      return { ok: false, error: '数据中缺少人物或关系列表' };
    }
    var store = normalize(parsed);
    return { ok: true, data: store };
  }

  /* ---------- 业务操作 ---------- */

  function addPerson(store, data) {
    var person = {
      id: uid('p'),
      name: (data && typeof data.name === 'string') ? data.name : '',
      bio: (data && typeof data.bio === 'string') ? data.bio : ''
    };
    store.persons.push(person);
    return person;
  }

  function updatePerson(store, id, data) {
    var person = findPerson(store, id);
    if (!person) return null;
    if (data && typeof data.name === 'string') person.name = data.name;
    if (data && typeof data.bio === 'string') person.bio = data.bio;
    return person;
  }

  function findPerson(store, id) {
    for (var i = 0; i < store.persons.length; i++) {
      if (store.persons[i].id === id) return store.persons[i];
    }
    return null;
  }

  function removePerson(store, id) {
    var before = store.persons.length;
    store.persons = store.persons.filter(function (p) { return p.id !== id; });
    store.edges = store.edges.filter(function (e) {
      return e.from !== id && e.to !== id;
    });
    return store.persons.length < before;
  }

  function addEdge(store, data) {
    if (!data || !findPerson(store, data.from) || !findPerson(store, data.to)) {
      return { error: '请选择有效的人物' };
    }
    if (data.from === data.to) {
      return { error: '关系的两端不能是同一个人' };
    }
    var exists = store.edges.some(function (e) {
      return (e.from === data.from && e.to === data.to) ||
             (e.from === data.to && e.to === data.from);
    });
    if (exists) {
      return { error: '这两个人之间已存在关系' };
    }
    var edge = {
      id: uid('e'),
      from: data.from,
      to: data.to,
      label: typeof data.label === 'string' ? data.label : ''
    };
    store.edges.push(edge);
    return { edge: edge };
  }

  function updateEdge(store, id, data) {
    var edge = findEdge(store, id);
    if (!edge) return null;
    if (data && typeof data.label === 'string') edge.label = data.label;
    return edge;
  }

  function findEdge(store, id) {
    for (var i = 0; i < store.edges.length; i++) {
      if (store.edges[i].id === id) return store.edges[i];
    }
    return null;
  }

  function removeEdge(store, id) {
    var before = store.edges.length;
    store.edges = store.edges.filter(function (e) { return e.id !== id; });
    return store.edges.length < before;
  }

  function displayName(person) {
    if (!person) return '未命名';
    var n = (person.name || '').trim();
    return n === '' ? '未命名' : n;
  }

  /* ---------- 本地存储 ---------- */

  function loadLocal() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return normalize(parsed);
    } catch (err) {
      return null;
    }
  }

  function saveLocal(store) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      return true;
    } catch (err) {
      return false;
    }
  }

  /* ---------- 示例数据 ---------- */

  function sampleData() {
    var base = createStore();
    var p = function (name, bio) {
      var person = { id: uid('p'), name: name, bio: bio || '' };
      base.persons.push(person);
      return person;
    };
    var link = function (a, b, label) {
      base.edges.push({ id: uid('e'), from: a.id, to: b.id, label: label });
    };

    var grandpa = p('张伯远', '1938 年生，家族中的长者');
    var grandma = p('李慧兰', '1942 年生');
    var father  = p('张承志', '1965 年生，长子');
    var uncle   = p('张承业', '1968 年生，次子');
    var aunt    = p('王秀英', '1970 年生');
    var me      = p('张一鸣', '');
    var cousin  = p('张一诺', '堂兄妹');

    link(grandpa, grandma, '夫妻');
    link(grandpa, father, '父子');
    link(grandpa, uncle, '父子');
    link(uncle, aunt, '夫妻');
    link(father, me, '父子');
    link(uncle, cousin, '父女');
    link(me, cousin, '堂亲');

    return base;
  }

  global.FamilyCore = {
    STORAGE_KEY: STORAGE_KEY,
    uid: uid,
    createStore: createStore,
    normalize: normalize,
    validateImport: validateImport,
    addPerson: addPerson,
    updatePerson: updatePerson,
    findPerson: findPerson,
    removePerson: removePerson,
    addEdge: addEdge,
    updateEdge: updateEdge,
    findEdge: findEdge,
    removeEdge: removeEdge,
    displayName: displayName,
    loadLocal: loadLocal,
    saveLocal: saveLocal,
    sampleData: sampleData
  };
})(window);
