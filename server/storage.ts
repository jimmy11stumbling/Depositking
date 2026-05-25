import { db } from "./db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import {
  cases, deductions, letters, signatures, evidence, deliveries, courtForms, analyticsEvents,
  type Case, type InsertCase,
  type Deduction, type InsertDeduction,
  type Letter, type InsertLetter,
  type Signature, type InsertSignature,
  type Evidence, type InsertEvidence,
  type Delivery, type InsertDelivery,
  type CourtForm, type InsertCourtForm,
  type AnalyticsEvent, type InsertAnalyticsEvent,
} from "@shared/schema";

export interface IStorage {
  createCase(data: InsertCase): Promise<Case>;
  getCase(id: number): Promise<Case | undefined>;
  getCaseByToken(token: string): Promise<Case | undefined>;
  getAllCases(): Promise<Case[]>;
  updateCase(id: number, data: Partial<Case>): Promise<Case | undefined>;

  createDeduction(data: InsertDeduction): Promise<Deduction>;
  getDeductionsByCase(caseId: number): Promise<Deduction[]>;
  deleteDeduction(id: number): Promise<void>;

  createLetter(data: InsertLetter): Promise<Letter>;
  getLetterByCase(caseId: number): Promise<Letter | undefined>;
  updateLetter(id: number, data: Partial<Letter>): Promise<Letter | undefined>;

  createSignature(data: InsertSignature): Promise<Signature>;
  getSignatureByCase(caseId: number): Promise<Signature | undefined>;

  createEvidence(data: InsertEvidence): Promise<Evidence>;
  getEvidenceByCase(caseId: number): Promise<Evidence[]>;
  getEvidence(id: number): Promise<Evidence | undefined>;
  deleteEvidence(id: number): Promise<void>;

  createDelivery(data: InsertDelivery): Promise<Delivery>;
  getDeliveriesByCase(caseId: number): Promise<Delivery[]>;
  getDelivery(id: number): Promise<Delivery | undefined>;
  updateDelivery(id: number, data: Partial<Delivery>): Promise<Delivery | undefined>;

  createCourtForm(data: InsertCourtForm): Promise<CourtForm>;
  getCourtFormsByCase(caseId: number): Promise<CourtForm[]>;

  createAnalyticsEvent(data: InsertAnalyticsEvent): Promise<AnalyticsEvent>;
  getAnalyticsEventsByCase(caseId: number): Promise<AnalyticsEvent[]>;
}

function generateAccessToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export class DatabaseStorage implements IStorage {
  async createCase(data: InsertCase): Promise<Case> {
    const accessToken = generateAccessToken();
    const [result] = await db.insert(cases).values({ ...data, accessToken }).returning();
    return result;
  }

  async getCase(id: number): Promise<Case | undefined> {
    const [result] = await db.select().from(cases).where(eq(cases.id, id));
    return result;
  }

  async getCaseByToken(token: string): Promise<Case | undefined> {
    const [result] = await db.select().from(cases).where(eq(cases.accessToken, token));
    return result;
  }

  async getAllCases(): Promise<Case[]> {
    return db.select().from(cases).orderBy(cases.createdAt);
  }

  async updateCase(id: number, data: Partial<Case>): Promise<Case | undefined> {
    const [result] = await db.update(cases).set(data).where(eq(cases.id, id)).returning();
    return result;
  }

  async createDeduction(data: InsertDeduction): Promise<Deduction> {
    const [result] = await db.insert(deductions).values(data).returning();
    return result;
  }

  async getDeductionsByCase(caseId: number): Promise<Deduction[]> {
    return db.select().from(deductions).where(eq(deductions.caseId, caseId));
  }

  async deleteDeduction(id: number): Promise<void> {
    await db.delete(deductions).where(eq(deductions.id, id));
  }

  async createLetter(data: InsertLetter): Promise<Letter> {
    const [result] = await db.insert(letters).values(data).returning();
    return result;
  }

  async getLetterByCase(caseId: number): Promise<Letter | undefined> {
    const results = await db.select().from(letters).where(eq(letters.caseId, caseId));
    return results[results.length - 1];
  }

  async updateLetter(id: number, data: Partial<Letter>): Promise<Letter | undefined> {
    const [result] = await db.update(letters).set(data).where(eq(letters.id, id)).returning();
    return result;
  }

  async createSignature(data: InsertSignature): Promise<Signature> {
    const [result] = await db.insert(signatures).values(data).returning();
    return result;
  }

  async getSignatureByCase(caseId: number): Promise<Signature | undefined> {
    const [result] = await db.select().from(signatures).where(eq(signatures.caseId, caseId));
    return result;
  }

  async createEvidence(data: InsertEvidence): Promise<Evidence> {
    const [result] = await db.insert(evidence).values(data).returning();
    return result;
  }

  async getEvidenceByCase(caseId: number): Promise<Evidence[]> {
    return db.select().from(evidence).where(eq(evidence.caseId, caseId));
  }

  async getEvidence(id: number): Promise<Evidence | undefined> {
    const [result] = await db.select().from(evidence).where(eq(evidence.id, id));
    return result;
  }

  async deleteEvidence(id: number): Promise<void> {
    await db.delete(evidence).where(eq(evidence.id, id));
  }

  async createDelivery(data: InsertDelivery): Promise<Delivery> {
    const [result] = await db.insert(deliveries).values(data).returning();
    return result;
  }

  async getDeliveriesByCase(caseId: number): Promise<Delivery[]> {
    return db.select().from(deliveries).where(eq(deliveries.caseId, caseId));
  }

  async getDelivery(id: number): Promise<Delivery | undefined> {
    const [result] = await db.select().from(deliveries).where(eq(deliveries.id, id));
    return result;
  }

  async updateDelivery(id: number, data: Partial<Delivery>): Promise<Delivery | undefined> {
    const [result] = await db.update(deliveries).set(data).where(eq(deliveries.id, id)).returning();
    return result;
  }

  async createCourtForm(data: InsertCourtForm): Promise<CourtForm> {
    const [result] = await db.insert(courtForms).values(data).returning();
    return result;
  }

  async getCourtFormsByCase(caseId: number): Promise<CourtForm[]> {
    return db.select().from(courtForms).where(eq(courtForms.caseId, caseId));
  }

  async createAnalyticsEvent(data: InsertAnalyticsEvent): Promise<AnalyticsEvent> {
    const [result] = await db.insert(analyticsEvents).values(data).returning();
    return result;
  }

  async getAnalyticsEventsByCase(caseId: number): Promise<AnalyticsEvent[]> {
    return db.select().from(analyticsEvents).where(eq(analyticsEvents.caseId, caseId));
  }
}

export const storage = new DatabaseStorage();
