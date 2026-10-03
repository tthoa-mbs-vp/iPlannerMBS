/**
 * Kiểu dữ liệu cho schema-defs.mjs.
 *
 * Tách riêng vì tsc cấu hình `include: ["src"]` và không tự suy ra kiểu cho file
 * .mjs; test trong src/ cần import nó để kiểm tra schema không lệch.
 */

export interface SchemaField {
  id: string;
  name: string;
  type: string;
  required: boolean;
  [key: string]: unknown;
}

export interface SchemaCollection {
  id: string;
  name: string;
  type: string;
  listRule: string;
  viewRule: string;
  createRule: string;
  updateRule: string;
  deleteRule: string;
  fields: SchemaField[];
}

export interface PostPatch {
  collection: string;
  fields: SchemaField[];
}

type FieldOpts = { required?: boolean; max?: number; min?: number; maxSelect?: number; onlyInt?: boolean; [key: string]: unknown };

export declare const text: (id: string, name: string, opts?: FieldOpts) => SchemaField;
export declare const fieldEmail: (id: string, name: string, opts?: FieldOpts) => SchemaField;
export declare const fieldPassword: (id: string, name: string, opts?: FieldOpts) => SchemaField;
export declare const number: (id: string, name: string, opts?: FieldOpts) => SchemaField;
export declare const bool: (id: string, name: string, opts?: FieldOpts) => SchemaField;
export declare const date: (id: string, name: string, opts?: FieldOpts) => SchemaField;
export declare const select: (id: string, name: string, values: string[], opts?: FieldOpts) => SchemaField;
export declare const relation: (id: string, name: string, collectionId: string, opts?: FieldOpts) => SchemaField;
export declare const file: (id: string, name: string, opts?: FieldOpts) => SchemaField;
export declare const editor: (id: string, name: string, opts?: FieldOpts) => SchemaField;
export declare const json: (id: string, name: string, opts?: FieldOpts) => SchemaField;

export declare const USERS_ID: string;
export declare const CHAT_MIME: string[];
export declare const AVATAR_MIME: string[];
export declare const taskStatus: string[];
export declare const planStatus: string[];
export declare const canManage: (rule?: string) => string;
export declare const authUser: (rule?: string) => string;

export declare const collections: SchemaCollection[];
export declare const postPatches: PostPatch[];
export declare const PREREQ_NAMES: string[];

export declare function collectionByName(name: string): SchemaCollection | undefined;
export declare function fullSchema(): SchemaCollection[];