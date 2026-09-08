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
     */
    function statsSyncMirror(mirror, source) {
      var text = source === null ? "" : (source.textContent || "");
      if (mirror.title === text) return;
      mirror.title = text;
      while (mirror.firstChild) mirror.removeChild(mirror.firstChild);
      if (text === "" || source === null) return;
      var clone = source.cloneNode(true);
      while (clone.firstChild) mirror.appendChild(clone.firstChild);
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
        if (pos === STATS_POS_TOP) start();
        else stop();
        return pos;
      }

      return {
        start: start,
        stop: stop,
        sync: sync,
        get running() { return isRunning; }
      };
    }

