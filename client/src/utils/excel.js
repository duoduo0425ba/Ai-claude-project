import * as XLSX from 'xlsx';

// 导出为 Excel
export function exportToExcel(transactions, filename = '零花钱记账') {
  const data = transactions.map((t) => ({
    日期: t.date,
    类型: t.type === 'income' ? '收入' : '支出',
    分类: `${t.emoji} ${t.category}`,
    金额: t.amount,
    备注: t.note || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  // 设置列宽
  worksheet['!cols'] = [
    { wch: 12 }, // 日期
    { wch: 8 },  // 类型
    { wch: 14 }, // 分类
    { wch: 10 }, // 金额
    { wch: 20 }, // 备注
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '账单明细');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

// 从 Excel 导入
export function importFromExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // 尝试匹配列名
        const records = jsonData.map((row) => {
          const type = parseType(row['类型'] || row['type'] || row['Type'] || '');
          const amount = parseFloat(row['金额'] || row['amount'] || row['Amount'] || 0);
          const category = parseCategory(row['分类'] || row['category'] || row['Category'] || '其他');
          const note = row['备注'] || row['note'] || row['Note'] || '';
          const date = parseDate(row['日期'] || row['date'] || row['Date'] || '');

          return { type, amount, category: category.name, emoji: category.emoji, note, date };
        }).filter((r) => r.type && r.amount > 0 && r.date);

        resolve(records);
      } catch (err) {
        reject(new Error('Excel 文件解析失败: ' + err.message));
      }
    };

    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

function parseType(value) {
  const s = String(value).trim();
  if (['收入', 'income', 'Income', '入'].some((k) => s.includes(k))) return 'income';
  if (['支出', 'expense', 'Expense', '出'].some((k) => s.includes(k))) return 'expense';
  return '';
}

function parseCategory(value) {
  const s = String(value).replace(/[\s\uFE0F]/g, '').trim();

  const map = {
    '餐饮': { name: '餐饮', emoji: '🍜' },
    '零食': { name: '零食', emoji: '🍡' },
    '文具': { name: '文具', emoji: '📚' },
    '交通': { name: '交通', emoji: '🚌' },
    '娱乐': { name: '娱乐', emoji: '🎮' },
    '礼物': { name: '礼物', emoji: '🎁' },
    '服饰': { name: '服饰', emoji: '👗' },
    '其他': { name: '其他', emoji: '✨' },
    '零花钱': { name: '零花钱', emoji: '💰' },
    '红包': { name: '红包', emoji: '🧧' },
    '劳动': { name: '劳动所得', emoji: '💪' },
    '奖励': { name: '奖励', emoji: '🏆' },
  };

  for (const [key, val] of Object.entries(map)) {
    if (s.includes(key)) return val;
  }

  return { name: s || '其他', emoji: '✨' };
}

function parseDate(value) {
  if (!value) return '';
  // 处理 Excel 数字日期
  if (typeof value === 'number') {
    const d = new Date((value - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  // 尝试解析字符串日期
  const s = String(value).trim();
  const match = s.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }
  return '';
}
