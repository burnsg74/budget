export type GridRow = {
  id: string | number;
  href?: string;
  estimated?: boolean;
  sortKey?: string;
} & Record<string, string | number | boolean | null | undefined>;

export type GridColumn = {
  field: string;
  header: string;
  width?: number;
  minWidth?: number;
  flex?: number;
  align?: "left" | "right";
  kind?: "text" | "money" | "moneySigned";
  sort?: "asc" | "desc";
  hide?: boolean;
};
