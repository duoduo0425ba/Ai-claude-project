import { useState, useEffect } from 'react';
import { getTags } from '../api';

// 多选标签选择器：已有标签点选切换，新标签手动输入添加。
// 与服务端校验保持一致：单个标签 ≤20 字，最多 10 个。
export default function TagPicker({ value = [], onChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    let mounted = true;
    getTags()
      .then((res) => {
        if (mounted) setSuggestions((res.data || []).map((t) => t.name));
      })
      .catch(() => {}); // 拿不到建议不影响手动输入
    return () => { mounted = false; };
  }, []);

  const toggle = (name) => {
    onChange(value.includes(name) ? value.filter((t) => t !== name) : [...value, name]);
  };

  const addTag = () => {
    const name = input.trim();
    setInput('');
    if (!name || name.length > 20 || value.length >= 10 || value.includes(name)) return;
    onChange([...value, name]);
  };

  // 已选的排前面（含建议里没有的新标签），未选建议跟在后面
  const options = [...new Set([...value, ...suggestions])];

  return (
    <div>
      {options.length > 0 && (
        <div className="filter-row" style={{ marginBottom: '8px' }}>
          {options.map((name) => (
            <button
              type="button"
              key={name}
              className={`filter-chip ${value.includes(name) ? 'active' : ''}`}
              onClick={() => toggle(name)}
            >
              #{name}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          className="input-field"
          placeholder="新标签，回车或点添加"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); addTag(); }
          }}
        />
        <button type="button" className="btn btn-ghost" onClick={addTag}>添加</button>
      </div>
    </div>
  );
}
