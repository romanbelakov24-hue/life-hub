/**
 * Фоновое свечение — размытые цветные пятна, медленно дрейфующие за контентом.
 *
 * Зачем: плоский однотонный фон делает интерфейс похожим на таблицу. Пятна
 * дают сцене глубину и «тепло», при этом не конкурируют с данными — они лежат
 * ниже каркаса (у него z-10), сильно размыты и не перехватывают события.
 *
 * Цвет берётся из токенов темы (--glow, --glow-cool), поэтому на бумаге
 * подсветка почти незаметна, а в темноте становится основным носителем
 * глубины. Дрейф останавливается при системной настройке «уменьшить движение».
 *
 * Компонент серверный: разметка статична, состояния у него нет.
 */

interface Blob {
  /** Позиция и размер в процентах вьюпорта. */
  style: React.CSSProperties;
  /** Сдвиг фазы, чтобы пятна не двигались синхронно. */
  delay: string;
  /**
   * Глубина параллакса — насколько пятно смещается за курсором.
   * Разные значения создают ощущение слоёв: дальние пятна ходят меньше.
   */
  depth: string;
}

const BLOBS: Blob[] = [
  {
    style: {
      top: "-14%",
      right: "-8%",
      width: "46vw",
      height: "46vw",
      background: "radial-gradient(circle, var(--glow-strong), transparent 68%)",
    },
    delay: "0s",
    depth: "26px",
  },
  {
    style: {
      bottom: "-18%",
      left: "-12%",
      width: "52vw",
      height: "52vw",
      background: "radial-gradient(circle, var(--glow), transparent 70%)",
    },
    delay: "-9s",
    depth: "16px",
  },
  {
    // Холодное пятно уравновешивает два тёплых, иначе вся сцена уезжает в оранжевый.
    style: {
      top: "38%",
      left: "42%",
      width: "34vw",
      height: "34vw",
      background: "radial-gradient(circle, var(--glow-cool), transparent 72%)",
    },
    delay: "-17s",
    depth: "38px",
  },
];

export function AmbientGlow() {
  return (
    <div className="ambient" aria-hidden>
      {BLOBS.map((blob, index) => (
        <div
          key={index}
          className="ambient-parallax"
          style={{ "--depth": blob.depth } as React.CSSProperties}
        >
          <div
            className="ambient-blob"
            style={{ ...blob.style, animationDelay: blob.delay }}
          />
        </div>
      ))}
    </div>
  );
}
