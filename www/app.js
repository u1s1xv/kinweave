/* KinWeave - 应用启动入口
 * 职责：按依赖顺序加载模块，启动应用
 *
 * 模块依赖关系：
 *   core.js → graph.js / person.js / edge.js / history.js → render.js → ui.js → app.js
 */
(function () {
  'use strict';

  /* 所有业务逻辑已拆分至各模块，app.js 仅作为启动入口 */
  /* 模块加载顺序由 index.html 中的 <script> 标签顺序保证 */

  /* 启动逻辑在 ui.js 的 boot() 中，由 DOMContentLoaded 自动触发 */
})();
