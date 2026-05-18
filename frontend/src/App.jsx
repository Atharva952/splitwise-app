import { useEffect, useMemo, useState } from "react";
import { api } from "./api";

const fieldCls = "field";

const btnPrimary = "btn-primary w-full";

const sym = (code = "INR") => {
  const map = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
  };

  return map[code?.toUpperCase()] || `${code} `;
};

const P = {
  logout: "↩",
  plus: "+",
  trash: "🗑",
  chev: "›",
  bill: "💳",
  settle: "⇄",
  arrow: "→",
  spark: "✨",
  img: "🖼",
  eq: "=",
  folder: "📁",
  group: "👥",
};

const Ico = ({ d, className = "", size = 16 }) => {
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={{
        fontSize: size,
        lineHeight: 1,
      }}
    >
      {d}
    </span>
  );
};

const FL = ({ children }) => {
  return (
    <label className="mb-2 block text-sm font-semibold text-surface-700">
      {children}
    </label>
  );
};

const Flash = ({ type, msg }) => {
  if (!msg) return null;

  const styles =
    type === "error"
      ? "border-red-200 bg-red-50 text-red-600"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div
      className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-medium ${styles}`}
    >
      {msg}
    </div>
  );
};

const Chip = ({ children, color = "surface" }) => {
  const variants = {
    surface: "bg-surface-100 text-surface-700",
    teal: "bg-brand-100 text-brand-700",
    violet: "bg-violet-100 text-violet-700",
    slate: "bg-surface-100 text-surface-700",
  };

  return (
    <span className={`chip ${variants[color] || variants.surface}`}>
      {children}
    </span>
  );
};

const SHead = ({ icon, iconCls = "", label, right }) => {
  return (
    <div className="mb-5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconCls}`}
        >
          <Ico d={P[icon] || "•"} size={18} />
        </div>

        <h2 className="section-title">{label}</h2>
      </div>

      {right}
    </div>
  );
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const to2 = (num) => Number(Number(num).toFixed(2));

const splitAmountAcrossUsers = (amount, userIds) => {
  if (!amount || !Array.isArray(userIds) || userIds.length === 0) return [];
  const cents = Math.round(Number(amount) * 100);
  const base = Math.floor(cents / userIds.length);
  let remainder = cents - base * userIds.length;

  return userIds.map((userId) => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) {
      remainder -= 1;
    }
    return {
      user: userId,
      value: (base + extra) / 100,
    };
  });
};

const initialExpense = {
  payer: "",
  amount: "",
  currency: "INR",
  description: "",
  date: todayISO(),
  splitMode: "exact",
  splits: [{ user: "", value: "" }],
};

function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(
    localStorage.getItem("user")
      ? JSON.parse(localStorage.getItem("user"))
      : null,
  );
  const [authMode, setAuthMode] = useState("register");
  const [authForm, setAuthForm] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [groupForm, setGroupForm] = useState({
    name: "",
    description: "",
    memberIds: [],
  });
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupMemberToAdd, setGroupMemberToAdd] = useState("");
  const [expenses, setExpenses] = useState([]);
  const [expenseForm, setExpenseForm] = useState(initialExpense);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [aiExpenseText, setAiExpenseText] = useState("");
  const [aiExpenseDraft, setAiExpenseDraft] = useState(null);
  const [aiExpenseMeta, setAiExpenseMeta] = useState(null);
  const [aiExpenseValidationErrors, setAiExpenseValidationErrors] = useState(
    [],
  );

  const [aiBillText, setAiBillText] = useState("");
  const [aiBillImageFile, setAiBillImageFile] = useState(null);
  const [aiBillResult, setAiBillResult] = useState(null);
  const [aiBillOcrText, setAiBillOcrText] = useState("");
  const [billAssignments, setBillAssignments] = useState([]);

  const currentMembers = useMemo(() => {
    const byId = new Map();
    (selectedGroup?.members || []).forEach((member) => {
      if (member?._id) byId.set(member._id, member);
    });
    (selectedGroup?.admins || []).forEach((admin) => {
      const adminObj =
        typeof admin === "string" ? users.find((u) => u._id === admin) : admin;
      if (adminObj?._id) byId.set(adminObj._id, adminObj);
    });
    if (selectedGroup?.createdBy) {
      const creatorObj =
        typeof selectedGroup.createdBy === "string"
          ? users.find((u) => u._id === selectedGroup.createdBy)
          : selectedGroup.createdBy;
      if (creatorObj?._id) byId.set(creatorObj._id, creatorObj);
    }
    return [...byId.values()];
  }, [selectedGroup, users]);
  const creatorId = useMemo(() => {
    if (!selectedGroup?.createdBy) return "";
    return typeof selectedGroup.createdBy === "string"
      ? selectedGroup.createdBy
      : selectedGroup.createdBy._id;
  }, [selectedGroup]);
  const selectedGroupAdminIds = useMemo(() => {
    const adminIds = (selectedGroup?.admins || []).map((admin) =>
      typeof admin === "string" ? admin : admin._id,
    );
    if (creatorId && !adminIds.includes(creatorId)) {
      adminIds.push(creatorId);
    }
    return adminIds;
  }, [selectedGroup, creatorId]);
  const isSelectedGroupAdmin = useMemo(
    () => Boolean(user?.id && selectedGroupAdminIds.includes(user.id)),
    [selectedGroupAdminIds, user],
  );
  const availableUsersForSelectedGroup = useMemo(
    () =>
      users.filter(
        (u) => !currentMembers.some((member) => member._id === u._id),
      ),
    [users, currentMembers],
  );

  const currentUserInGroup = useMemo(
    () => currentMembers.find((member) => member._id === user?.id),
    [currentMembers, user],
  );

  useEffect(() => {
    if (!token) return;
    Promise.all([api.listGroups(token), api.listUsers(token)])
      .then(([groupsData, usersData]) => {
        setGroups(groupsData);
        setUsers(usersData);
      })
      .catch((err) => setError(err.message));
  }, [token]);

  useEffect(() => {
    if (!selectedGroup) return;
    if (currentMembers.length === 0) return;

    setExpenseForm((prev) => ({
      ...prev,
      payer: prev.payer || currentMembers[0]._id,
      splits: prev.splits[0]?.user
        ? prev.splits
        : currentMembers.map((member) => ({ user: member._id, value: "" })),
    }));

    api
      .listGroupExpenses(selectedGroup._id, token)
      .then(setExpenses)
      .catch((err) => setError(err.message));
  }, [selectedGroup, token, currentMembers]);

  useEffect(() => {
    setAiExpenseText("");
    setAiExpenseDraft(null);
    setAiExpenseMeta(null);
    setAiExpenseValidationErrors([]);
    setAiBillText("");
    setAiBillImageFile(null);
    setAiBillResult(null);
    setAiBillOcrText("");
    setBillAssignments([]);
    setGroupMemberToAdd("");
  }, [selectedGroup?._id]);

  const saveAuth = (data) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    setError("");
    setMessage(`Welcome ${data.user.username}`);
  };

  const submitAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const payload =
        authMode === "register"
          ? authForm
          : { email: authForm.email, password: authForm.password };
      const data =
        authMode === "register"
          ? await api.register(payload)
          : await api.login(payload);
      saveAuth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken("");
    setUser(null);
    setGroups([]);
    setSelectedGroup(null);
    setExpenses([]);
  };

  const toggleMember = (id) => {
    setGroupForm((prev) => {
      const exists = prev.memberIds.includes(id);
      return {
        ...prev,
        memberIds: exists
          ? prev.memberIds.filter((m) => m !== id)
          : [...prev.memberIds, id],
      };
    });
  };

  const createGroup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const group = await api.createGroup(groupForm, token);
      await refreshGroups(group._id);
      setGroupForm({ name: "", description: "", memberIds: [] });
      setMessage("Group created");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const syncSelectedGroupAfterRefresh = (updatedGroups, preferredGroupId) => {
    setGroups(updatedGroups);
    const preferred = preferredGroupId
      ? updatedGroups.find((group) => group._id === preferredGroupId) || null
      : null;
    setSelectedGroup(preferred);
    if (!preferred) {
      setExpenses([]);
    }
  };

  const refreshGroups = async (preferredGroupId = selectedGroup?._id) => {
    const updated = await api.listGroups(token);
    syncSelectedGroupAfterRefresh(updated, preferredGroupId);
  };

  const addMemberToSelectedGroup = async () => {
    if (!selectedGroup || !groupMemberToAdd) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api.addGroupMember(selectedGroup._id, groupMemberToAdd, token);
      await refreshGroups(selectedGroup._id);
      setGroupMemberToAdd("");
      setMessage("Member added");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const removeMemberFromSelectedGroup = async (memberId) => {
    if (!selectedGroup || !memberId) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api.removeGroupMember(selectedGroup._id, memberId, token);
      await refreshGroups(selectedGroup._id);
      setMessage("Member removed");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteSelectedGroup = async () => {
    if (!selectedGroup) return;
    if (
      !window.confirm(
        `Delete group "${selectedGroup.name}"? This will also delete all its expenses.`,
      )
    ) {
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api.deleteGroup(selectedGroup._id, token);
      const updated = await api.listGroups(token);
      setGroups(updated);
      setSelectedGroup(updated[0] || null);
      setExpenses([]);
      setMessage("Group deleted");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateSplit = (index, key, value) => {
    setExpenseForm((prev) => {
      const next = [...prev.splits];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, splits: next };
    });
  };

  const addSplitRow = () => {
    setExpenseForm((prev) => ({
      ...prev,
      splits: [
        ...prev.splits,
        { user: currentMembers[0]?._id || "", value: "" },
      ],
    }));
  };

  const removeSplitRow = (index) => {
    setExpenseForm((prev) => ({
      ...prev,
      splits: prev.splits.filter((_, i) => i !== index),
    }));
  };

  const autoEqual = () => {
    const amount = Number(expenseForm.amount || 0);
    if (!amount || currentMembers.length === 0) return;
    const equalSplits = splitAmountAcrossUsers(
      amount,
      currentMembers.map((member) => member._id),
    );
    setExpenseForm((prev) => ({
      ...prev,
      splitMode: "exact",
      splits: equalSplits,
    }));
  };

  const submitExpense = async (e) => {
    e.preventDefault();
    if (!selectedGroup) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        groupId: selectedGroup._id,
        payer: expenseForm.payer,
        amount: Number(expenseForm.amount),
        currency: expenseForm.currency || "INR",
        description: expenseForm.description,
        date: expenseForm.date,
        splitMode: expenseForm.splitMode,
        splits: expenseForm.splits.map((split) => ({
          user: split.user,
          value: Number(split.value),
        })),
      };

      await api.createExpense(payload, token);
      const updatedExpenses = await api.listGroupExpenses(
        selectedGroup._id,
        token,
      );
      setExpenses(updatedExpenses);
      setExpenseForm({
        ...initialExpense,
        payer: currentMembers[0]?._id || "",
        splits: currentMembers.map((member) => ({
          user: member._id,
          value: "",
        })),
      });
      setMessage("Expense added");
    } catch (err) {
      const details = err.details?.length ? `: ${err.details.join(", ")}` : "";
      setError(`${err.message}${details}`);
    } finally {
      setLoading(false);
    }
  };

  const parseExpenseWithAI = async () => {
    if (!selectedGroup || !aiExpenseText.trim()) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await api.parseExpenseText(
        {
          groupId: selectedGroup._id,
          text: aiExpenseText,
          defaultCurrency: expenseForm.currency || "INR",
        },
        token,
      );
      setAiExpenseDraft(result.draft);
      setAiExpenseMeta(result.aiMeta);
      setAiExpenseValidationErrors(result.validationErrors || []);
      setMessage("AI parsed your expense note. Review and apply to form.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const applyAiExpenseDraft = () => {
    if (!aiExpenseDraft) return;
    const draftSplits =
      aiExpenseDraft.splits?.length > 0
        ? aiExpenseDraft.splits
        : currentMembers.map((member) => ({ user: member._id, value: "" }));
    setExpenseForm({
      payer: aiExpenseDraft.payer || "",
      amount: aiExpenseDraft.amount ? String(aiExpenseDraft.amount) : "",
      currency: aiExpenseDraft.currency || "INR",
      description: aiExpenseDraft.description || "",
      date: aiExpenseDraft.date || todayISO(),
      splitMode: aiExpenseDraft.splitMode || "exact",
      splits: draftSplits.map((split) => ({
        user: split.user || "",
        value: split.value,
      })),
    });
    setMessage("AI draft applied to expense form. Please review and save.");
  };

  const parseBillWithAI = async () => {
    if (!selectedGroup || !aiBillText.trim()) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await api.parseBillText(
        {
          groupId: selectedGroup._id,
          text: aiBillText,
          defaultCurrency: expenseForm.currency || "INR",
        },
        token,
      );
      setAiBillResult(result);
      setAiBillOcrText("");
      setBillAssignments(
        (result.bill?.lineItems || []).map(() => ({
          users: [],
        })),
      );
      setMessage("Bill parsed. Assign each line item to one or more members.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const parseBillImageWithAI = async () => {
    if (!selectedGroup || !aiBillImageFile) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await api.parseBillImage(
        {
          groupId: selectedGroup._id,
          defaultCurrency: expenseForm.currency || "INR",
          file: aiBillImageFile,
        },
        token,
      );
      setAiBillResult(result);
      setAiBillOcrText(result.ocrText || "");
      setBillAssignments(
        (result.bill?.lineItems || []).map(() => ({
          users: [],
        })),
      );
      setMessage("Bill image parsed with OCR. Assign line items to members.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleBillItemUser = (itemIndex, userId) => {
    setBillAssignments((prev) => {
      const next = [...prev];
      const existing = next[itemIndex]?.users || [];
      const hasUser = existing.includes(userId);
      next[itemIndex] = {
        users: hasUser
          ? existing.filter((id) => id !== userId)
          : [...existing, userId],
      };
      return next;
    });
  };

  const billSplitSummary = useMemo(() => {
    if (!aiBillResult?.bill?.lineItems) return { splits: [], assignedTotal: 0 };

    const totals = {};
    let assignedTotal = 0;
    aiBillResult.bill.lineItems.forEach((item, index) => {
      const userIds = billAssignments[index]?.users || [];
      const amount = Number(item.amount || 0);
      if (amount <= 0 || userIds.length === 0) return;
      const distributed = splitAmountAcrossUsers(amount, userIds);
      assignedTotal = to2(assignedTotal + amount);
      distributed.forEach((entry) => {
        totals[entry.user] = to2((totals[entry.user] || 0) + entry.value);
      });
    });

    const splits = Object.entries(totals).map(([userId, value]) => ({
      user: userId,
      value,
    }));

    return { splits, assignedTotal };
  }, [aiBillResult, billAssignments]);

  const applyBillToExpenseForm = () => {
    if (!aiBillResult?.bill) return;
    if (billSplitSummary.splits.length === 0) {
      setError("Assign at least one bill item to a member first.");
      return;
    }

    const { bill } = aiBillResult;
    const payer = currentUserInGroup?._id || currentMembers[0]?._id || "";
    const description = bill.merchant
      ? `Bill from ${bill.merchant}`
      : "Bill expense";

    setExpenseForm({
      payer,
      amount: String(bill.total),
      currency: bill.currency || "INR",
      description,
      date: bill.date || todayISO(),
      splitMode: "exact",
      splits: billSplitSummary.splits,
    });
    setMessage("Bill-based draft applied. Review and save.");
  };
  const getMemberName = (id) => {
    return currentMembers.find((m) => m._id === id)?.username || "Unknown";
  };

  const settlements = useMemo(() => {
    const balances = {};

    currentMembers.forEach((m) => {
      balances[m._id] = 0;
    });

    expenses.forEach((exp) => {
      balances[exp.payer._id] += Number(exp.amount);

      exp.splits.forEach((s) => {
        const uid = s.user?._id || s.user;
        balances[uid] -= Number(s.value);
      });
    });

    const debtors = [];
    const creditors = [];

    Object.entries(balances).forEach(([user, amt]) => {
      if (amt > 0) creditors.push({ user, amt });
      if (amt < 0) debtors.push({ user, amt: -amt });
    });

    const result = [];

    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const pay = Math.min(debtors[i].amt, creditors[j].amt);

      result.push({
        from: debtors[i].user,
        to: creditors[j].user,
        amt: pay,
      });

      debtors[i].amt -= pay;
      creditors[j].amt -= pay;

      if (debtors[i].amt < 0.01) i++;
      if (creditors[j].amt < 0.01) j++;
    }

    return result;
  }, [expenses, currentMembers]);

  if (!token) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 px-4 py-12">
        {/* blobs */}
        <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-teal-300/20 blur-[100px]" />
          <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-violet-300/15 blur-[100px]" />
        </div>

        {/* logo mark */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-2xl font-black text-white shadow-lg shadow-teal-200">
            S
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Expense Tracker
          </p>
        </div>

        {/* card */}
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <h1 className="text-3xl font-extrabold text-slate-900">
            {authMode === "register" ? "Create account" : "Welcome back"}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {authMode === "register"
              ? "Start splitting trip expenses with friends."
              : "Log in to your account."}
          </p>

          {/* tab bar */}
          <div className="mt-6 flex rounded-xl bg-slate-100 p-1">
            {["register", "login"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setAuthMode(m)}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold capitalize transition-all
                  ${authMode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {m}
              </button>
            ))}
          </div>

          <form onSubmit={submitAuth} className="mt-6 space-y-4">
            {authMode === "register" && (
              <div>
                <FL>Username</FL>
                <input
                  className={fieldCls}
                  placeholder="e.g. alex_doe"
                  value={authForm.username}
                  onChange={(e) =>
                    setAuthForm((p) => ({ ...p, username: e.target.value }))
                  }
                  required
                />
              </div>
            )}
            <div>
              <FL>Email</FL>
              <input
                type="email"
                className={fieldCls}
                placeholder="you@example.com"
                value={authForm.email}
                onChange={(e) =>
                  setAuthForm((p) => ({ ...p, email: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <FL>Password</FL>
              <input
                type="password"
                className={fieldCls}
                placeholder="••••••••"
                value={authForm.password}
                onChange={(e) =>
                  setAuthForm((p) => ({ ...p, password: e.target.value }))
                }
                required
              />
            </div>

            <Flash type="error" msg={error} />

            <button disabled={loading} type="submit" className={btnPrimary}>
              {loading
                ? "Please wait…"
                : authMode === "register"
                  ? "Create Account →"
                  : "Login →"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     MAIN DASHBOARD
  ══════════════════════════════════════════════════════════════ */
  const initials = user?.username?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <div className="relative min-h-screen bg-slate-50">
      {/* ambient blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <div className="absolute -right-32 -top-20 h-96 w-96 rounded-full bg-teal-200/15 blur-[120px]" />
        <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-violet-200/10 blur-[100px]" />
      </div>

      {/* ── TOPBAR ── */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          {/* brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-base font-black text-white">
              S
            </div>
            <div className="hidden sm:block leading-tight">
              <p className="text-[15px] font-bold text-slate-900">Splitwise</p>
              <p className="text-[11px] text-slate-500">AI Expense Splitter</p>
            </div>
          </div>

          {/* actions */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100 text-[11px] font-bold text-teal-700">
                {initials}
              </div>
              <span className="hidden text-sm font-semibold text-slate-700 sm:inline">
                {user?.username}
              </span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
            >
              <Ico d={P.logout} size={14} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Flash type="ok" msg={message} />
        <Flash type="error" msg={error} />

        {/* ══ ROW 1: Create Group + Your Groups ══ */}
        <div className="grid gap-5 lg:grid-cols-2">
          {/* CREATE GROUP */}
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <SHead
              icon="group"
              iconCls="bg-teal-50 text-teal-600"
              label="Create Group"
            />

            <form onSubmit={createGroup} className="space-y-4">
              <div>
                <FL>Group Name</FL>
                <input
                  className={fieldCls}
                  placeholder="e.g. Goa Trip 2025"
                  value={groupForm.name}
                  onChange={(e) =>
                    setGroupForm((p) => ({ ...p, name: e.target.value }))
                  }
                  required
                />
              </div>

              <div>
                <FL>Description</FL>
                <textarea
                  rows={2}
                  className={fieldCls + " resize-none , text-black"}
                  placeholder="Optional description…"
                  value={groupForm.description}
                  onChange={(e) =>
                    setGroupForm((p) => ({ ...p, description: e.target.value }))
                  }
                />
              </div>

              <div>
                {/* <FL>Add Members</FL>
                <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-2 space-y-0.5">
                  {users
                    .filter((u) => u._id !== user.id)
                    .map((u) => (
                      <label
                        key={u._id}
                        className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-white"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded accent-teal-600"
                          checked={groupForm.memberIds.includes(u._id)}
                          onChange={() => toggleMember(u._id)}
                        />
                        <span>
                          <span className="font-medium text-slate-800">
                            {u.username}
                          </span>
                          <span className="ml-1.5 text-slate-400">
                            ({u.email})
                          </span>
                        </span>
                      </label>
                    ))}
                  {users.filter((u) => u._id !== user.id).length === 0 && (
                    <p className="px-3 py-2 text-sm text-slate-400">
                      No other users found.
                    </p>
                  )}
                </div> */}
              </div>

              <button disabled={loading} type="submit" className={btnPrimary}>
                {loading ? "Saving…" : "Create Group"}
              </button>
            </form>
          </article>

          {/* YOUR GROUPS */}
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <SHead
              icon="folder"
              iconCls="bg-violet-50 text-violet-600"
              label="Your Groups"
              right={<Chip color="slate">{groups.length}</Chip>}
            />

            {/* horizontally scrollable on mobile, vertical on desktop */}
            <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-col sm:space-y-2 sm:overflow-visible sm:pb-0 no-scrollbar">
              {groups.map((group) => {
                const active = selectedGroup?._id === group._id;
                return (
                  <button
                    key={group._id}
                    onClick={() => setSelectedGroup(group)}
                    className={`flex shrink-0 sm:w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200
                      w-[min(82%,320px)]
                      ${
                        active
                          ? "border-transparent bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-md shadow-teal-200"
                          : "border-slate-100 bg-slate-50 hover:border-teal-200 hover:bg-teal-50/50 hover:shadow-sm"
                      }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold
                      ${active ? "bg-white/20 text-white" : "bg-white text-teal-600 border border-slate-200"}`}
                    >
                      {group.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`truncate font-semibold ${active ? "text-white" : "text-slate-800"}`}
                      >
                        {group.name}
                      </p>
                      <p
                        className={`text-xs ${active ? "text-white/70" : "text-slate-400"}`}
                      >
                        {group.members?.length ?? 0} members
                      </p>
                    </div>
                    {active && (
                      <Ico
                        d={P.chev}
                        size={14}
                        className="ml-auto text-white/60"
                      />
                    )}
                  </button>
                );
              })}
              {groups.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-10 text-center w-full">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                    <Ico d={P.plus} size={22} className="text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">
                    No groups yet
                  </p>
                  <p className="text-xs text-slate-400">
                    Create your first group on the left
                  </p>
                </div>
              )}
            </div>

            {/* ── MANAGE SELECTED GROUP ── */}
            {selectedGroup && (
              <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    Manage · {selectedGroup.name}
                  </p>
                  {isSelectedGroupAdmin && (
                    <button
                      onClick={deleteSelectedGroup}
                      className="flex items-center gap-1 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                    >
                      <Ico d={P.trash} size={12} /> Delete Group
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {currentMembers.map((m) => {
                    const isAdmin = selectedGroupAdminIds.includes(m._id);
                    return (
                      <div
                        key={m._id}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100 text-[11px] font-bold text-teal-700">
                            {m.username?.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-slate-700">
                            {m.username}
                          </span>
                          {isAdmin && <Chip color="teal">Admin</Chip>}
                        </div>
                        {isSelectedGroupAdmin && m._id !== user.id && (
                          <button
                            onClick={() => removeMemberFromSelectedGroup(m._id)}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                            aria-label="Remove member"
                          >
                            <Ico d={P.trash} size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {isSelectedGroupAdmin &&
                  availableUsersForSelectedGroup.length > 0 && (
                    <div className="mt-3 flex gap-2">
                      <select
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-3 focus:ring-teal-500/15"
                        value={groupMemberToAdd}
                        onChange={(e) => setGroupMemberToAdd(e.target.value)}
                      >
                        <option value="">Select member…</option>
                        {availableUsersForSelectedGroup.map((u) => (
                          <option key={u._id} value={u._id}>
                            {u.username}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={addMemberToSelectedGroup}
                        disabled={!groupMemberToAdd || loading}
                        className="flex items-center gap-1 rounded-xl bg-teal-600 px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:-translate-y-px hover:shadow-md disabled:opacity-50"
                      >
                        <Ico d={P.plus} size={14} /> Add
                      </button>
                    </div>
                  )}
              </div>
            )}
          </article>
        </div>

        {/* ══ GROUP-SPECIFIC PANELS ══ */}
        {selectedGroup && (
          <>
            {/* ── ROW 2: Add Expense + Expense List ── */}
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              {/* ADD EXPENSE */}
              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <SHead
                  icon="plus"
                  iconCls="bg-amber-50 text-amber-600"
                  label="Add Expense"
                  right={<Chip color="teal">{selectedGroup.name}</Chip>}
                />

                <form onSubmit={submitExpense} className="space-y-4">
                  {/* payer + amount row */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <FL>Paid by</FL>
                      <select
                        className={fieldCls}
                        value={expenseForm.payer}
                        onChange={(e) =>
                          setExpenseForm((p) => ({
                            ...p,
                            payer: e.target.value,
                          }))
                        }
                        required
                      >
                        <option value="">Select payer…</option>
                        {currentMembers.map((m) => (
                          <option key={m._id} value={m._id}>
                            {m.username}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <FL>Amount</FL>
                      <div className="flex gap-2">
                        <select
                          className="w-20 rounded-xl border border-slate-200 bg-white px-2 py-3 text-sm outline-none transition focus:border-teal-500"
                          value={expenseForm.currency}
                          onChange={(e) =>
                            setExpenseForm((p) => ({
                              ...p,
                              currency: e.target.value,
                            }))
                          }
                        >
                          {["INR", "USD", "EUR", "GBP"].map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={fieldCls}
                          placeholder="0.00"
                          value={expenseForm.amount}
                          onChange={(e) =>
                            setExpenseForm((p) => ({
                              ...p,
                              amount: e.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* description + date */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <FL>Description</FL>
                      <input
                        className={fieldCls}
                        placeholder="e.g. Dinner at Taco Bell"
                        value={expenseForm.description}
                        onChange={(e) =>
                          setExpenseForm((p) => ({
                            ...p,
                            description: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div>
                      <FL>Date</FL>
                      <input
                        type="date"
                        className={fieldCls}
                        value={expenseForm.date}
                        onChange={(e) =>
                          setExpenseForm((p) => ({
                            ...p,
                            date: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  {/* splits */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <FL>Splits (exact amounts)</FL>
                      <button
                        type="button"
                        onClick={autoEqual}
                        className="flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-100"
                      >
                        <Ico d={P.eq} size={12} /> Equal
                      </button>
                    </div>

                    <div className="space-y-2">
                      {expenseForm.splits.map((split, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <select
                            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-500"
                            value={split.user}
                            onChange={(e) =>
                              updateSplit(i, "user", e.target.value)
                            }
                          >
                            <option value="">Member…</option>
                            {currentMembers.map((m) => (
                              <option key={m._id} value={m._id}>
                                {m.username}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 transition focus:border-teal-500"
                            placeholder="0.00"
                            value={split.value}
                            onChange={(e) =>
                              updateSplit(i, "value", e.target.value)
                            }
                          />
                          {expenseForm.splits.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSplitRow(i)}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                            >
                              <Ico d={P.trash} size={15} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={addSplitRow}
                      className="mt-2 flex items-center gap-1 text-xs font-semibold text-teal-600 transition hover:text-teal-800"
                    >
                      <Ico d={P.plus} size={13} /> Add split row
                    </button>
                  </div>

                  <button
                    disabled={loading}
                    type="submit"
                    className={btnPrimary}
                  >
                    {loading ? "Adding…" : "Add Expense"}
                  </button>
                </form>
              </article>

              {/* EXPENSE LIST + SETTLEMENTS */}
              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <SHead
                  icon="bill"
                  iconCls="bg-rose-50 text-rose-500"
                  label="Expenses"
                  right={<Chip color="slate">{expenses.length}</Chip>}
                />

                {expenses.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                      <Ico d={P.bill} size={22} className="text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">
                      No expenses yet
                    </p>
                    <p className="text-xs text-slate-400">
                      Add your first expense on the left
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[480px] space-y-3 overflow-y-auto pr-0.5">
                    {expenses.map((exp) => (
                      <div
                        key={exp._id}
                        className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">
                              {exp.description}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              Paid by{" "}
                              <span className="font-medium text-slate-700">
                                {exp.payer?.username ?? "?"}
                              </span>
                              {exp.date &&
                                ` · ${new Date(exp.date).toLocaleDateString()}`}
                            </p>
                          </div>
                          <p className="shrink-0 text-lg font-extrabold text-slate-900">
                            {sym(exp.currency)}
                            {Number(exp.amount).toLocaleString()}
                          </p>
                        </div>
                        {exp.splits?.length > 0 && (
                          <>
                            <div className="my-3 border-t border-slate-100" />
                            <div className="flex flex-wrap gap-1.5">
                              {exp.splits.map((s) => (
                                <div
                                  key={s.user?._id ?? s.user}
                                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                                >
                                  <span className="font-medium text-slate-700">
                                    {s.user?.username ?? "?"}
                                  </span>
                                  <span className="text-slate-300">·</span>
                                  <span className="font-bold text-teal-700">
                                    {sym(exp.currency)}
                                    {Number(s.value).toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* SETTLEMENTS */}
                {settlements.length > 0 && (
                  <div className="mt-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Ico d={P.settle} size={14} className="text-slate-400" />
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        Suggested Settlements
                      </p>
                    </div>
                    <div className="space-y-2">
                      {settlements.map((s, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5"
                        >
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-semibold text-rose-600">
                              {getMemberName(s.from)}
                            </span>
                            <Ico
                              d={P.arrow}
                              size={13}
                              className="text-slate-400"
                            />
                            <span className="font-semibold text-teal-700">
                              {getMemberName(s.to)}
                            </span>
                          </div>
                          <span className="rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1 text-sm font-bold text-amber-700">
                            ₹{s.amt.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            </div>

            {/* ── ROW 3: AI CARD (dark) ── */}
            <div className="mt-5 overflow-hidden rounded-2xl bg-slate-900 shadow-xl">
              <div className="p-6">
                {/* header */}
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                    <Ico d={P.spark} size={18} className="text-teal-400" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold text-white">
                      AI Assistant
                    </h2>
                    <p className="text-[11px] text-white/40">
                      Smart expense parsing · Bill scanning
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  {/* ── AI Expense Parser ── */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/40">
                      Natural Language Parser
                    </p>
                    <textarea
                      rows={3}
                      className="w-full resize-none rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-black placeholder:text-white/25 outline-none transition focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20"
                      placeholder="e.g. Priya paid 1200 for dinner, split equally among all."
                      value={aiExpenseText}
                      onChange={(e) => setAiExpenseText(e.target.value)}
                    />
                    <button
                      onClick={parseExpenseWithAI}
                      disabled={loading || !aiExpenseText.trim()}
                      className="mt-3 w-full rounded-xl bg-teal-600/80 py-2.5 text-sm font-bold text-white transition hover:bg-teal-500 disabled:opacity-50"
                    >
                      {loading ? "Parsing…" : "Parse with AI →"}
                    </button>

                    {/* draft */}
                    {aiExpenseDraft && (
                      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                          Draft Preview
                        </p>
                        <div className="space-y-1 text-sm">
                          <p className="text-white/80">
                            <span className="text-white/40">Desc: </span>
                            {aiExpenseDraft.description}
                          </p>
                          <p className="text-white/80">
                            <span className="text-white/40">Amount: </span>
                            {aiExpenseDraft.currency} {aiExpenseDraft.amount}
                          </p>
                          <p className="text-white/80">
                            <span className="text-white/40">Payer: </span>
                            {currentMembers.find(
                              (m) => m._id === aiExpenseDraft.payer,
                            )?.username ?? aiExpenseDraft.payer}
                          </p>
                        </div>
                        {aiExpenseValidationErrors.length > 0 && (
                          <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                            {aiExpenseValidationErrors.join(" · ")}
                          </div>
                        )}
                        {aiExpenseMeta?.confidence && (
                          <p className="mt-2 text-xs text-white/30">
                            Confidence:{" "}
                            {Math.round(aiExpenseMeta.confidence * 100)}%
                          </p>
                        )}
                        <button
                          onClick={applyAiExpenseDraft}
                          className="mt-3 w-full rounded-xl border border-teal-500/30 bg-teal-500/20 py-2 text-sm font-bold text-teal-400 transition hover:bg-teal-500/30"
                        >
                          Apply to Form
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ── Bill Scanner ── */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/40">
                      Bill Scanner
                    </p>

                    {/* text paste */}
                    <textarea
                      rows={2}
                      className="w-full resize-none rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-black placeholder:text-white/25 outline-none transition focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                      placeholder="Paste bill text here…"
                      value={aiBillText}
                      onChange={(e) => setAiBillText(e.target.value)}
                    />
                    <button
                      onClick={parseBillWithAI}
                      disabled={loading || !aiBillText.trim()}
                      className="mt-2 w-full rounded-xl bg-violet-600/70 py-2.5 text-sm font-bold text-white transition hover:bg-violet-500 disabled:opacity-50"
                    >
                      Parse Bill Text →
                    </button>

                    {/* image upload */}
                    <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/5 px-4 py-3 text-sm text-white/50 transition hover:border-white/30 hover:text-white/70">
                      <Ico d={P.img} size={15} />
                      {aiBillImageFile
                        ? aiBillImageFile.name
                        : "Upload bill image (OCR)"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          setAiBillImageFile(e.target.files?.[0] || null)
                        }
                      />
                    </label>
                    {aiBillImageFile && (
                      <button
                        onClick={parseBillImageWithAI}
                        disabled={loading}
                        className="mt-2 w-full rounded-xl bg-violet-600/70 py-2.5 text-sm font-bold text-white transition hover:bg-violet-500 disabled:opacity-50"
                      >
                        Scan Image with OCR →
                      </button>
                    )}

                    {/* OCR raw text */}
                    {aiBillOcrText && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs text-white/40 hover:text-white/60">
                          View raw OCR output
                        </summary>
                        <pre className="mt-2 max-h-32 overflow-auto rounded-xl bg-black/30 p-3 text-xs text-white/60 whitespace-pre-wrap">
                          {aiBillOcrText}
                        </pre>
                      </details>
                    )}

                    {/* line-item assignment */}
                    {aiBillResult?.bill?.lineItems?.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                          Assign line items to members
                        </p>
                        <div className="max-h-56 space-y-2 overflow-y-auto">
                          {aiBillResult.bill.lineItems.map((item, idx) => (
                            <div
                              key={idx}
                              className="rounded-xl border border-white/10 bg-white/5 p-3"
                            >
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-white">
                                  {item.name}
                                </p>
                                <span className="text-sm font-bold text-amber-400">
                                  {sym(aiBillResult.bill.currency)}
                                  {Number(item.amount).toLocaleString()}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {currentMembers.map((m) => {
                                  const on = billAssignments[
                                    idx
                                  ]?.users?.includes(m._id);
                                  return (
                                    <button
                                      key={m._id}
                                      type="button"
                                      onClick={() =>
                                        toggleBillItemUser(idx, m._id)
                                      }
                                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition
                                        ${
                                          on
                                            ? "bg-teal-500 text-white"
                                            : "bg-white/10 text-white/50 hover:bg-white/20 hover:text-white"
                                        }`}
                                    >
                                      {m.username}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* summary + apply */}
                        <div className="mt-3 flex items-center justify-between">
                          <p className="text-xs text-white/40">
                            Assigned:{" "}
                            <span className="font-bold text-white/70">
                              {sym(aiBillResult.bill.currency)}
                              {billSplitSummary.assignedTotal.toFixed(2)}
                            </span>
                            {" / "}
                            {sym(aiBillResult.bill.currency)}
                            {Number(aiBillResult.bill.total).toFixed(2)}
                          </p>
                          <button
                            onClick={applyBillToExpenseForm}
                            disabled={billSplitSummary.splits.length === 0}
                            className="rounded-xl bg-amber-500/80 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-500 disabled:opacity-50"
                          >
                            Apply to Form
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
