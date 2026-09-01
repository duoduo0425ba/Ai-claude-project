const BASE = '/api';

async function request(url, options = {}) {
  const token = sessionStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${url}`, { headers: { ...headers, ...options.headers }, ...options });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error('网络请求失败');
  }

  if (res.status === 401) {
    sessionStorage.removeItem('token');
    window.location.replace('/login');
    const err = new Error('登录已过期，请重新登录');
    err.name = 'AuthError';
    throw err;
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`接口响应格式错误 (${res.status})`);
  }

  if (!res.ok || !data.success) {
    throw new Error(data.error || `请求失败 (${res.status})`);
  }

  return data;
}

// 认证
export const register = (data) =>
  request('/auth/register', { method: 'POST', body: JSON.stringify(data) });
export const login = (data) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify(data) });
export const changePassword = (data) =>
  request('/auth/change-password', { method: 'POST', body: JSON.stringify(data) });
export const getUsers = () => request('/auth/users');
export const deleteUser = (id) => request(`/auth/users/${id}`, { method: 'DELETE' });

// 交易记录
export const getTransactions = (params = {}, options = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/transactions${query ? `?${query}` : ''}`, options);
};
export const addTransaction = (data) =>
  request('/transactions', { method: 'POST', body: JSON.stringify(data) });
export const updateTransaction = (id, data) =>
  request(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
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
export const getTotalBalance = () =>
  request('/transactions/stats/balance');

// 分类管理
export const getCategories = (type) => request(`/categories?type=${type}`);
export const addCategory = (data) =>
  request('/categories', { method: 'POST', body: JSON.stringify(data) });
export const deleteCategory = (id) => request(`/categories/${id}`, { method: 'DELETE' });

// 设置
export const getSettings = () => request('/transactions/settings');
export const updateSettings = (data) =>
  request('/transactions/settings', { method: 'PUT', body: JSON.stringify(data) });

// 分类预算
export const getCategoryBudgets = () => request('/budgets');
export const getCategoryBudgetStatus = (year, month) =>
  request(`/budgets/status?year=${year}&month=${month}`);
export const setCategoryBudget = (category, amount) =>
  request(`/budgets/${encodeURIComponent(category)}`, { method: 'PUT', body: JSON.stringify({ amount }) });
export const deleteCategoryBudget = (category) =>
  request(`/budgets/${encodeURIComponent(category)}`, { method: 'DELETE' });

// 标签（随交易保存自动创建，此接口仅供筛选栏和输入建议）
export const getTags = () => request('/tags');

// 周期账单
export const getRecurringTemplates = () => request('/recurring');
export const addRecurringTemplate = (data) =>
  request('/recurring', { method: 'POST', body: JSON.stringify(data) });
export const deleteRecurringTemplate = (id) =>
  request(`/recurring/${id}`, { method: 'DELETE' });
export const toggleRecurringTemplate = (id, is_active) =>
  request(`/recurring/${id}`, { method: 'PATCH', body: JSON.stringify({ is_active }) });
export const generateRecurring = () =>
  request('/recurring/generate', { method: 'POST' });
