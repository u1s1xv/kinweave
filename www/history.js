/* KinWeave - 撤销/重做模块
 * 职责：操作历史记录管理，支持撤销与重做
 */
(function (global) {
  'use strict';

  var Core = global.FamilyCore;
  var HISTORY_LIMIT = 40;
  var history = [];
  var historyIndex = -1;

  function snapshot(store) { return JSON.stringify(store); }

  function reset(store) {
    history = [snapshot(store)];
    historyIndex = 0;
  }

  function push(store) {
    var snap = snapshot(store);
    if (historyIndex >= 0 && history[historyIndex] === snap) return;
    history = history.slice(0, historyIndex + 1);
    history.push(snap);
    if (history.length > HISTORY_LIMIT) history.shift();
    historyIndex = history.length - 1;
  }

  function canUndo() { return historyIndex > 0; }
  function canRedo() { return historyIndex < history.length - 1; }

  function undo(store) {
    if (!canUndo()) return null;
    historyIndex--;
    return Core.normalize(JSON.parse(history[historyIndex]));
  }

  function redo(store) {
    if (!canRedo()) return null;
    historyIndex++;
    return Core.normalize(JSON.parse(history[historyIndex]));
  }

  global.HistoryManager = {
    reset: reset,
    push: push,
    canUndo: canUndo,
    canRedo: canRedo,
    undo: undo,
    redo: redo
  };
})(window);
