/* ============================================================================
 * 微信读书 · 正文提取脚本
 * ----------------------------------------------------------------------------
 * 用途：把「微信读书网页版」当前章节的完整正文一次性抓出来，
 *       复制到剪贴板，然后粘贴进「透明阅读层」(reader.html) 里阅读。
 *
 * 用法：
 *   1. 用 Chrome / Edge 打开 https://weread.qq.com 并登录，进入要读的书
 *   2. 按 F12 打开开发者工具，切到「控制台 / Console」
 *   3. 如果控制台提示「不允许粘贴」，先按提示输入 allow pasting 回车
 *   4. 把本文件全部内容粘贴进去，回车
 *   5. 全文会自动复制到剪贴板，回到 reader.html 点「读取剪贴板」即可
 *
 * 说明：脚本会自动滚动页面把懒加载的段落全部加载出来，再抽取文本。
 *       只抓「当前章节」。切换章节后重新运行即可。
 * ==========================================================================*/
(async function extractWeread() {
  'use strict';

  // ---------- 可调参数 ----------
  const CFG = {
    scrollStep: 0.85,     // 每次滚动屏幕高度的比例
    scrollDelay: 320,     // 每次滚动后的等待毫秒（网络慢可调大）
    maxScrolls: 400,      // 最多滚动次数，防止死循环
    stableRounds: 3,      // 连续 N 次没有新内容就认为到底了
    restoreScroll: true,  // 抓完后是否滚回原来的位置
  };

  const log  = (...a) => console.log('%c[提取]', 'color:#3a7bd5;font-weight:bold', ...a);
  const warn = (...a) => console.warn('[提取]', ...a);

  log('开始提取当前章节正文…');

  // ---------- 1. 自动滚动，触发懒加载 ----------
  const scroller = document.scrollingElement || document.documentElement;
  const originY = scroller.scrollTop;
  let lastHeight = 0, stable = 0, rounds = 0;

  while (rounds < CFG.maxScrolls && stable < CFG.stableRounds) {
    scroller.scrollTop = Math.min(
      scroller.scrollTop + window.innerHeight * CFG.scrollStep,
      scroller.scrollHeight
    );
    await new Promise(r => setTimeout(r, CFG.scrollDelay));

    const h = scroller.scrollHeight;
    if (h === lastHeight) stable++; else { stable = 0; lastHeight = h; }

    if (scroller.scrollTop + window.innerHeight >= h - 4) {
      // 到底了，再多等两轮确认
      stable++;
    }
    rounds++;
  }
  log(`滚动完成（${rounds} 次），页面高度 ${scroller.scrollHeight}px`);

  if (CFG.restoreScroll) scroller.scrollTop = originY;

  // ---------- 2. 定位正文容器 ----------
  // 微信读书的阅读区 class 名会随版本变化，这里用「文本密度」来猜。
  function textDensity(node) {
    const t = node.innerText || '';
    if (t.length < 300) return 0;
    // 段落的平均长度 + 总长度，越长越像正文
    const paras = t.split('\n').filter(s => s.trim().length > 8);
    if (paras.length < 3) return 0;
    const avg = t.length / paras.length;
    return t.length * Math.min(avg, 120) / 120;
  }

  const candidates = Array.from(
    document.querySelectorAll('main, article, section, div')
  ).filter(n => {
    const r = n.getBoundingClientRect();
    return r.width > 260 && r.height > 200;
  });

  let best = null, bestScore = 0;
  for (const n of candidates) {
    // 跳过明显是导航/侧栏的容器
    const cls = (n.className || '') + '';
    if (/nav|sidebar|toolbar|header|footer|menu|panel|modal|dialog/i.test(cls)) continue;
    const s = textDensity(n);
    if (s > bestScore) { bestScore = s; best = n; }
  }

  if (!best) {
    warn('没找到正文容器，改为全页面抽取。');
  } else {
    log('正文容器：', best.tagName + '.' + (best.className || '').toString().slice(0, 60));
  }

  // ---------- 3. 抽取段落 ----------
  const root = best || document.body;

  // 优先取 <p>；没有段落标签就按行切
  let paras = Array.from(root.querySelectorAll('p'))
    .map(p => (p.innerText || '').replace(/\s+$/g, '').trim())
    .filter(t => t.length > 0);

  if (paras.length < 3) {
    paras = (root.innerText || '')
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  // ---------- 4. 清洗 ----------
  const skipRe = [
    /^微信读书$/, /^微信阅读$/,
    /^www\.weread\.qq\.com/i,
    /^第\s*\d+\s*页$/,
    /^\d+\s*\/\s*\d+$/,
    /^-\s*\d+\s*-$/,
    /^(目录|书架|笔记|划线|想法|设置|夜间|日间|字号|翻页)$/,
    /^(上一章|下一章|上一页|下一页|返回|回到顶部)\s*$/,
    /^\d{1,2}:\d{2}$/,
  ];

  let out = [];
  let dupGuard = '';
  for (let p of paras) {
    p = p.replace(/\u200b|\ufeff/g, '').trim();
    if (!p) continue;
    if (skipRe.some(re => re.test(p))) continue;
    // 去掉重复出现的连续相同段落（滚动加载常见）
    if (p === dupGuard) continue;
    dupGuard = p;
    out.push(p);
  }

  // 合并被硬换行拆断的句子
  const merged = [];
  for (const p of out) {
    const prev = merged[merged.length - 1];
    const brokenTail = prev && !/[。！？…”』」）\)\]】\.\!\?]$/.test(prev) && prev.length < 90;
    const startsLow = /^[a-z，。、；：）\)】]/.test(p) || /^[\u4e00-\u9fa5]/.test(p) === false;
    if (brokenTail && startsLow) merged[merged.length - 1] = prev + p;
    else merged.push(p);
  }

  // ---------- 5. 组装输出 ----------
  // 标题取页面标题里的书名部分作为第一行
  const pageTitle = (document.title || '').replace(/\s*-\s*微信读书\s*$/, '').trim();
  const text = (pageTitle ? pageTitle + '\n\n' : '') + merged.join('\n\n');

  // ---------- 6. 复制到剪贴板 ----------
  let copied = false;
  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch (e) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta);
      ta.select();
      copied = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e2) { copied = false; }
  }

  console.log('%c───────── 提取完成 ─────────', 'color:#3a7bd5;font-weight:bold');
  console.log(`段落数：${merged.length}　总字数：${text.length}`);
  console.log(`已复制到剪贴板：${copied ? '是 ✅' : '否（请手动复制下面的内容）'}`);
  if (!copied) console.log(text);

  // 兜底：把结果挂到 window，方便手动取
  window.__wxdsText = text;
  log('也可在控制台执行  copy(__wxdsText)  再次复制');

  return text;
})();
