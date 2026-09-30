import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { pb, getUserAvatar } from "../api/client";
import { useEmployeeProfile, useUpsertEmployeeProfile } from "../hooks/useEmployeeProfiles";
import { useAuthStore } from "../stores/authStore";
import { usePageTitleStore } from "../stores/pageTitleStore";
import {
  User as UserIcon, Briefcase, CreditCard, Pencil, Save, Loader2, GraduationCap, DollarSign, Key, UserCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { errorMessage } from "../utils/errors";
import QualificationsTab from "../components/hr/QualificationsTab";
import SalaryHistoryTab from "../components/hr/SalaryHistoryTab";
import { validatePassword } from "@shared/validators";
import WorkHistoryTab from "../components/hr/WorkHistoryTab";
import { formatDate, toInputDate, contractTypes, contractLabel } from "../utils/format";
import type { User } from "@shared/types";

type PageTab = "general" | "qualifications" | "work" | "salary";

const tabs: { key: PageTab; label: string; icon: LucideIcon; color: string }[] = [
  { key: "general", label: "Thông tin chung", icon: UserIcon, color: "from-blue-500 to-indigo-600" },
  { key: "qualifications", label: "Chuyên môn nghiệp vụ", icon: GraduationCap, color: "from-amber-500 to-orange-600" },
  { key: "work", label: "Quá trình công tác", icon: Briefcase, color: "from-cyan-500 to-sky-600" },
  { key: "salary", label: "Quá trình lương", icon: DollarSign, color: "from-emerald-500 to-teal-600" },
];

const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-colors dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:focus:ring-indigo-900/40";
const readonlyCls = "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";

function Field({ label, value, editValue, onChange, type, selectOptions, editing }: {
  label: string; value: string; editValue?: string; onChange?: (v: string) => void; type?: string; selectOptions?: { value: string; label: string }[]; editing: boolean;
}) {
  const isEditable = editing && !!onChange;
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">{label}</label>
      {isEditable ? (
        selectOptions ? (
          <select value={editValue ?? ""} onChange={(e) => onChange(e.target.value)} className={inputCls}>
            <option value="">— Chọn —</option>
            {selectOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <input type={type} value={editValue ?? ""} onChange={(e) => onChange(e.target.value)} className={inputCls} />
        )
      ) : (
        <div className={readonlyCls}>{value || "—"}</div>
      )}
    </div>
  );
}

function CardSection({ icon: Icon, title, gradient, children, actions }: { icon: LucideIcon; title: string; gradient: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
      <div className={`flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-gradient-to-r ${gradient} dark:border-slate-700`}>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 shadow-sm dark:bg-white/10">
            <Icon className="h-3.5 w-3.5 text-slate-700 dark:text-slate-200" />
          </div>
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</h3>
        </div>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function HRDetailPage() {
  const { id } = useParams<{ id: string }>();
  const authUser = useAuthStore((s) => s.user);
  const role = authUser?.expand?.role_id;
  const canManage = !!role?.can_manage;
  const canViewSalary = !!role?.can_view_salary;
  const isSelf = !!authUser && authUser.id === id;
  const canAccess = canManage || canViewSalary || isSelf;
  const canEditHr = canManage || isSelf;

  const { data: profile, isLoading: profileLoading } = useEmployeeProfile(id);
  const upsert = useUpsertEmployeeProfile();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageTab, setPageTab] = useState<PageTab>("general");
  const [mountedTabs, setMountedTabs] = useState<Set<PageTab>>(() => new Set(["general"]));
  const [prevId, setPrevId] = useState<string | undefined>(id);
  if (id !== prevId) {
    setPrevId(id);
    setMountedTabs(new Set(["general"]));
    setPageTab("general");
  }

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["user", id],
    queryFn: async () => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      return pb.collection("users").getOne<User>(id!, {
        expand: "department_id,role_id",
      });
    },
    enabled: !!id,
    retry: 3,
  });

  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [identityCard, setIdentityCard] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankName, setBankName] = useState("");
  const [joinDate, setJoinDate] = useState("");
  const [contractType, setContractType] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");

  const [syncedProfileId, setSyncedProfileId] = useState<string | null>(null);
  if (profile && profile.id !== syncedProfileId) {
    setSyncedProfileId(profile.id);
    setPhone(profile.phone || "");
    setDob(toInputDate(profile.dob));
    setIdentityCard(profile.identity_card || "");
    setTaxCode(profile.tax_code || "");
    setBankAccount(profile.bank_account || "");
    setBankName(profile.bank_name || "");
    setJoinDate(toInputDate(profile.join_date));
    setContractType(profile.contract_type || "");
    setEmergencyContact(profile.emergency_contact || "");
  }

  const [editName, setEditName] = useState("");
  const [editReminder, setEditReminder] = useState(2);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [syncedUserId, setSyncedUserId] = useState<string | null>(null);
  if (user && user.id !== syncedUserId) {
    setSyncedUserId(user.id);
    setEditName(user.name || "");
    setEditReminder(user.reminder_days ?? 2);
  }
  const qc = useQueryClient();
  const checkAuth = useAuthStore((s) => s.checkAuth);

  const handleSaveAccount = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await pb.collection("users").update(id, {
        name: editName || undefined,
        reminder_days: editReminder,
      });
      if (isSelf) await checkAuth();
      qc.invalidateQueries({ queryKey: ["user", id] });
    } catch (err: unknown) {
      alert(errorMessage(err, "Lỗi"));
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!id) return;
    if (!oldPassword || !newPassword) { alert("Vui lòng nhập đầy đủ mật khẩu"); return; }
    const pwError = validatePassword(newPassword);
    if (pwError) { alert(pwError); return; }
    setPwSaving(true);
    try {
      await pb.collection("users").update(id, {
        oldPassword,
        password: newPassword,
        passwordConfirm: newPassword,
      });
      setOldPassword("");
      setNewPassword("");
      setChangingPw(false);
    } catch (err: unknown) {
      alert(errorMessage(err, "Lỗi khi đổi mật khẩu"));
    }
    setPwSaving(false);
  };

  const avatarUrl = user ? getUserAvatar(user) : undefined;

  useEffect(() => {
    if (user) {
      usePageTitleStore.getState().setConfig({
        title: "Thông tin nhân sự",
        backTo: "/hr",
      });
    }
    return () => { usePageTitleStore.getState().clear(); };
  }, [user]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await upsert.mutateAsync({
        userId: id,
        data: {
          phone: phone || undefined,
          dob: dob || undefined,
          identity_card: identityCard || undefined,
          tax_code: taxCode || undefined,
          bank_account: bankAccount || undefined,
          bank_name: bankName || undefined,
          join_date: joinDate || undefined,
          contract_type: contractType || undefined,
          emergency_contact: emergencyContact || undefined,
        },
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const isLoading = userLoading || profileLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center py-12 text-red-500">
        <UserIcon className="mb-3 h-10 w-10" />
        <p className="text-sm font-medium">Không thể tải thông tin nhân viên</p>
      </div>
    );
  }

  if (!canAccess) {
    return <Navigate to="/hr" replace />;
  }

  return (
    <div className="flex h-full flex-col gap-5 min-w-0">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-indigo-200 dark:ring-indigo-900" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-lg font-bold text-white shadow-md">
              {(user.name || user.email).charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{user.name || user.email}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {user.expand?.department_id?.name || ""}
              {user.expand?.department_id?.name && user.expand?.role_id?.name ? " · " : ""}
              {user.expand?.role_id?.name || ""}
            </p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50/50 p-1 w-fit dark:border-slate-700 dark:bg-slate-800/60">
        {tabs.filter((t) => t.key === "general" || canViewSalary || canManage).map((tab) => {
          const Icon = tab.icon;
          const isActive = pageTab === tab.key;
          return (
            <button key={tab.key} onClick={() => { setMountedTabs((prev) => new Set(prev).add(tab.key)); setPageTab(tab.key); }}
              className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
                isActive
                  ? `bg-gradient-to-r ${tab.color} text-white shadow-lg`
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}>
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        <div className={pageTab === "general" ? "block" : "hidden"}>
          {mountedTabs.has("general") && (
          <div className="space-y-5">
            <CardSection icon={UserIcon} title="Thông tin cá nhân" gradient="from-blue-50 to-cyan-50"
              actions={!editing ? (
                canEditHr ? (
                  <button onClick={() => setEditing(true)}
                    className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors">
                    <Pencil className="h-3.5 w-3.5" /> Sửa
                  </button>
                ) : null
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Lưu
                  </button>
                  <button onClick={() => setEditing(false)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">Hủy</button>
                </div>
              )}>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email" value={user.email} editing={editing} />
                <Field label="Số điện thoại" value={phone} editValue={phone} onChange={setPhone} type="tel" editing={editing} />
                <Field label="Ngày sinh" value={formatDate(dob)} editValue={dob} onChange={setDob} type="date" editing={editing} />
                <Field label="CMND / CCCD" value={identityCard} editValue={identityCard} onChange={setIdentityCard} editing={editing} />
              </div>
            </CardSection>

            {canEditHr && (
              <CardSection icon={UserCog} title="Tài khoản" gradient="from-violet-50 to-purple-50">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Họ tên" value={user.name || "—"} editValue={editName} onChange={setEditName} editing={editing} />
                  <Field label="Nhắc hạn trước (ngày)" value={`${user.reminder_days ?? 2} ngày`} editValue={String(editReminder)} onChange={(v) => { const n = parseInt(v, 10); setEditReminder(isNaN(n) ? 0 : n); }} type="number" editing={editing} />
                </div>
                {editing && (
                  <div className="mt-4 flex items-center gap-2">
                    <button onClick={handleSaveAccount} disabled={saving}
                      className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Lưu tài khoản
                    </button>
                  </div>
                )}
                {isSelf && (
                  <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <Key className="mr-1.5 inline h-4 w-4" /> Mật khẩu
                      </h4>
                      {!changingPw && (
                        <button onClick={() => setChangingPw(true)}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors dark:text-indigo-300 dark:hover:text-indigo-200">
                          Đổi mật khẩu
                        </button>
                      )}
                    </div>
                    {changingPw && (
                      <div className="mt-3 space-y-3">
                        <Field label="Mật khẩu hiện tại" value="" editValue={oldPassword} onChange={setOldPassword} type="password" editing />
                        <Field label="Mật khẩu mới" value="" editValue={newPassword} onChange={setNewPassword} type="password" editing />
                        <div className="flex gap-2">
                          <button onClick={handleChangePassword} disabled={pwSaving}
                            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                            {pwSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            {pwSaving ? "Đang đổi..." : "Xác nhận"}
                          </button>
                          <button onClick={() => { setChangingPw(false); setOldPassword(""); setNewPassword(""); }}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
                            Hủy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardSection>
            )}

            <CardSection icon={Briefcase} title="Công việc" gradient="from-amber-50 to-orange-50">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Phòng ban" value={user.expand?.department_id?.name || "—"} editing={editing} />
                <Field label="Chức vụ" value={user.expand?.role_id?.name || "—"} editing={editing} />
                <Field label="Ngày vào làm" value={formatDate(joinDate)} editValue={joinDate} onChange={setJoinDate} type="date" editing={editing} />
                <Field label="Loại hợp đồng" value={contractLabel(contractType)} editValue={contractType} onChange={setContractType} selectOptions={contractTypes} editing={editing} />
              </div>
            </CardSection>

            <CardSection icon={CreditCard} title="Tài chính & Liên hệ khẩn cấp" gradient="from-emerald-50 to-teal-50">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Mã số thuế" value={taxCode} editValue={taxCode} onChange={setTaxCode} editing={editing} />
                <Field label="Số tài khoản ngân hàng" value={bankAccount} editValue={bankAccount} onChange={setBankAccount} editing={editing} />
                <Field label="Tên ngân hàng" value={bankName} editValue={bankName} onChange={setBankName} editing={editing} />
                <Field label="Liên hệ khẩn cấp" value={emergencyContact} editValue={emergencyContact} onChange={setEmergencyContact} editing={editing} />
              </div>
            </CardSection>
          </div>
          )}
        </div>

        <div className={pageTab === "qualifications" ? "block" : "hidden"}>
          {mountedTabs.has("qualifications") && id && <QualificationsTab userId={id} canEdit={canManage} />}
        </div>

        <div className={pageTab === "work" ? "block" : "hidden"}>
          {mountedTabs.has("work") && id && <WorkHistoryTab userId={id} canEdit={canManage} />}
        </div>

        <div className={pageTab === "salary" ? "block" : "hidden"}>
          {mountedTabs.has("salary") && id && <SalaryHistoryTab userId={id} canEdit={canManage} />}
        </div>
      </div>
    </div>
  );
}
