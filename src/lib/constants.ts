
import { UserRole } from '@/types';

export const APP_NAME = 'Aplikasi Management Data Token';

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  DASHBOARD: '/dashboard',
  TOKEN: '/token',
  CONTACT: '/contact',
  INPUT_TOKEN: '/input-token',
  TRANSACTIONS: '/transactions',
  MANAGE_CUSTOMERS: '/manage-customers',
  MANAGE_VENDORS: '/manage-vendors',
  PROFILE: '/profile',
  SETTINGS: '/settings',
  MANAGE_USERS: '/manage-users',
  MY_TOKENS: '/my-tokens',
  PURCHASE_BASE: '/purchase',
  // PEMBELIAN: '/pembelian', // Rute baru untuk Pembelian DIHAPUS
  MIDTRANS_PLAYGROUND: '/midtrans-playground',
  IPAYMU_PLAYGROUND: '/ipaymu-playground', // Ditambahkan untuk konsistensi jika diperlukan
  TRANSACTION_ANALYSIS: '/transaction-analysis',
  RECEIPT_TEMPLATE: '/receipt-template',
  PROMOTIONS: '/promotions',
};

export const USER_ROLES_HIERARCHY: { [key in UserRole]: string } = {
  [UserRole.ADMIN]: 'Admin',
  [UserRole.CUSTOMER]: 'Customer',
  [UserRole.TEKNISI]: 'Teknisi',
  [UserRole.VENDOR]: 'Vendor',
};

