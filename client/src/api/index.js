const BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || '请求失败');
  return data;
}

// 交易记录
export const getTransactions = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/transactions${query ? `?${query}` : ''}`);
};

export const addTransaction = (data) =>
  request('/transactions', { method: 'POST', body: JSON.stringify(data) });

export const deleteTransaction = (id) =>
  request(`/transactions/${id}`, { method: 'DELETE' });

export const batchImport = (records) =>
  request('/transactions/batch', { method: 'POST', body: JSON.stringify({ records }) });

// 统计
export const getDailySummary = (date) =>
  request(`/transactions/stats/daily?date=${date}`);

export const getWeeklyStats = (date) =>
  request(`/transactions/stats/weekly?date=${date}`);

export const getMonthlyStats = (year, month) =>
  request(`/transactions/stats/monthly?year=${year}&month=${month}`);

export const getYearlyStats = (year) =>
  request(`/transactions/stats/yearly?year=${year}`);

export const getBudgetStatus = (year, month) =>
  request(`/transactions/stats/budget?year=${year}&month=${month}`);

// 设置
export const getSettings = () => request('/transactions/settings');
export const updateSettings = (data) =>
  request('/transactions/settings', { method: 'PUT', body: JSON.stringify(data) });
