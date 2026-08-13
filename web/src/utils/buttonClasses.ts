export const btn = {
  add: "inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",

  edit: "rounded p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors",
  delete: "rounded p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors",
  save: "rounded p-1 text-emerald-600 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors",
  cancel: "rounded p-1 text-slate-400 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors",

  modalSubmit:
    "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
  modalCancel:
    "rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",

  tab: (active: boolean, color: string) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
      active
        ? `bg-gradient-to-r ${color} text-white shadow-lg`
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
    } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`,

  export:
    "inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
  import:
    "inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
};
