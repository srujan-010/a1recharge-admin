export interface Retailer {
  _id?: string;
  name: string;
  shopName: string;
  mobile: string;
  email: string;
  status: 'ACTIVE'ACTIVE' | CommissionProfile;
  rechargeCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CommissionProfile {
  rate: number;
  frequency: 'DAILY' | 'Weekly' | 'Monthly' | 'Quarterly';
  minimumCharges: number;
}

export interface AppSettings {
  appName: string;
  supportNumber: string;
  maintenanceMode: boolean;
  minimumRecharge: number;
}

export type TransactionType = 'DEBIT' | 'CREDIT' | 'REFUND' | 'CHARGES' | 'DISCOUNT' | 'CASH_WITHDRAWAL';

export interface BankAccount {
  accountNumber: string;
  ifsc: string;
  holderName: string;
  bankName: string;
  accountType: 'SAVINGS' | 'CURRENT' | 'BUSINESS';
}

export type KycStatus = 'VERIFIED' | 'PENDING' | 'REJECTED';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'FINANCE' | 'SUPPORT' | 'KYC' | 'OPERATIONS' | 'AUDITOR';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'OTHER';

export interface AuditLogEntry {
  action: AuditAction;
  timestamp: Date;
  userId: string;
  details: string;
  affectedEntities: string[];
}

export interface WalletTransaction {
  _id?: string;
  retailerId: string;
  type: TransactionType;
  amount: number; // in paise
  balanceAfter: number;
  description?: string;
  referenceId?: string;
  createdBy: string; // admin user ID
  createdAt?: Date;
}