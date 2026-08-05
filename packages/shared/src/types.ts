// =============================================================================
// Wallet Ledger Types (Mandatory for FinTech - immutable transaction history)
// =============================================================================

export type TransactionType = 'DEBIT' | 'CREDIT' | 'REFUND' | 'CHARGES' | 'DISCOUNT' | 'CASH_WITHDRAWAL';

export interface WalletTransaction {
  _id?: string;
  retailerId: string;
  type: TransactionType;
  amount: number; // in paisa (smallest currency unit)
  balanceAfter: number;
  description?: string;
  referenceId?: string; // Idempotency key / external reference
  createdBy: string; // Admin user ID or system
  createdAt?: Date;
}

// =============================================================================
// Retailer Types
// =============================================================================

export interface Retailer {
  _id?: string;
  name: string;
  shopName: string;
  mobile: string;
  email: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  kycStatus: KycStatus;
  commissionProfileId?: string;
  rechargeCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// =============================================================================
// Commission Types
// =============================================================================

export interface CommissionProfile {
  _id?: string;
  name: string;
  rate: number; // Percentage (0-100)
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ON_DEMAND';
  minimumCharges: number; // Minimum transaction amount for commission
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// =============================================================================
// App Configuration Types
// =============================================================================

export interface AppSettings {
  appName: string;
  supportNumber: string;
  maintenanceMode: boolean;
  minimumRecharge: number;
  maximumRecharge?: number;
  featureFlags?: Record<string, boolean>;
  appVersion?: string;
  forceUpdate?: boolean;
}

// =============================================================================
// KYC Types
// =============================================================================

export type KycStatus = 'VERIFIED' | 'PENDING' | 'REJECTED' | 'INCOMPLETE';

export interface KycDocument {
  aadhaarNumber?: string;
  panNumber?: string;
  gstNumber?: string;
  status: KycStatus;
  submittedAt?: Date;
  verifiedAt?: Date;
  verifiedBy?: string; // Admin user ID
  rejectionReason?: string;
}

// =============================================================================
// Bank Account Types
// =============================================================================

export type BankAccountType = 'SAVINGS' | 'CURRENT' | 'BUSINESS';

export interface BankAccount {
  accountNumber: string;
  ifsc: string;
  holderName: string;
  bankName: string;
  accountType: BankAccountType;
}

// =============================================================================
// Admin RBAC Types
// =============================================================================

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'FINANCE' | 'SUPPORT' | 'KYC' | 'OPERATIONS' | 'AUDITOR';

export interface AdminUser {
  _id?: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: string[];
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  createdAt?: Date;
  updatedAt?: Date;
  lastLogin?: Date;
}

// =============================================================================
// Audit Log Types (Mandatory for compliance)
// =============================================================================

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'VIEW' | 'DOWNLOAD' | 'EXPORT';

export interface AuditLogEntry {
  action: AuditAction;
  timestamp: Date;
  userId: string; // Admin user ID
  details: string;
  affectedEntity: string; // What was affected (model name or resource)
  affectedEntityId?: string; // Specific ID of affected entity
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

// =============================================================================
// Provider Types
// =============================================================================

export interface IOperator {
  _id?: string;
  name: string;
  code: string;
  category: 'PREPAID' | 'POSTPAID' | 'DTH' | 'LANDLINE' | 'BROADBAND';
  circle?: string;
  providerId: string;
  isActive: boolean;
}

export interface ProviderBalance {
  balance: number;
  currency: string;
  lastUpdated: Date;
}

export interface ProviderTxnResult {
  success: boolean;
  providerRefId?: string;
  message?: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
}

export interface ProviderTxnStatus {
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'REFUNDED';
  providerRefId?: string;
  errorMessage?: string;
}

// =============================================================================
// Recharge Types
// =============================================================================

export interface Recharge {
  _id?: string;
  retailerId: string;
  operatorId: string;
  mobileNumber: string;
  amount: number;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'REFUNDED';
  providerRefId?: string;
  provider: string; // Provider identifier for routing
  createdAt?: Date;
  completedAt?: Date;
  failureReason?: string;
}

// =============================================================================
// Standardized API Response Types
// =============================================================================

export interface APIResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}