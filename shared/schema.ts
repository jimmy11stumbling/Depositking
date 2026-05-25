import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, decimal, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const cases = pgTable("cases", {
  id: serial("id").primaryKey(),
  accessToken: varchar("access_token", { length: 64 }).notNull().unique(),
  state: varchar("state", { length: 2 }).notNull(),
  moveOutDate: text("move_out_date").notNull(),
  depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }).notNull(),
  amountReturned: decimal("amount_returned", { precision: 10, scale: 2 }).default("0"),
  landlordName: varchar("landlord_name", { length: 255 }),
  landlordAddress: text("landlord_address"),
  landlordStreet: text("landlord_street"),
  landlordCity: text("landlord_city"),
  landlordState: varchar("landlord_state", { length: 2 }),
  landlordZip: varchar("landlord_zip", { length: 10 }),
  tenantName: varchar("tenant_name", { length: 255 }),
  tenantAddress: text("tenant_address"),
  tenantStreet: text("tenant_street"),
  tenantCity: text("tenant_city"),
  tenantState: varchar("tenant_state", { length: 2 }),
  tenantZip: varchar("tenant_zip", { length: 10 }),
  propertyAddress: text("property_address"),
  tenancyStart: text("tenancy_start"),
  status: varchar("status", { length: 50 }).default("intake").notNull(),
  potentialRecovery: decimal("potential_recovery", { precision: 10, scale: 2 }),
  daysPastDeadline: integer("days_past_deadline"),
  paid: boolean("paid").default(false).notNull(),
  mailPaid: boolean("mail_paid").default(false).notNull(),
  stripeSessionId: text("stripe_session_id"),
  mailStripeSessionId: text("mail_stripe_session_id"),
  letterSentAt: timestamp("letter_sent_at"),
  letterSentMethod: varchar("letter_sent_method", { length: 50 }),
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

export const evidence = pgTable("evidence", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  filename: varchar("filename", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileSize: integer("file_size").notNull(),
  sha256Hash: varchar("sha256_hash", { length: 64 }).notNull(),
  fileData: text("file_data").notNull(),
  metadata: jsonb("metadata"),
  description: text("description"),
  uploadedAt: timestamp("uploaded_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const deliveries = pgTable("deliveries", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 50 }).default("lob").notNull(),
  externalId: varchar("external_id", { length: 255 }),
  trackingNumber: varchar("tracking_number", { length: 255 }),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  recipientName: varchar("recipient_name", { length: 255 }),
  recipientAddress: text("recipient_address"),
  senderName: varchar("sender_name", { length: 255 }),
  senderAddress: text("sender_address"),
  certifiedMailNumber: varchar("certified_mail_number", { length: 100 }),
  expectedDeliveryDate: text("expected_delivery_date"),
  deliveredAt: timestamp("delivered_at"),
  statusHistory: jsonb("status_history"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  pagePath: text("page_path"),
  caseId: integer("case_id").references(() => cases.id, { onDelete: "set null" }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const courtForms = pgTable("court_forms", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  formType: varchar("form_type", { length: 100 }).notNull(),
  state: varchar("state", { length: 2 }).notNull(),
  formData: jsonb("form_data").notNull(),
  generatedAt: timestamp("generated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertCaseSchema = createInsertSchema(cases).omit({
  id: true,
  accessToken: true,
  createdAt: true,
  status: true,
  potentialRecovery: true,
  daysPastDeadline: true,
  paid: true,
  mailPaid: true,
  stripeSessionId: true,
  mailStripeSessionId: true,
  letterSentAt: true,
  letterSentMethod: true,
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

export const insertEvidenceSchema = createInsertSchema(evidence).omit({
  id: true,
  uploadedAt: true,
});

export const insertDeliverySchema = createInsertSchema(deliveries).omit({
  id: true,
  createdAt: true,
  deliveredAt: true,
});

export const insertCourtFormSchema = createInsertSchema(courtForms).omit({
  id: true,
  generatedAt: true,
});

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({
  id: true,
  createdAt: true,
});

export type Case = typeof cases.$inferSelect;
export type InsertCase = z.infer<typeof insertCaseSchema>;
export type Deduction = typeof deductions.$inferSelect;
export type InsertDeduction = z.infer<typeof insertDeductionSchema>;
export type Letter = typeof letters.$inferSelect;
export type InsertLetter = z.infer<typeof insertLetterSchema>;
export type Signature = typeof signatures.$inferSelect;
export type InsertSignature = z.infer<typeof insertSignatureSchema>;
export type Evidence = typeof evidence.$inferSelect;
export type InsertEvidence = z.infer<typeof insertEvidenceSchema>;
export type Delivery = typeof deliveries.$inferSelect;
export type InsertDelivery = z.infer<typeof insertDeliverySchema>;
export type CourtForm = typeof courtForms.$inferSelect;
export type InsertCourtForm = z.infer<typeof insertCourtFormSchema>;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;

export interface StateLaw {
  state: string;
  abbreviation: string;
  returnDeadlineDays: number;
  citation: string;
  penaltyMultiplier: number | null;
  penaltyType: "multiplier" | "flat" | "none";
  penaltyFlatFee: number | null;
  badFaithPenalty: boolean;
  badFaithFlatFee: number | null;
  interestRate: number | null;
  interestType: "simple" | "compound" | "none";
  specialPenaltyRules: string | null;
  smallClaimsLimit: number;
  smallClaimsCourtName: string;
  smallClaimsFilingFee: number | null;
  itemizedNoticeRequired: boolean;
  notes: string;
}

export interface PenaltyBreakdown {
  depositWithheld: number;
  baseDeposit: number;
  penaltyAmount: number;
  penaltyDescription: string;
  interestAmount: number;
  interestDescription: string;
  badFaithFlatFee: number;
  badFaithDescription: string;
  totalPotentialRecovery: number;
  items: { label: string; amount: number; description: string }[];
}

export interface CaseAnalysis {
  isLate: boolean;
  daysPastDeadline: number;
  deadlineDate: string;
  depositWithheld: number;
  penaltyAmount: number;
  totalPotentialRecovery: number;
  penaltyBreakdown: PenaltyBreakdown;
  stateLaw: StateLaw;
}

export interface AgentStatus {
  agent: string;
  status: "pending" | "running" | "complete" | "error";
  message?: string;
  confidence?: number;
  data?: any;
}
