import { db } from "./db";
import { eq } from "drizzle-orm";
import {
  cases, deductions, letters, signatures,
  type Case, type InsertCase,
  type Deduction, type InsertDeduction,
  type Letter, type InsertLetter,
  type Signature, type InsertSignature,
} from "@shared/schema";

export interface IStorage {
  createCase(data: InsertCase): Promise<Case>;
  getCase(id: number): Promise<Case | undefined>;
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
}

export class DatabaseStorage implements IStorage {
  async createCase(data: InsertCase): Promise<Case> {
    const [result] = await db.insert(cases).values(data).returning();
    return result;
  }

  async getCase(id: number): Promise<Case | undefined> {
    const [result] = await db.select().from(cases).where(eq(cases.id, id));
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
    const results = await db.select().from(signatures).where(eq(signatures.caseId, caseId));
    return results[results.length - 1];
  }
}

export const storage = new DatabaseStorage();
