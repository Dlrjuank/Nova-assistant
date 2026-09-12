export interface CollectionMeta {
  version: number;
  lastModified: string;
  description: string;
}

export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionFile<T extends BaseRecord = BaseRecord> {
  _meta: CollectionMeta;
  records: T[];
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface QueryResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export type CreateInput<T extends BaseRecord> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateInput<T extends BaseRecord> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;
