const API_BASE = "http://localhost:5000/api";

const request = async (path, options = {}, token) => {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const base = data.message || "Request failed";
    const message = data.error ? `${base}: ${data.error}` : base;
    const error = new Error(message);
    error.details = data.errors || [];
    throw error;
  }
  return data;
};

export const api = {
  register: (payload) =>
    request("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  createGroup: (payload, token) =>
    request("/groups", { method: "POST", body: JSON.stringify(payload) }, token),
  listGroups: (token) => request("/groups", {}, token),
  addGroupMember: (groupId, memberId, token) =>
    request(
      `/groups/${groupId}/members/add`,
      { method: "PATCH", body: JSON.stringify({ memberId }) },
      token
    ),
  removeGroupMember: (groupId, memberId, token) =>
    request(
      `/groups/${groupId}/members/remove`,
      { method: "PATCH", body: JSON.stringify({ memberId }) },
      token
    ),
  deleteGroup: (groupId, token) => request(`/groups/${groupId}`, { method: "DELETE" }, token),
  createExpense: (payload, token) =>
    request("/expenses", { method: "POST", body: JSON.stringify(payload) }, token),
  listGroupExpenses: (groupId, token) => request(`/expenses/group/${groupId}`, {}, token),
  listUsers: (token, query = "") => request(`/users?query=${encodeURIComponent(query)}`, {}, token),
  parseExpenseText: (payload, token) =>
    request("/ai/parse-expense-text", { method: "POST", body: JSON.stringify(payload) }, token),
  parseBillText: (payload, token) =>
    request("/ai/parse-bill-text", { method: "POST", body: JSON.stringify(payload) }, token),
  parseBillImage: async ({ groupId, defaultCurrency, file }, token) => {
    const formData = new FormData();
    formData.append("groupId", groupId);
    formData.append("defaultCurrency", defaultCurrency || "INR");
    formData.append("billImage", file);

    const response = await fetch(`${API_BASE}/ai/parse-bill-image`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || "Request failed");
      error.details = data.errors || [];
      throw error;
    }
    return data;
  }
};
