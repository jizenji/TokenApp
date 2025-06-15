
export enum UserRole {
  ADMIN = 'admin',
  CUSTOMER = 'customer',
  TEKNISI = 'teknisi',
  VENDOR = 'vendor', 
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  photoURL?: string | null;
  isTransactionActive?: boolean; 
}

export interface TokenData { 
  id?: string;
  tokenId: string;
  type: 'listrik' | 'air' | 'gas';
  amount: number;
  customerName: string;
  status: 'new' | 'used' | 'expired';
  createdAt: Date; 
  updatedAt: Date; 
}

export interface GeneratedToken {
  id: string; 
  orderId: string;
  customerId: string; 
  customerName?: string; 
  serviceId: string; 
  type: string; 
  amount: number; // Nominal Token
  generatedTokenCode: string; 
  createdAt: Date; 
  basePrice?: number; 
  unitValue?: string; 
  // Fields for purchase summary
  adminFee?: number;
  taxAmount?: number; // Although currently not used, good for future
  otherCosts?: number;
  discountAmount?: number;
  voucherCodeUsed?: string | null;
  originalTotalBeforeDiscount?: number;
  actualTotalPayment: number; // The final amount paid by the customer
}


export interface CustomerService {
  serviceId: string; 
  powerOrVolume?: string; 
  tokenType: 'ELECTRICITY' | 'WATER' | 'GAS' | 'SOLAR' | string; 
  areaProject: string;
  project: string;
  vendorName: string;
  serviceSpecificNotes?: string;
  isServiceTransactionActive?: boolean; 
}

export interface CustomerData {
  id: string; 
  customerKTP: string; 
  customerUsername: string;
  customerPassword?: string;
  customerId: string; 
  customerName: string;
  customerAddress?: string;
  customerPhone?: string;
  customerEmail: string; 
  customerRegistrationDate: Date; 
  services: CustomerService[]; 
  isTransactionActive: boolean; 
}

export interface VendorData {
  id?: string; 
  name: string;
  contactPerson: string;
  email: string;
  phone?: string;
  address?: string;
  registrationDate: Date; 
  handledServices?: string[]; 
  authUid?: string; 
  emailLogin?: string; 
}

export interface TokenSettingValues {
  basePrice: string; 
  pajak: string; 
  adminFee: string; 
  otherCosts: string; 
}

export interface VendorInProject {
  name: string;
}
export interface ProjectInArea {
  name: string;
  vendors: VendorInProject[];
}
export interface AreaInHierarchy {
  name: string;
  projects: ProjectInArea[];
}
export type AreaHierarchy = AreaInHierarchy[]; 

export interface AllTokenSettings {
  [tokenName: string]: { 
    [areaName: string]: {
      [projectName: string]: {
        [vendorName: string]: TokenSettingValues;
      };
    };
  };
}

export interface SelectedHierarchy {
  area: string;
  project: string;
  vendor: string;
}

export interface PromotionData {
  id: string;
  imageUrl: string;
  altText: string;
  linkUrl?: string;
  isActive: boolean;
  displayOrder?: number;
  createdAt: Date;
  relatedVoucherCode?: string; 
}


export interface DisplayableService extends CustomerService {

}


export interface PurchaseFormState {
  selectedNominal: string; 
  customNominalInput: string; 
  customNominalError?: string; 
  calculatedPrice: {
    productAmount: number;
    adminFee: number;
    taxAmount: number;
    otherCosts: number;
    totalPayment: number; 
    originalTotalBeforeDiscount?: number; 
  } | null;
  voucherCode: string;
  voucherMessage: string;
  appliedVoucherAmount: number;
  isApplyingVoucher: boolean;
  customerPoints?: number; 
  isRedeemingPoints?: boolean;
  pointsDiscountAmount?: number;
  pointsMessage?: string;
}

export interface ReceiptTemplateSettings {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  shopWebsite?: string;
  logoUrl?: string; 
  thankYouMessage: string;
  footerNote1?: string;
  footerNote2?: string;
  
}

export interface PendingTransaction {
  id?: string; 
  orderId: string; 
  customerId?: string; // Business Customer ID like SAI-XXXX
  serviceIdForVending: string;
  tokenTypeForVending: string;
  productAmount: number; // Nominal token
  productName: string;
  totalPayment: number; // Final amount customer pays
  buyerName: string; 
  buyerEmail: string;
  buyerPhone: string;
  adminFee?: number;
  taxAmount?: number;
  otherCosts?: number;
  discountAmount?: number;
  originalTotalBeforeDiscount?: number; // Added for clarity
  voucherCodeUsed?: string | null;
  status: 'pending' | 'paid' | 'failed_payment' | 'expired_payment' | 'completed_vending' | 'failed_vending';
  midtransToken?: string; 
  midtransRedirectUrl?: string; 
  createdAt: any; 
  updatedAt?: any; 
  paymentDetails?: any; 
  vendingAttempts?: number;
  lastVendingError?: string;
  generatedTokenCode?: string; 
}
