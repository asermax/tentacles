// drizzle-kit's durable-sqlite output: the journal and each migration's SQL, which a bundle that
// imports this file loads as text.
declare const migrations: {
  readonly journal: {
    readonly entries: Array<{ idx: number; when: number; tag: string; breakpoints: boolean }>;
  };
  readonly migrations: Record<string, string>;
};

export default migrations;
