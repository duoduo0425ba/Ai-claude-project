import { useEffect, useRef } from 'react';

export default function SakuraEffect() {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const createPetal = () => {
      const petal = document.createElement('div');
      petal.className = 'sakura-petal';
      petal.style.left = Math.random() * 100 + '%';
      petal.style.animationDuration = 8 + Math.random() * 7 + 's';
      petal.style.animationDelay = Math.random() * 5 + 's';
      petal.style.opacity = 0.3 + Math.random() * 0.4;
      petal.style.width = 8 + Math.random() * 10 + 'px';
      petal.style.height = petal.style.width;
      container.appendChild(petal);

      setTimeout(() => {
        petal.remove();
      }, 15000);
    };

    // 初始创建一些花瓣
    for (let i = 0; i < 8; i++) {
      setTimeout(createPetal, i * 600);
    }

    // 持续生成
    const interval = setInterval(createPetal, 2000);

    return () => {
      clearInterval(interval);
      container.innerHTML = '';
    };
  }, []);

  return <div ref={containerRef} className="sakura-container" />;
}
