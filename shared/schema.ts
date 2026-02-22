import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, decimal, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const cases = pgTable("cases", {
  id: serial("id").primaryKey(),
  state: varchar("state", { length: 2 }).notNull(),
  moveOutDate: text("move_out_date").notNull(),
  depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }).notNull(),
  amountReturned: decimal("amount_returned", { precision: 10, scale: 2 }).default("0"),
  landlordName: varchar("landlord_name", { length: 255 }),
  landlordAddress: text("landlord_address"),
  tenantName: varchar("tenant_name", { length: 255 }),
  tenantAddress: text("tenant_address"),
  propertyAddress: text("property_address"),
  tenancyStart: text("tenancy_start"),
  status: varchar("status", { length: 50 }).default("intake").notNull(),
  potentialRecovery: decimal("potential_recovery", { precision: 10, scale: 2 }),
  daysPastDeadline: integer("days_past_deadline"),
  paid: boolean("paid").default(false).notNull(),
  stripeSessionId: text("stripe_session_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const deductions = pgTable("deductions", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  description: varchar("description", { length: 255 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  disputeReason: text("dispute_reason"),
  status: varchar("status", { length: 50 }).default("disputed").notNull(),
});

export const letters = pgTable("letters", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  paralegalOutput: jsonb("paralegal_output"),
  attorneyOutput: jsonb("attorney_output"),
  draftHtml: text("draft_html"),
  finalHtml: text("final_html"),
  confidenceScore: integer("confidence_score"),
  generatedAt: timestamp("generated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const signatures = pgTable("signatures", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  signatureBase64: text("signature_base64").notNull(),
  signedAt: timestamp("signed_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertCaseSchema = createInsertSchema(cases).omit({
  id: true,
  createdAt: true,
  status: true,
  potentialRecovery: true,
  daysPastDeadline: true,
  paid: true,
  stripeSessionId: true,
});

export const insertDeductionSchema = createInsertSchema(deductions).omit({
  id: true,
  status: true,
});

export const insertLetterSchema = createInsertSchema(letters).omit({
  id: true,
  generatedAt: true,
});

export const insertSignatureSchema = createInsertSchema(signatures).omit({
  id: true,
  signedAt: true,
});

export type Case = typeof cases.$inferSelect;
export type InsertCase = z.infer<typeof insertCaseSchema>;
export type Deduction = typeof deductions.$inferSelect;
export type InsertDeduction = z.infer<typeof insertDeductionSchema>;
export type Letter = typeof letters.$inferSelect;
export type InsertLetter = z.infer<typeof insertLetterSchema>;
export type Signature = typeof signatures.$inferSelect;
export type InsertSignature = z.infer<typeof insertSignatureSchema>;

export interface StateLaw {
  state: string;
  abbreviation: string;
  returnDeadlineDays: number;
  citation: string;
  penaltyMultiplier: number | null;
  penaltyType: "multiplier" | "flat" | "none";
  penaltyFlatFee: number | null;
  badFaithPenalty: boolean;
  smallClaimsLimit: number;
  itemizedNoticeRequired: boolean;
  notes: string;
}

export interface CaseAnalysis {
  isLate: boolean;
  daysPastDeadline: number;
  deadlineDate: string;
  depositWithheld: number;
  penaltyAmount: number;
  totalPotentialRecovery: number;
  stateLaw: StateLaw;
}

export interface AgentStatus {
  agent: string;
  status: "pending" | "running" | "complete" | "error";
  message?: string;
  confidence?: number;
  data?: any;
}
