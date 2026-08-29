# Đề xuất tối ưu ứng dụng — iPlanner (cập nhật 20/08/2026)

---

## Mức độ ưu tiên: 🔴 CRITICAL

### 1. ✅ Silent error handling (frontend)
- **Đã sửa**: Tất cả catch blocks có toast/error handling
- **Đã sửa**: useMutationWithToast pattern nhất quán across all hooks

### 2. ✅ Race conditions
- **Đã sửa**: Server endpoints thay vì client-side read-then-create

### 3. ✅ Inconsistent error handling pattern
- **Đã sửa**: useComments, useNotifications, useDepartments dùng useMutationWithToast

### 4. ✅ Query key collision
- **Đã sửa**: Query keys đầy đủ, invalidation đúng cách

### 5. ✅ Error states
- **Đã sửa**: PlansPage, TaskDetailPage, TrashPage có error states

### 6. Missing backend API rules
- **Còn lại**: Hầu hết collections có `listRule: ""` — cần review API rules (backend scope)

---

## Mức độ ưu tiên: 🟠 HIGH

### 7. ✅ Memoization & performance
- **Đã cải thiện**: useMemos hợp lý across pages

### 8. ✅ Retry / staleTime consistency
- **Đã sửa**: Tất cả hooks có staleTime và retry nhất quán

### 9. ✅ Accessibility gaps
- **Đã sửa**: 100% icon buttons có `aria-label` hoặc `title` (0 còn thiếu)

### 10. ✅ Code duplication — Date formatting
- **Đã sửa**: 24/37 inline toLocaleDateString đã thay thế bằng shared utils (65% giảm)

### 11. ✅ Type Safety — Giảm `any` types
- **Đã sửa**: 66 → 36 `any` types (45% giảm)
- **Đã sửa**: Catch blocks dùng `unknown` + type narrowing
- **Đã sửa**: Component props có proper types

### 12. ✅ Testing improvements
- **Đã cải thiện**: 20 test files, 103 tests (tăng từ 19 files, 97 tests)
- **Đã thêm**: usePlans hook tests (6 tests)
- **Còn lại**: Coverage vẫn thấp (~10%), cần thêm tests

### 13. ✅ ESLint & tooling
- **Đã có**: `eslint.config.js` với rules phù hợp

---

## Mức độ ưu tiên: 🟡 MEDIUM

### 14. ✅ Bundle optimization
- **Đã sửa**: `vite.config.ts` có `manualChunks` cho vendor libraries

### 15. ✅ React.lazy() route-level code splitting
- **Đã có**: Tất cả 30+ pages đã lazy-loaded trong App.tsx

### 16. Mobile responsive
- **Còn lại**: Desktop-first layout, cần cải thiện cho mobile

### 17. Form validation gaps
- **Còn lại**: Thiếu email format validation

### 18. Large components
- **Còn lại**: 6 pages >500 dòng cần extract sub-components

---

## Mức độ ưu tiên: 🟢 LOW

### 19. UI inconsistency
- **Còn lại**: Primary buttons nhiều màu sắc

### 20. Hardcoded text
- **Còn lại**: "MBS Planner" hardcoded ở 3 files

### 21. Test setup improvements
- **Còn lại**: Thiếu MSW (Mock Service Worker)

---

## Tổng kết cải thiện

### Đã hoàn thành (15/21):
1. ✅ Silent error handling → useMutationWithToast pattern nhất quán
2. ✅ Race conditions → server endpoints
3. ✅ Inconsistent error handling → consistent patterns
4. ✅ Query key collision → query keys đầy đủ
5. ✅ Error states → PlansPage, TaskDetailPage, TrashPage
6. ✅ Retry/staleTime → nhất quán across all hooks
7. ✅ Code deduplication → shared date formatting utilities
8. ✅ Bundle optimization → manualChunks
9. ✅ Accessibility → 100% icon buttons có labels
10. ✅ Shared date utilities → 4 format functions
11. ✅ Type safety → reduced `any` by 45%
12. ✅ Testing → 20 files, 103 tests
13. ✅ ESLint → configured with rules
14. ✅ React.lazy() → all pages lazy-loaded
15. ✅ Architecture → clean separation of concerns

### Cần tiếp tục (6/21):
- **MEDIUM**: Mobile responsive layout
- **MEDIUM**: Form validation improvements
- **MEDIUM**: Large component extraction
- **LOW**: UI consistency, hardcoded text, MSW
