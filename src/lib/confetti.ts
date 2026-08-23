// 相認成功那一刻的彩帶。手寫 canvas，不加套件——需求只有「噴一次、1.2 秒、糖果色」，
// 為此裝一個 confetti 套件不划算。
//
// 顏色直接取 globals.css 的 tone badge 色階，跟全站同一套 OKLCH。
const COLORS = [
  "oklch(0.88 0.11 150)",
  "oklch(0.88 0.09 250)",
  "oklch(0.88 0.11 60)",
  "oklch(0.88 0.09 300)",
  "oklch(0.89 0.09 15)",
];

const COUNT = 70;
const LIFE_MS = 1200;
const GRAVITY = 0.35;

// 手機上噴 70 顆剛好，投影在 3 公尺寬的布幕上就顯得零星。
// 預設值不變，所以既有的呼叫端一個字都不用改。
export interface ConfettiOptions {
  count?: number;
  lifeMs?: number;
  /** 粒子尺寸倍率。大螢幕要放大，不然看起來像雜訊。 */
  scale?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  spin: number;
  angle: number;
}

// 以 origin 元素的中心為原點噴一次。時間到自己收乾淨（canvas 一併移除）。
export function fireConfetti(
  origin: HTMLElement,
  options: ConfettiOptions = {},
): void {
  const count = options.count ?? COUNT;
  const lifeMs = options.lifeMs ?? LIFE_MS;
  const scale = options.scale ?? 1;

  if (typeof window === "undefined") return;
  // 使用者說了不要動畫就別放。
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const box = origin.getBoundingClientRect();
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;

  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60";
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  const particles: Particle[] = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = (4 + Math.random() * 7) * scale;
    return {
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4 * scale, // 稍微往上偏，才像「噴」而不是「散」
      size: (6 + Math.random() * 6) * scale,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      spin: (Math.random() - 0.5) * 0.3,
      angle: Math.random() * Math.PI,
    };
  });

  const start = performance.now();
  let raf = 0;

  const tick = (now: number) => {
    const elapsed = now - start;
    if (elapsed >= lifeMs) {
      cancelAnimationFrame(raf);
      canvas.remove();
      return;
    }

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    // 最後 400ms 淡出，免得整片突然消失。
    ctx.globalAlpha = Math.min(1, (lifeMs - elapsed) / 400);

    for (const p of particles) {
      p.vy += GRAVITY;
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.spin;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }

    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);
}
