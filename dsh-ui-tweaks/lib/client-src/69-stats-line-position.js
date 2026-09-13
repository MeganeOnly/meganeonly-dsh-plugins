    // ===== stats-line-position =====
    // v0.10.0 统计行位置 tweak——对话底部那行运行统计（轮次 / 步数 / LLM 耗时 / 工具耗时 /
    // 首 token / 吞吐 / 缓存命中 / 输入输出 token）的位置三选一：
    //   bottom（默认）：DSH 原样，本控制器不启动
    //   top：底部整条隐藏，顶部标题行右侧渲染镜像元素（周期性从原生行克隆）
    //   hidden：底部整条隐藏，不渲染镜像
    //
    // v0.10.1 关键：隐藏用 `visibility:hidden` 而非 `display:none`——统计行是 composer
    // 卡片的 footer，composer seat 是 sticky bottom；display:none 卡片变矮 → 输入行整体
    // 下移。visibility 保留盒子（照常参与布局、照常被 React 更新文本），高度分毫不差保留。
    //
    // 关键约束：镜像不搬 DSH 原生节点。原生节点留在原位（不可见——React 照常更新文本），
    // 镜像是本插件 createElement 的额外子节点，React 不认识——避免 React 卸载原生节点时
    // 对记录的原父节点调 removeChild → NotFoundError 崩树。StatsLine 在 groups 为空时
    // return null，新会话开局必然触发这条路径。
    //
    // 锚点全部走 DSH renderer 的 slot 出口属性 `[data-slot="<slot key>"]`（不含 hash，
    // 跨版本稳定；与 v0.7.3 HoverCard `[class*="_hoverContent"]` 同源的 hash-independence
    // 策略）。`display:contents` 是 inline style，所有针对出口层的规则一律带 !important。
    //
    // 隐藏粒度：整个 `conversation.composer.dock` 出口——DSH slot 目录登记的唯一占位者
    // 是 StatsLine，隐藏出口 == 隐藏统计行。代价：若将来第三方插件也往 composer.dock
    // 注册条目，top/hidden 时会连带隐藏（已在 tweak description 注明）。
    //
    // v0.10.11 顶部镜像两点修复：
    //   (1) 两个 pill 之间补 12px gap——镜像 CSS 加 `display:inline-flex; gap:12px`，恢复
    //       原生 `.bOPqQW_root` 的视觉间距（cloneNode 只搬 source 子节点，root 的
    //       `gap:12px` 留在了底部隐藏节点上，需镜像自己再声明一次）。
    //   (2) 详情对话框跟顶部镜像按钮走——DSH `useAnchoredPosition` 把 dialog 锚定到底部
    //       隐藏 button 的 `.anchor` span，从顶部点开却弹在底部。重写 React 组件超出
    //       触及范围，后置拦截：点击镜像 button 时记下它的 rect 闭包 → body
    //       MutationObserver 检测 `[role="dialog"]` 出现 → `setProperty('left/top',
    //       ..., 'important')` 强制改到镜像 button 下方（PANEL_GAP=8、viewport
    //       margin=12 与 DSH useAnchoredPosition 对齐）。dialog 属性 observer（应对 React
    //       重渲染覆盖）+ window scroll 监听（dialog 跟随滚动到镜像 button），用
    //       `dialog.isConnected` 自动 disconnect。inline `!important` 优先级胜过 React
    //       普通 `style.left = X`，scroll 跟随靠 `getRect()` 闭包重取最新位置。

    /** 把任意持久化值归一到三个合法位置之一（脏数据 / 老版本布尔值都退回 bottom）。 */
    function statsNormalizePosition(value) {
      if (value === STATS_POS_TOP) return STATS_POS_TOP;
      if (value === STATS_POS_HIDDEN) return STATS_POS_HIDDEN;
      return STATS_POS_BOTTOM;
    }

    /**
     * 找 DSH 原生统计行的根元素（StatsLine 的 `<div className={...root}>`）。
     *
     * 策略：先用稳定锚点 `[data-slot="conversation.composer.dock"]` 圈定范围，
     *   再在其中取**最内层**的 `[class*="_root"]`——DSH 用 Tooltip 包裹
     *   StatsLine，若 Tooltip 将来也带 `_root` 类名，最内层那个才是统计行
     *   自身。全都没命中时退回出口的第一个元素子节点。
     */
    function statsFindSource() {
      if (typeof document === "undefined") return null;
      var dock = document.querySelector(STATS_DOCK_SEL);
      if (!dock) return null;
      var list = dock.querySelectorAll(STATS_ROOT_HINT_SEL);
      for (var i = list.length - 1; i >= 0; i--) {
        if (list[i].querySelector(STATS_ROOT_HINT_SEL) === null) return list[i];
      }
      return dock.firstElementChild;
    }

    /**
     * 找顶部标题簇容器——也就是"对话名 + 模式"横向排布的那个 flex 容器
     *   （DSH ConversationRoot 的 titleCluster：children = [面包屑 nav,
     *   headerActions]）。镜像 append 到它末尾即落在模式标签右边。
     *
     * 主路径：`[data-slot="conversation.session.header.actions"]` 出口
     *   → 父（headerActions 包装 div）→ 父（titleCluster）。全程无 hash。
     * 兜底：`[class*="_titleCluster"]` 子串匹配（与 v0.7.3 HoverCard /
     *   v0.9.14 sidebar 同策略的 hash-independence 写法）。
     */
    function statsFindTitleCluster() {
      if (typeof document === "undefined") return null;
      var actions = document.querySelector(STATS_HEADER_ACTIONS_SEL);
      if (actions && actions.parentElement && actions.parentElement.parentElement) {
        return actions.parentElement.parentElement;
      }
      return document.querySelector(STATS_TITLE_CLUSTER_HINT_SEL);
    }

    /** 清掉页面上所有本插件的统计行镜像（切位置 / 停用 / header 被重建时）。 */
    function statsRemoveMirror() {
      if (typeof document === "undefined") return;
      var nodes = document.querySelectorAll("[" + STATS_MIRROR_ATTR + "]");
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
      }
    }

    /**
     * 确保标题簇末尾有一个镜像元素。幂等——已有则直接返回。
     *   当前标题簇里没有时，先把别处残留的孤儿镜像清掉（DSH 换会话重建
     *   header 的场景），再新建，保证全页面只存在一个镜像。
     */
    function statsEnsureMirror() {
      if (typeof document === "undefined") return null;
      var cluster = statsFindTitleCluster();
      if (!cluster) return null;
      var existing = cluster.querySelector("[" + STATS_MIRROR_ATTR + "]");
      if (existing) return existing;
      statsRemoveMirror();
      var mirror = document.createElement("div");
      mirror.setAttribute(STATS_MIRROR_ATTR, "");
      cluster.appendChild(mirror);
      return mirror;
    }

    /**
     * 把原生统计行的内容克隆进镜像。
     *   - 用 `cloneNode(true)` 后逐个搬运子节点，而不是直接塞克隆根——
     *     克隆根带着 DSH 的 `_root` 类（`text-align:center` / `width:100%` /
     *     `max-width:var(--dsh-chat-content-width)` / 底部专用 padding），
     *     放进标题行会撑破布局；只搬子节点则保留分隔符 `<span class="..._sep">`
     *     的类名，DSH 自己的 `.._sep{color:...;margin:0 10px}` 继续生效，
     *     视觉与底部原生行一致。
     *   - 文本没变就整段跳过，避免每 400ms 无谓重建 DOM（也顺带避免
     *     镜像自身的 mutation 触发别的观察者）。用 `title` 同时兼作
     *     "上次内容"缓存与鼠标悬停时的完整内容 tooltip（标题行窄，
     *     镜像会 ellipsis 截断）。
     *   - v0.10.10：DSH StatsPills 把两个 pill（TimePill + UsagePill）渲染成
     *     `<button aria-haspopup="dialog">`，点击调 React useState 切换 openPill，
     *     把详情对话框 portal 到 body（`useAnchoredPosition` 锚定到原 button 的
     *     `.anchor` span）。`cloneNode(true)` 不复制 React listener——克隆 button
     *     是哑的：图标 + 文本能显示，但点不出详情对话框，"相关信息"出不来。
     *     修法：遍历克隆出来的所有 button，按索引挂 click 转发器——点击镜像 button
     *     → 在 dock 里**实时查**对应索引的原生 button 调 `.click()`，触发 React
     *     onClick → openPill 切换 → dialog render。索引在闭包里，实时查询避免
     *     DSH 重渲染后闭包引用的 button 节点已卸。cloneNode 不复制 listener 也不
     *     复制 React fiber，所以镜像 button 不在 React 树里——`stopPropagation` 是
     *     防自己挂的 listener 之间互相冒泡，不是防 React；`preventDefault` 防镜像
     *     button 在某些 form / document 默认行为下意外触发。
     *   - v0.10.11：详情 dialog 之前锚定到底部隐藏 button（DSH useAnchoredPosition +
     *     React state 都在底部 StatsPills 组件上），从顶部镜像点开却弹在底部。重写
     *     React 组件超出触及范围，后置拦截：click 转发器在转发前记下镜像 button 的
     *     rect 闭包（statsPendingMirrorAnchor），body MutationObserver 检测
     *     `[role="dialog"]` 添加后用 `!important` 把 left/top 改到镜像 button 下方
     *     （PANEL_GAP=8、viewport margin=12 与 DSH useAnchoredPosition 对齐）。dialog
     *     属性 observer + window scroll 监听持续重定位，dialog 跟随滚动到镜像 button。
     *     详见下面 `// ===== v0.10.11 顶部镜像对话框位置拦截 =====` 段。
     */
    function statsSyncMirror(mirror, source) {
      var text = source === null ? "" : (source.textContent || "");
      var liveButtons = source === null ? [] : source.querySelectorAll("button");
      // 文本没变 + button 数量没变 → 跳过重建（克隆 button 上的转发 listener 也保留）
      if (mirror.title === text && mirror.childElementCount === liveButtons.length) return;
      mirror.title = text;
      while (mirror.firstChild) mirror.removeChild(mirror.firstChild);
      if (text === "" || source === null) return;
      var clone = source.cloneNode(true);
      var clonedButtons = clone.querySelectorAll("button");
      // 给每个克隆 button 挂 click 转发器：index 闭包，click 时实时查 dock
      for (var j = 0; j < clonedButtons.length; j++) (function (idx) {
        clonedButtons[idx].addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          // v0.10.11：记下镜像 button 的 rect 闭包——dialog 通过 portal 渲染在 body 后
          // 由 body MutationObserver 触发 statsApplyDialogPosition，把它从底部隐藏
          // button 位置改到本镜像 button 下方。闭包持 btn 引用，watcher 每次重取
          // getBoundingClientRect()，dialog 跟随滚动到镜像 button 当前位置。
          var btn = e.currentTarget;
          statsPendingMirrorAnchor = {
            getRect: function () { return btn.getBoundingClientRect(); }
          };
          statsEnsureDialogObserver();
          var dock = document.querySelector(STATS_DOCK_SEL);
          if (!dock) return;
          var live = dock.querySelectorAll("button");
          if (idx < live.length) live[idx].click();
        });
      })(j);
      while (clone.firstChild) mirror.appendChild(clone.firstChild);
    }

    // ===== v0.10.11 顶部镜像对话框位置拦截 =====

    // 点击镜像 button 时设上，body observer 检测到 dialog 后清空。null = 没有等待中的镜像点击。
    var statsPendingMirrorAnchor = null;
    // body 级 MutationObserver（单例，懒初始化）。检测 [role="dialog"] 添加 → 触发定位。
    var statsDialogObserver = null;
    // 当前活跃 dialog 的属性 observer（应对 React 重渲染覆盖 left/top）。
    // dialog 用 WeakMap 关联 scroll listener 闭包；dialog 被移除时由 isConnected 检查自动清理。
    var statsDialogWatchers = null;
    // 与 DSH useAnchoredPosition 对齐的常量——PANEL_GAP = 触发器到 panel 的距离，
    // PANEL_MARGIN = 视口边缘最小留白。同步这些常量才能让"对话框紧贴镜像 button 下方"与
    // 底部原生行为视觉一致。
    var STATS_PANEL_GAP = 8;
    var STATS_PANEL_MARGIN = 12;

    /**
     * 把 dialog 定位到 anchorRect 下方（顶部镜像专用）。
     *   - left = anchorRect.left（与镜像 button 左对齐）
     *   - top = anchorRect.bottom + PANEL_GAP
     *   - 视口 clamp：左右留 PANEL_MARGIN；超 viewport 时把 dialog 往反方向推
     * 用 setProperty('left/top', ..., 'important')：inline !important 优先级胜过 React 的
     * 普通 style.left = X（useAnchoredPosition 重渲染会持续覆盖，靠 !important 兜住）。
     */
    function statsApplyDialogPosition(dialog, anchorRect) {
      if (dialog === null || anchorRect === null || anchorRect === undefined) return;
      if (typeof dialog.getBoundingClientRect !== "function") return;
      var dlgRect = dialog.getBoundingClientRect();
      var dlgW = dlgRect.width > 0 ? dlgRect.width : 300;
      var dlgH = dlgRect.height > 0 ? dlgRect.height : 200;
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var left = anchorRect.left;
      var top = anchorRect.bottom + STATS_PANEL_GAP;
      // 水平 clamp
      if (left + dlgW > vw - STATS_PANEL_MARGIN) {
        left = vw - STATS_PANEL_MARGIN - dlgW;
      }
      if (left < STATS_PANEL_MARGIN) left = STATS_PANEL_MARGIN;
      // 垂直 clamp（dialog 比可用高度还高时把 top 推到 PANEL_MARGIN）
      if (top + dlgH > vh - STATS_PANEL_MARGIN) {
        top = vh - STATS_PANEL_MARGIN - dlgH;
      }
      if (top < STATS_PANEL_MARGIN) top = STATS_PANEL_MARGIN;
      dialog.style.setProperty('left', left + 'px', 'important');
      dialog.style.setProperty('top', top + 'px', 'important');
    }

    /**
     * 给 dialog 挂属性 observer + window scroll 监听，保持位置跟 anchor。
     *   - 属性 observer（style attribute 变化）：DSH useAnchoredPosition 在 resize / scroll
     *     时通过 React state 重设 panel 的 left/top，我们每次 React 改 style 后立即重写
     *     我们的 !important 版本。
     *   - window scroll 监听：getRect() 重取镜像 button 最新 viewport rect，dialog
     *     跟着滚动（position:fixed 是 viewport-relative，button 在页面里移动后 dialog 要
     *     跟着偏移才能保持"按钮下方"）。
     *   - dialog 离开 DOM（用户点外部 / Esc 关闭）时 dialog.isConnected 变 false，自动
     *     disconnect + removeEventListener，避免泄漏。
     */
    function statsWatchDialogPosition(dialog, getRect) {
      if (typeof MutationObserver === "undefined") return;
      if (statsDialogWatchers === null) statsDialogWatchers = new WeakMap();
      // 同一个 dialog 重复挂时先清旧的（极少见，但防御性写）
      var prev = statsDialogWatchers.get(dialog);
      if (prev !== undefined) {
        if (prev.attrObs !== null) prev.attrObs.disconnect();
        if (typeof window !== "undefined" && window.removeEventListener) {
          window.removeEventListener("scroll", prev.onScroll, true);
        }
      }
      var attrObs = new MutationObserver(function () {
        if (!dialog.isConnected) {
          attrObs.disconnect();
          return;
        }
        var rect = getRect();
        if (rect !== null && rect !== undefined) statsApplyDialogPosition(dialog, rect);
      });
      attrObs.observe(dialog, { attributes: true, attributeFilter: ["style"] });
      var onScroll = function () {
        if (!dialog.isConnected) {
          attrObs.disconnect();
          if (typeof window !== "undefined" && window.removeEventListener) {
            window.removeEventListener("scroll", onScroll, true);
          }
          return;
        }
        var rect = getRect();
        if (rect !== null && rect !== undefined) statsApplyDialogPosition(dialog, rect);
      };
      if (typeof window !== "undefined" && window.addEventListener) {
        window.addEventListener("scroll", onScroll, true);  // capture：监听嵌套滚动容器
      }
      statsDialogWatchers.set(dialog, { attrObs: attrObs, onScroll: onScroll });
    }

    /**
     * body MutationObserver 回调：检测 [role="dialog"] 添加。
     * 仅当 statsPendingMirrorAnchor 设上（即刚刚从顶部镜像点击转发）才接管；
     * DSH 其它对话框（侧栏 hover 等）也用 role="dialog"，没 pending 时一概不管。
     */
    function statsOnBodyMutation(records) {
      if (statsPendingMirrorAnchor === null) return;
      var pending = statsPendingMirrorAnchor;
      for (var i = 0; i < records.length; i++) {
        var rec = records[i];
        if (rec.addedNodes === undefined) continue;
        for (var j = 0; j < rec.addedNodes.length; j++) {
          var node = rec.addedNodes[j];
          if (node === null || node.nodeType !== 1) continue;
          var dialog = null;
          if (node.getAttribute && node.getAttribute("role") === "dialog") {
            dialog = node;
          } else if (node.querySelector) {
            dialog = node.querySelector('[role="dialog"]');
          }
          if (dialog !== null) {
            var rect = pending.getRect();
            if (rect !== null && rect !== undefined) statsApplyDialogPosition(dialog, rect);
            statsWatchDialogPosition(dialog, pending.getRect);
            // 单次消费——避免之后 dialog 被关闭再重开时还误接管
            statsPendingMirrorAnchor = null;
            return;
          }
        }
      }
    }

    /**
     * 懒初始化 body MutationObserver。点击镜像 button 时调一次；
     * 重复调幂等。observer 跨 controller start/stop 保留（全局单例），省去重复注册。
     */
    function statsEnsureDialogObserver() {
      if (typeof document === "undefined") return;
      if (typeof MutationObserver === "undefined") return;
      if (statsDialogObserver !== null) return;
      statsDialogObserver = new MutationObserver(statsOnBodyMutation);
      statsDialogObserver.observe(document.body, { childList: true, subtree: false });
    }

    /**
     * 清空 pending 状态。controller stop() 时调——切到 bottom/hidden 后镜像已移除，
     * 不应再让 observer 接管后续 dialog。
     */
    function statsClearPendingAnchor() {
      statsPendingMirrorAnchor = null;
    }

    /**
     * v0.10.0：统计行位置 controller。
     *
     * 只有 top 位置需要运行（维护镜像）；bottom / hidden 都只靠 buildCSS
     *   的纯 CSS 生效，controller 停机。
     *
     * 轮询而非 MutationObserver：统计行内容按"步"更新（不是按 token 流），
     *   400ms 轮询足够跟手；而统计行文本变化是 characterData mutation，
     *   要用 observer 就得在 document 上开 characterData+subtree——对话
     *   流式输出时每个 token 都会触发，开销远大于一次 textContent 比较。
     *   节奏与 v0.9.x simple-mode 状态行的 setInterval 轮询一致。
     *   轮询同时兼任"自愈"：DSH 换会话重建 header 后下一 tick 自动补镜像。
     *
     * v0.10.11：start 调 statsEnsureDialogObserver() 懒初始化 body MutationObserver
     *   （单例，跨 start/stop 保留，避免重复注册）；stop 调 statsClearPendingAnchor()
     *   清掉残留的 pending——切到 bottom/hidden 后镜像已移除，不应再让 observer 接管后续
     *   dialog。observer 本身不 disconnect，因为它是全局单例、复用价值高；泄漏面也小，
     *   只在 dialog 添加/移除时触发，开销可忽略。
     */
    function createStatsLinePositionController() {
      var intervalId = null;
      var isRunning = false;

      function tick() {
        var mirror = statsEnsureMirror();
        if (mirror === null) return;
        statsSyncMirror(mirror, statsFindSource());
      }

      function start() {
        if (isRunning) return;
        if (typeof window === "undefined" || !window.setInterval) return;
        isRunning = true;
        intervalId = window.setInterval(tick, STATS_POLL_MS);
        tick();
      }

      function stop() {
        if (intervalId !== null && typeof window !== "undefined" && window.clearInterval) {
          window.clearInterval(intervalId);
        }
        intervalId = null;
        isRunning = false;
        statsRemoveMirror();
      }

      /** 按当前位置值启停。返回归一化后的位置，方便调用方记录 / 诊断。 */
      function sync(position) {
        var pos = statsNormalizePosition(position);
        if (pos === STATS_POS_TOP) {
          statsEnsureDialogObserver();
          start();
        } else {
          statsClearPendingAnchor();
          stop();
        }
        return pos;
      }

      return {
        start: start,
        stop: stop,
        sync: sync,
        get running() { return isRunning; }
      };
    }

