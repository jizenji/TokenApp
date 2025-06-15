
'use client';

import type { GeneratedToken, ReceiptTemplateSettings } from '@/types';
import type { useToast } from '@/hooks/use-toast';
import { db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';

type ToastFunction = ReturnType<typeof useToast>['toast'];

const tokenTypeDisplayMapSimple: Record<string, string> = {
  electricity: 'Listrik',
  water: 'Air',
  gas: 'Gas',
  solar: 'Solar',
  unknown: 'Tidak Diketahui',
};

const tokenTypeUnitMap: Record<string, string> = {
  ELECTRICITY: 'KWh',
  WATER: 'm³',
  GAS: 'm³',
  SOLAR: 'kWp',
  UNKNOWN: 'Unit',
  DEFAULT: 'Unit',
};

const formatUnitValueForDisplay = (unitValueStr: string | undefined, itemType: string): string => {
  if (!unitValueStr || unitValueStr.trim() === '') return 'N/A';
  const knownUnitsShort = Object.values(tokenTypeUnitMap).map(u => u.toLowerCase());
  const lowerUnitValueStr = unitValueStr.toLowerCase();

  let unitAlreadyPresent = false;
  for (const unit of knownUnitsShort) {
      const regex = new RegExp(`\\d([.,]\\d+)?\\s*${unit.replace('³', '³?')}$`);
      if (regex.test(lowerUnitValueStr)) {
          unitAlreadyPresent = true;
          break;
      }
  }

  if (unitAlreadyPresent) return unitValueStr;
  const unitToAdd = tokenTypeUnitMap[itemType.toUpperCase() as keyof typeof tokenTypeUnitMap] || tokenTypeUnitMap.DEFAULT;
  return `${unitValueStr} ${unitToAdd}`;
};

const defaultReceiptSettings: ReceiptTemplateSettings = {
  shopName: "PT. XYZ SAITEC (Default)",
  shopAddress: "Jl. Merdeka No. 123 (Default)",
  shopPhone: "021-000-000 (Default)",
  shopWebsite: "",
  logoUrl: "",
  thankYouMessage: "Terima Kasih! (Default)",
  footerNote1: "Simpan struk ini. (Default)",
  footerNote2: "",
};


export async function printTransactionReceipt(
  transaction: GeneratedToken | null,
  toast: ToastFunction,
  currentSettings?: ReceiptTemplateSettings
) {
  if (!transaction) {
    toast({ title: "Error Cetak", description: "Tidak ada detail transaksi yang dipilih.", variant: "destructive" });
    return;
  }

  let finalSettings: ReceiptTemplateSettings = defaultReceiptSettings;

  if (currentSettings) {
    finalSettings = { ...defaultReceiptSettings, ...currentSettings };
  } else {
    try {
      const settingsDocRef = doc(db, 'appConfiguration', 'receiptTemplateSettings');
      const docSnap = await getDoc(settingsDocRef);
      if (docSnap.exists()) {
        finalSettings = { ...defaultReceiptSettings, ...docSnap.data() } as ReceiptTemplateSettings;
      } else {
        toast({ title: "Info", description: "Pengaturan template struk default digunakan karena belum ada yang tersimpan.", variant: "default"});
      }
    } catch (error) {
      console.error("Error fetching receipt settings for printing:", error);
      toast({ title: "Error Pengaturan Struk", description: "Gagal memuat pengaturan template struk, menggunakan default.", variant: "destructive"});
    }
  }

  const adminName = "Admin";

  const logoHtml = finalSettings.logoUrl
    ? `<img src="${finalSettings.logoUrl}" alt="Logo" style="max-width: 120px; max-height: 40px; margin: 0 auto 5px auto; display: block; object-fit: contain;"/>`
    : `<div style="text-align: center; margin-bottom: 5px; font-size: 10pt; font-weight: bold;">${finalSettings.shopName}</div>`;

  const shopAddressHtml = finalSettings.shopAddress ? `<p style="font-size: 8pt; margin: 0 0 2px 0;">${finalSettings.shopAddress}</p>` : '';
  const shopPhoneHtml = finalSettings.shopPhone ? `<p style="font-size: 8pt; margin: 0 0 2px 0;">${finalSettings.shopPhone}</p>` : '';
  const shopWebsiteHtml = finalSettings.shopWebsite ? `<p style="font-size: 8pt; margin: 0 0 2px 0;">${finalSettings.shopWebsite}</p>` : '';

  let purchaseSummaryHtml = '';
  purchaseSummaryHtml += `
    <div style="display: flex; justify-content: space-between; font-size: 9pt; margin-top: 3px;">
      <span>Nominal Token</span>
      <span>Rp ${transaction.amount.toLocaleString('id-ID')}</span>
    </div>
  `;
  if (transaction.adminFee && transaction.adminFee > 0) {
    purchaseSummaryHtml += `
      <div style="display: flex; justify-content: space-between; font-size: 9pt;">
        <span>Biaya Admin</span>
        <span>Rp ${transaction.adminFee.toLocaleString('id-ID')}</span>
      </div>
    `;
  }
  if (transaction.otherCosts && transaction.otherCosts > 0) {
    purchaseSummaryHtml += `
      <div style="display: flex; justify-content: space-between; font-size: 9pt;">
        <span>Biaya Lain</span>
        <span>Rp ${transaction.otherCosts.toLocaleString('id-ID')}</span>
      </div>
    `;
  }
   if (transaction.taxAmount && transaction.taxAmount > 0) {
    purchaseSummaryHtml += `
      <div style="display: flex; justify-content: space-between; font-size: 9pt;">
        <span>Pajak</span>
        <span>Rp ${transaction.taxAmount.toLocaleString('id-ID')}</span>
      </div>
    `;
  }
  if (transaction.discountAmount && transaction.discountAmount > 0) {
    purchaseSummaryHtml += `
      <div style="display: flex; justify-content: space-between; font-size: 9pt; color: green;">
        <span>Diskon${transaction.voucherCodeUsed ? ` (${transaction.voucherCodeUsed})` : ''}</span>
        <span>- Rp ${transaction.discountAmount.toLocaleString('id-ID')}</span>
      </div>
    `;
  }
  if (transaction.originalTotalBeforeDiscount && transaction.discountAmount && transaction.discountAmount > 0) {
     purchaseSummaryHtml += `
      <div style="display: flex; justify-content: space-between; font-size: 8pt; text-decoration: line-through; color: #777;">
        <span>Subtotal Awal</span>
        <span>Rp ${transaction.originalTotalBeforeDiscount.toLocaleString('id-ID')}</span>
      </div>
    `;
  }
  purchaseSummaryHtml += `
    <hr style="border: none; border-top: 1px dotted #777; margin: 2px 0;" />
    <div style="display: flex; justify-content: space-between; font-size: 10pt; font-weight: bold; margin-top: 1px;">
      <span>Total Bayar</span>
      <span>Rp ${transaction.actualTotalPayment.toLocaleString('id-ID')}</span>
    </div>
  `;


  const receiptHTML = `
    <div style="text-align: center; margin-bottom: 8px;">
      ${logoHtml}
      ${!finalSettings.logoUrl ? '' : `<div style="font-size: 11pt; font-weight: bold; margin-top: 2px;">${finalSettings.shopName}</div>`}
      ${shopAddressHtml}
      ${shopPhoneHtml}
      ${shopWebsiteHtml}
      <p style="font-size: 8pt; margin: 2px 0; font-weight: bold;">ID Transaksi: ${transaction.orderId}</p>
    </div>
    <hr style="border: none; border-top: 1px dashed #555; margin: 5px 0;" />
    <div style="display: flex; justify-content: space-between; font-size: 8pt;">
      <span>${transaction.createdAt.toLocaleDateString('id-ID')}</span>
      <span>${adminName}</span>
    </div>
    <div style="display: flex; justify-content: space-between; font-size: 8pt; margin-bottom: 5px;">
      <span>${transaction.createdAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
      <span>${transaction.customerName || transaction.customerId}</span>
    </div>
    <hr style="border: none; border-top: 1px dashed #555; margin: 5px 0;" />

    ${purchaseSummaryHtml}

    <hr style="border: none; border-top: 1px dashed #555; margin: 5px 0;" />
    <div style="margin-top: 4px; text-align: center;">
      <div style="font-size: 8pt; text-transform: uppercase;">TOKEN ${(tokenTypeDisplayMapSimple[transaction.type]?.toUpperCase() || transaction.type.toUpperCase())} PREPAID:</div>
      <div style="font-family: 'Courier New', Courier, monospace; font-size: 11pt; font-weight: bold; padding: 4px; border: 1px solid #555; margin: 3px 0; background-color: #f9f9f9; word-break: break-all;">
        ${transaction.generatedTokenCode}
      </div>
      ${transaction.unitValue ? `<div style="font-size: 8pt; text-align: center;">Value: ${formatUnitValueForDisplay(transaction.unitValue, transaction.type)}</div>` : ''}
    </div>
    <hr style="border: none; border-top: 1px dashed #555; margin: 5px 0;" />
    <p style="font-size: 9pt; text-align: center; margin-top: 5px; font-weight: bold;">${finalSettings.thankYouMessage}</p>
    ${finalSettings.footerNote1 ? `<p style="font-size: 8pt; text-align: center; margin-top: 1px;">${finalSettings.footerNote1}</p>` : ''}
    ${finalSettings.footerNote2 ? `<p style="font-size: 8pt; text-align: center; margin-top: 1px;">${finalSettings.footerNote2}</p>` : ''}
  `;

  const printWindow = window.open('', '_blank', 'height=800,width=450');
  if (printWindow) {
    printWindow.document.write('<html><head><title>Struk Transaksi</title>');
    printWindow.document.write('<style>');
    // Using single quotes for the main string and escaped newlines for CSS
    printWindow.document.write(
      '@page { size: 57mm auto; margin: 2mm; } ' +
      'body { font-family: \'Courier New\', Courier, monospace; font-size: 9pt; line-height: 1.3; margin: 0; padding: 0; background-color: #fff; color: #000; width: 55mm; }'
    );
    printWindow.document.write('</style></head><body>');
    printWindow.document.write(`<div id="printable-receipt-area">${receiptHTML}</div>`);
    printWindow.document.write('</body></html>');
    printWindow.document.close();

    const attemptPrint = () => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (e) {
        console.error("Error during printWindow.print():", e);
        toast({ title: "Error Cetak", description: "Gagal memulai proses print. Coba lagi atau periksa pengaturan browser.", variant: "destructive"});
      }
    };

    if (printWindow.document.readyState === 'complete') {
        attemptPrint();
    } else {
        printWindow.onload = attemptPrint;
        setTimeout(() => {
            if (printWindow.document.readyState === "complete" && !printWindow.closed) {
                attemptPrint();
            }
        }, 750);
    }
  } else {
    toast({ title: "Error Cetak", description: "Gagal membuka window baru untuk mencetak. Pastikan pop-up diizinkan.", variant: "destructive" });
  }
}
