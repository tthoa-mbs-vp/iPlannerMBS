import CheckCombobox from "./CheckCombobox";

interface UserBrief {
  id: string;
  name?: string;
  email?: string;
}

interface Props {
  users: UserBrief[];
  selected: string[];
  onToggle: (id: string) => void;
  excludeIds?: string[];
  accentColor?: string;
  size?: "sm" | "md";
  maxHeight?: string;
}

export default function CollaboratorSelect({ users, selected, onToggle, excludeIds = [], accentColor = "indigo", size = "sm" }: Props) {
  const filtered = users.filter((u) => !excludeIds.includes(u.id));
  if (!filtered.length) return null;

  return (
    <CheckCombobox
      items={filtered.map((u) => ({ id: u.id, label: u.name || u.email || u.id }))}
      selected={selected}
      onToggle={onToggle}
      label="Người phối hợp"
      placeholder="Chọn người phối hợp..."
      accentColor={accentColor}
      size={size}
    />
  );
}
