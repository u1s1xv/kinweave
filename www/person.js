/* KinWeave - 人物操作模块
 * 职责：人物的增删改查
 */
(function (global) {
  'use strict';

  var Core = global.FamilyCore;

  function findPerson(graph, id) {
    for (var i = 0; i < graph.persons.length; i++) {
      if (graph.persons[i].id === id) return graph.persons[i];
    }
    return null;
  }

  function addPerson(graph, data) {
    var gender = (data && Core.GENDERS.indexOf(data.gender) >= 0) ? data.gender : '未设置';
    var person = {
      id: Core.uid('p'),
      name: (data && typeof data.name === 'string') ? data.name : '',
      bio: (data && typeof data.bio === 'string') ? data.bio : '',
      gender: gender
    };
    graph.persons.push(person);
    return person;
  }

  function updatePerson(graph, id, data) {
    var person = findPerson(graph, id);
    if (!person) return null;
    if (data && typeof data.name === 'string') person.name = data.name;
    if (data && typeof data.bio === 'string') person.bio = data.bio;
    if (data && Core.GENDERS.indexOf(data.gender) >= 0) person.gender = data.gender;
    return person;
  }

  function removePerson(graph, id) {
    var before = graph.persons.length;
    graph.persons = graph.persons.filter(function (p) { return p.id !== id; });
    graph.edges = graph.edges.filter(function (e) { return e.from !== id && e.to !== id; });
    if (graph.positions) delete graph.positions[id];
    return graph.persons.length < before;
  }

  function displayName(person) {
    if (!person) return '未命名';
    var n = (person.name || '').trim();
    return n === '' ? '未命名' : n;
  }

  global.PersonManager = {
    findPerson: findPerson,
    addPerson: addPerson,
    updatePerson: updatePerson,
    removePerson: removePerson,
    displayName: displayName
  };
})(window);
