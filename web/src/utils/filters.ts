export function addSoftDeleteFilter(filter?: string): string {
  const base = "is_deleted=false";
  return filter ? `${base} && ${filter}` : base;
}
