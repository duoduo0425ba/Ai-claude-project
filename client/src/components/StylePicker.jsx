import { useRef } from 'react';
import { STYLE_IDS, STYLES } from '../styles/registry';

// 界面风格的三张卡片（单选）。注册页和设置页共用。
// 按无障碍规范的单选组：Tab 只停在选中的那张，左右/上下方向键切换。
// busy 时（例如正在保存）只做标记，不禁用按钮：禁用会让键盘焦点丢失
export default function StylePicker({ value, onChange, labelledBy, busy = false }) {
  const cardRefs = useRef({});

  const handleKeyDown = (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const index = STYLE_IDS.indexOf(value);
    const next = STYLE_IDS[(index + step + STYLE_IDS.length) % STYLE_IDS.length];
    onChange(next);
    cardRefs.current[next]?.focus();
  };

  return (
    <div className="style-picker" role="radiogroup" aria-labelledby={labelledBy} aria-busy={busy} onKeyDown={handleKeyDown}>
      {STYLE_IDS.map((id) => {
        const style = STYLES[id];
        const checked = id === value;
        return (
          <button
            key={id}
            ref={(el) => { cardRefs.current[id] = el; }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className="style-card"
            onClick={() => onChange(id)}
          >
            <span className="style-swatches" aria-hidden="true">
              {style.preview.map((color) => <i key={color} style={{ background: color }} />)}
            </span>
            <span className="style-name">{style.emoji} {style.name}</span>
            <span className="style-desc">{style.tagline}</span>
          </button>
        );
      })}
    </div>
  );
}
