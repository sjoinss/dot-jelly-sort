"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import styles from "./DesktopFrame.module.css";

/** 이 폭(CSS px) 이하면 프레임 없이 전체 화면 */
const BREAKPOINT = 480;
/** PC 프레임: 폭은 높이의 9:16 이하, 바깥 여백, 최대 폭 */
const GUTTER = 24;
const MAX_W = 430;
const MAX_RATIO = 9 / 16;

type Layout = { desktop: false } | { desktop: true; width: number; height: number };

function readLayout(): Layout {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w <= BREAKPOINT) return { desktop: false };
  // 높이 기준으로 맞추고 폭은 비율 범위·최대 폭 안에서
  const height = Math.max(320, h - GUTTER * 2);
  const width = Math.round(Math.min(MAX_W, w - GUTTER * 2, height * MAX_RATIO));
  return { desktop: true, width, height };
}

/**
 * 앱 셸 (점프점프와 같은 방식). 480px 이하면 화면 전체, 넓으면 가운데 세로 프레임 + 밝은 파스텔 배경과 도트 장식.
 */
export function DesktopFrame({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState<Layout | null>(null);

  useEffect(() => {
    const update = () => setLayout(readLayout());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const desktop = layout?.desktop === true;
  const frameStyle: CSSProperties | undefined = layout?.desktop ? { width: layout.width, height: layout.height } : undefined;

  return (
    <div className={`${styles.shell} ${desktop ? styles.desktop : styles.mobile}`}>
      {desktop && <PixelDecor />}
      <div className={styles.frame} style={frameStyle}>
        {layout ? children : null}
      </div>
    </div>
  );
}

/** 배경 장식용 도트 구름·별. 정보는 담지 않으므로 스크린리더에서 숨긴다 */
function PixelDecor() {
  return (
    <div className={styles.decor} aria-hidden="true">
      <span className={`${styles.cloud} ${styles.cloudA}`} />
      <span className={`${styles.cloud} ${styles.cloudB}`} />
      <span className={`${styles.cloud} ${styles.cloudC}`} />
      <span className={`${styles.star} ${styles.starA}`} />
      <span className={`${styles.star} ${styles.starB}`} />
      <span className={`${styles.star} ${styles.starC}`} />
      <span className={`${styles.grass} ${styles.grassA}`} />
      <span className={`${styles.grass} ${styles.grassB}`} />
    </div>
  );
}
