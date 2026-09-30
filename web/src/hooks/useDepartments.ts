import { useQuery } from "@tanstack/react-query";
import { pb } from "../api/client";
import { useMutationWithToast } from "../hooks/useMutationWithToast";
import type { Department, Role, User } from "@shared/types";

/**
 * Writable shape of a department.
 *
 * The read model (`Department`) is not directly usable as a write model: a
 * relation field is simply optional when reading, but clearing it requires an
 * explicit null, which PocketBase only accepts on write.
 */
export type DepartmentInput = Omit<Partial<Department>, "leader_id"> & {
  leader_id?: string | null;
};

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: () => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      return pb.collection("departments").getFullList<Department>({
        sort: "code",
        expand: "leader_id",
      });
    },
    staleTime: 120_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}

export function useCreateDepartment() {
  return useMutationWithToast(
    (data: DepartmentInput) => pb.collection("departments").create(data),
    {
      successMessage: "Tạo phòng ban thành công",
      invalidateKeys: [["departments"]],
    }
  );
}

export function useUpdateDepartment() {
  return useMutationWithToast(
    ({ id, data }: { id: string; data: DepartmentInput }) =>
      pb.collection("departments").update(id, data),
    {
      successMessage: "Cập nhật phòng ban thành công",
      invalidateKeys: [["departments"]],
    }
  );
}

export function useDeleteDepartment() {
  return useMutationWithToast(
    (id: string) => pb.collection("departments").delete(id),
    {
      successMessage: "Xóa phòng ban thành công",
      invalidateKeys: [["departments"]],
    }
  );
}

export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: () => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      return pb.collection("roles").getFullList<Role>({ sort: "code" });
    },
    staleTime: 120_000,
  });
}

export function useCreateRole() {
  return useMutationWithToast(
    (data: Partial<Role>) => pb.collection("roles").create(data),
    {
      successMessage: "Tạo chức vụ thành công",
      invalidateKeys: [["roles"]],
    }
  );
}

export function useUpdateRole() {
  return useMutationWithToast(
    ({ id, data }: { id: string; data: Partial<Role> }) =>
      pb.collection("roles").update(id, data),
    {
      successMessage: "Cập nhật chức vụ thành công",
      invalidateKeys: [["roles"]],
    }
  );
}

export function useDeleteRole() {
  return useMutationWithToast(
    (id: string) => pb.collection("roles").delete(id),
    {
      successMessage: "Xóa chức vụ thành công",
      invalidateKeys: [["roles"]],
    }
  );
}

export function useUsers() {
  return useQuery({
    queryKey: ["users", "active"],
    queryFn: () => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      return pb.collection("users").getFullList<User>({
        filter: "disabled=false",
        expand: "department_id,role_id,group_ids",
      });
    },
    staleTime: 120_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}

export function useAdminUsersPaginated({
  page,
  perPage,
  search,
  deptFilter,
  groupFilter,
  roleFilter,
}: {
  page: number;
  perPage: number;
  search?: string;
  deptFilter?: string;
  groupFilter?: string;
  roleFilter?: string;
}) {
  return useQuery({
    queryKey: ["users", "paginated", page, perPage, search, deptFilter, groupFilter, roleFilter],
    queryFn: async () => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      const filterParts: string[] = [];
      if (search) {
        const escaped = search.replace(/[~%"]/g, "\\$&");
        filterParts.push(`(name ~ "%${escaped}%" || email ~ "%${escaped}%")`);
      }
      if (deptFilter) {
        filterParts.push(`department_id = "${deptFilter}"`);
      }
      if (groupFilter) {
        filterParts.push(`group_ids ~ "${groupFilter}"`);
      }
      if (roleFilter) {
        filterParts.push(`role_id = "${roleFilter}"`);
      }
      const filter = filterParts.length > 0 ? filterParts.join(" && ") : undefined;
      return pb.collection("users").getList<User>(page, perPage, {
        sort: "-created",
        expand: "department_id,role_id,group_ids",
        filter,
      });
    },
    staleTime: 60_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}
