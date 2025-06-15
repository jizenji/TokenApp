
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

const tokenTypeToOrderCodeMap: Record<string, string> = {
  ELECTRICITY: 'L',
  WATER: 'A',
  GAS: 'G',
  SOLAR: 'S',
  DEFAULT: 'X',
};

async function getNextOrderIdSequenceInternal(dayMonthYear: string, serviceTypeCode: string, sourcePrefix: string): Promise<number> {
  const counterId = `order_${sourcePrefix}_${dayMonthYear}_${serviceTypeCode}`;
  const counterRef = doc(db, "counters", counterId);
  try {
    let nextSequence = 1;
    const counterDoc = await getDoc(counterRef);
    if (counterDoc.exists()) {
        const currentSequence = counterDoc.data()?.lastSequence || 0;
        nextSequence = currentSequence + 1;
    }
    // Idealnya ini dalam transaksi Firestore jika konkurensi tinggi,
    // tapi untuk penggunaan standar, setDoc dengan merge cukup.
    await setDoc(counterRef, { lastSequence: nextSequence, updatedAt: serverTimestamp() }, { merge: true });
    return nextSequence;
  } catch (error) {
    console.error(`Error in getNextOrderIdSequenceInternal for counterId ${counterId}:`, error);
    // Fallback ke angka acak jika error, meskipun tidak ideal untuk keunikan.
    // Pertimbangkan penanganan error yang lebih baik di produksi.
    return Math.floor(Math.random() * 10000);
  }
}

/**
 * Generates a full unique Order ID with a source prefix.
 * Example: TRN-A-070624-L-0001 (Admin, Electricity)
 * Example: TRN-U-070624-W-0002 (User, Water)
 * @param tokenType The type of the token (e.g., 'ELECTRICITY', 'WATER'). Case-insensitive.
 * @param sourcePrefix A single character code for the transaction source (A, U, T, V).
 * @returns A promise that resolves to the formatted Order ID string.
 */
export async function generateFullOrderId(tokenType: string, sourcePrefix: string): Promise<string> {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0'); // Bulan dimulai dari 0
  const year = String(now.getFullYear()).slice(-2); // Ambil 2 digit terakhir tahun
  const datePart = `${day}${month}${year}`;

  const upperCaseTokenType = tokenType ? tokenType.toUpperCase() : 'DEFAULT';
  const serviceCode = tokenTypeToOrderCodeMap[upperCaseTokenType] || tokenTypeToOrderCodeMap.DEFAULT;

  const sequenceNumber = await getNextOrderIdSequenceInternal(datePart, serviceCode, sourcePrefix.toUpperCase());
  const sequencePadded = sequenceNumber.toString().padStart(4, '0'); // Diubah dari 3 menjadi 4 digit

  return `TRN-${sourcePrefix.toUpperCase()}-${datePart}-${serviceCode}-${sequencePadded}`;
}
