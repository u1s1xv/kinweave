/* KinWeave - 数据核心模块
 * 职责：数据模型定义、校验、本地存储、示例数据
 */
(function (global) {
  'use strict';

  var STORAGE_KEY_V1 = 'family-tree-data-v1';
  var STORAGE_KEY_V2 = 'family-tree-data-v2';
  var STORAGE_KEY = 'kinweave-data-v3';

  var GENDERS = ['未设置', '男', '女'];

  var RELATION_PRESETS = [
    { label: '父子', directed: true },
    { label: '母子', directed: true },
    { label: '父女', directed: true },
    { label: '母女', directed: true },
    { label: '祖孙', directed: true },
    { label: '叔侄', directed: true },
    { label: '舅甥', directed: true },
    { label: '夫妻', directed: false },
    { label: '兄弟', directed: false },
    { label: '姐妹', directed: false },
    { label: '兄妹', directed: false },
    { label: '姐弟', directed: false },
    { label: '堂亲', directed: false },
    { label: '表亲', directed: false },
    { label: '朋友', directed: false },
    { label: '同事', directed: false }
  ];

  var DIRECTED_KEYWORDS = ['父', '母', '祖', '叔', '舅', '师', '上', '下'];

  function guessDirected(label) {
    if (!label) return false;
    for (var i = 0; i < DIRECTED_KEYWORDS.length; i++) {
      if (label.indexOf(DIRECTED_KEYWORDS[i]) >= 0) return true;
    }
    return false;
  }

  function uid(prefix) {
    var rand = Math.random().toString(36).slice(2, 8);
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + rand;
  }

  function createGraph(name) {
    return { id: uid('g'), name: name || '未命名关系图', positions: {}, persons: [], edges: [] };
  }

  function createStore() {
    var g = createGraph('我的家谱');
    return { version: 3, currentGraphId: g.id, graphs: [g] };
  }

  function normalizePerson(p, seen) {
    if (!p || typeof p !== 'object') return null;
    var id = (typeof p.id === 'string' && p.id) ? p.id : uid('p');
    if (seen[id]) return null;
    seen[id] = true;
    var gender = (typeof p.gender === 'string' && GENDERS.indexOf(p.gender) >= 0) ? p.gender : '未设置';
    return { id: id, name: typeof p.name === 'string' ? p.name : '', bio: typeof p.bio === 'string' ? p.bio : '', gender: gender };
  }

  function normalizeGraph(raw, fallbackName) {
    var g = createGraph(fallbackName);
    if (!raw || typeof raw !== 'object') return g;
    if (typeof raw.id === 'string' && raw.id) g.id = raw.id;
    if (typeof raw.name === 'string' && raw.name.trim()) g.name = raw.name.trim();
    else if (fallbackName) g.name = fallbackName;
    var seenPersonIds = {};
    (Array.isArray(raw.persons) ? raw.persons : []).forEach(function (p) {
      var person = normalizePerson(p, seenPersonIds);
      if (person) g.persons.push(person);
    });
    var seenEdgeIds = {};
    (Array.isArray(raw.edges) ? raw.edges : []).forEach(function (e) {
      if (!e || typeof e !== 'object') return;
      if (!seenPersonIds[e.from] || !seenPersonIds[e.to]) return;
      if (e.from === e.to) return;
      var id = (typeof e.id === 'string' && e.id) ? e.id : uid('e');
      if (seenEdgeIds[id]) return;
      seenEdgeIds[id] = true;
      var label = typeof e.label === 'string' ? e.label : '';
      var directed = typeof e.directed === 'boolean' ? e.directed : guessDirected(label);
      g.edges.push({ id: id, from: e.from, to: e.to, label: label, directed: directed });
    });
    if (raw.positions && typeof raw.positions === 'object') {
      Object.keys(raw.positions).forEach(function (pid) {
        if (!seenPersonIds[pid]) return;
        var pos = raw.positions[pid];
        if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') g.positions[pid] = { x: pos.x, y: pos.y };
      });
    }
    return g;
  }

  function normalize(input) {
    if (!input || typeof input !== 'object') return createStore();
    if (Array.isArray(input.graphs)) {
      var list = [];
      input.graphs.forEach(function (raw, i) { list.push(normalizeGraph(raw, '关系图 ' + (i + 1))); });
      if (list.length === 0) return createStore();
      var found = list.some(function (g) { return g.id === input.currentGraphId; });
      return { version: 3, currentGraphId: found ? input.currentGraphId : list[0].id, graphs: list };
    }
    if (Array.isArray(input.persons) || Array.isArray(input.edges)) {
      var g = normalizeGraph(input, '我的家谱');
      return { version: 3, currentGraphId: g.id, graphs: [g] };
    }
    return createStore();
  }

  function validateImport(text) {
    var parsed;
    try { parsed = JSON.parse(text); } catch (err) { return { ok: false, error: '文件内容不是合法的 JSON 格式' }; }
    if (!parsed || typeof parsed !== 'object') return { ok: false, error: '文件内容不是有效的数据对象' };
    var isFlat = Array.isArray(parsed.persons) || Array.isArray(parsed.edges);
    var isMulti = Array.isArray(parsed.graphs);
    if (!isFlat && !isMulti) return { ok: false, error: '数据中缺少人物或关系列表' };
    return { ok: true, data: normalize(parsed) };
  }

  function loadLocal() {
    try { var raw = global.localStorage.getItem(STORAGE_KEY); if (raw) return normalize(JSON.parse(raw)); } catch (err) {}
    try { var rawV2 = global.localStorage.getItem(STORAGE_KEY_V2); if (rawV2) { var m2 = normalize(JSON.parse(rawV2)); saveLocal(m2); return m2; } } catch (err) {}
    try { var rawV1 = global.localStorage.getItem(STORAGE_KEY_V1); if (rawV1) { var m1 = normalize(JSON.parse(rawV1)); saveLocal(m1); return m1; } } catch (err) {}
    return null;
  }

  function saveLocal(store) {
    try { global.localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); return true; } catch (err) { return false; }
  }

  function sampleData() {
    var store = createStore();
    var graph = store.graphs[0];
    graph.name = '我的家谱';
    var p = function (name, bio, gender) {
      var person = { id: uid('p'), name: name, bio: bio || '', gender: gender || '未设置' };
      graph.persons.push(person);
      return person;
    };
    var link = function (a, b, label, directed) {
      graph.edges.push({ id: uid('e'), from: a.id, to: b.id, label: label, directed: !!directed });
    };
    var grandpa = p('张伯远', '1938 年生，家族中的长者', '男');
    var grandma = p('李慧兰', '1942 年生', '女');
    var father  = p('张承志', '1965 年生，长子', '男');
    var uncle   = p('张承业', '1968 年生，次子', '男');
    var aunt    = p('王秀英', '1970 年生', '女');
    var me      = p('张一鸣', '', '男');
    var cousin  = p('张一诺', '堂兄妹', '女');
    link(grandpa, grandma, '夫妻', false);
    link(grandpa, father, '父子', true);
    link(grandpa, uncle, '父子', true);
    link(uncle, aunt, '夫妻', false);
    link(father, me, '父子', true);
    link(uncle, cousin, '父女', true);
    link(me, cousin, '堂亲', false);
    return store;
  }

  global.FamilyCore = {
    STORAGE_KEY: STORAGE_KEY, STORAGE_KEY_V1: STORAGE_KEY_V1, STORAGE_KEY_V2: STORAGE_KEY_V2,
    GENDERS: GENDERS, RELATION_PRESETS: RELATION_PRESETS, guessDirected: guessDirected,
    uid: uid, createStore: createStore, createGraph: createGraph,
    normalize: normalize, validateImport: validateImport,
    loadLocal: loadLocal, saveLocal: saveLocal, sampleData: sampleData
  };
})(window);
