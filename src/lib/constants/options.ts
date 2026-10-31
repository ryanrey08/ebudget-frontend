import { ALLOTMENT_CLASSES } from "./allotment-classes";

export const ALLOTMENT_CLASS_OPTIONS = ALLOTMENT_CLASSES.map((c) => ({ value: c.code, label: c.code }));
export const QUARTER_OPTIONS = ["Q1", "Q2", "Q3", "Q4"].map((q) => ({ value: q, label: q }));
export const toOptions = <T extends string>(values: readonly T[]) => values.map((v) => ({ value: v, label: v }));
