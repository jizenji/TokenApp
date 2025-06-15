
import { NextResponse } from 'next/server';
import { db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface StronpowerApiCredentials {
  apiUrl: string;
  companyName: string;
  userName: string;
  password?: string;
}

async function getStronpowerCredentials(): Promise<StronpowerApiCredentials> {
  const credsDocRef = doc(db, 'appConfiguration', 'stronpowerApiCredentials');
  const credsDocSnap = await getDoc(credsDocRef);

  if (!credsDocSnap.exists()) {
    console.error("[vend-stronpower-token] Stronpower API credentials not found in Firestore at appConfiguration/stronpowerApiCredentials");
    throw new Error('Stronpower API credentials not configured. Please set them in Token Management > API Credentials.');
  }
  const creds = credsDocSnap.data();
  if (!creds || !creds.apiUrl || !creds.companyName || !creds.userName || !creds.password) {
    console.error("[vend-stronpower-token] Stronpower API credentials incomplete in Firestore:", creds);
    throw new Error('Stronpower API credentials incomplete in configuration. Please check all fields in Token Management > API Credentials.');
  }
  return creds as StronpowerApiCredentials;
}

export async function POST(request: Request) {
  console.log("[vend-stronpower-token] Received POST request. Attempting to process...");
  try {
    const body = await request.json();
    const { meterId, amount } = body;
    console.log(`[vend-stronpower-token] Parsed body: meterId=${meterId}, amount=${amount}`);

    if (!meterId || amount === undefined || amount === null) {
      console.warn("[vend-stronpower-token] Validation failed: Meter ID or Amount missing.");
      return NextResponse.json({ success: false, message: 'Meter ID and Amount are required.' }, { status: 400 });
    }

    const numericAmount = Number(String(amount).replace(/\./g, ''));
    if (isNaN(numericAmount) || numericAmount <= 0) {
        console.warn(`[vend-stronpower-token] Validation failed: Invalid amount provided. Original: ${amount}, Numeric: ${numericAmount}`);
        return NextResponse.json({ success: false, message: 'Invalid amount provided.' }, { status: 400 });
    }

    const credentials = await getStronpowerCredentials();
    console.log("[vend-stronpower-token] Successfully fetched Stronpower credentials.");

    const stronpowerApiRequestBody = {
      CompanyName: credentials.companyName,
      UserName: credentials.userName,
      PassWord: credentials.password,
      MeterID: meterId,
      is_vend_by_unit: "false", // Per Stronpower docs, this is often a string "false"
      Amount: numericAmount.toString(),
    };

    console.log("[vend-stronpower-token] Calling Stronpower API with URL:", credentials.apiUrl);
    console.log("[vend-stronpower-token] Request Body to Stronpower:", JSON.stringify(stronpowerApiRequestBody));

    const stronpowerResponse = await fetch(credentials.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stronpowerApiRequestBody),
    });

    const responseText = await stronpowerResponse.text();
    console.log('[vend-stronpower-token] Raw Stronpower API Response Status:', stronpowerResponse.status);
    console.log('[vend-stronpower-token] Raw Stronpower API Response Text (first 500 chars):', responseText.substring(0, 500));

    if (!stronpowerResponse.ok) {
      let errorMessage = `Stronpower API Error: ${stronpowerResponse.status}`;
      try {
        const errorJson = JSON.parse(responseText); // Try to parse as JSON first
        errorMessage = errorJson.message || errorJson.Message || errorJson.error || errorJson.detail || JSON.stringify(errorJson);
      } catch (e) {
        // If parsing as JSON fails, use the raw text if it's not too long or empty
        errorMessage = responseText.length < 200 && responseText.trim() !== "" ? responseText : `Stronpower API request failed with status ${stronpowerResponse.status}. Response body was not valid JSON or was empty/too long.`;
      }
      console.error('[vend-stronpower-token] Stronpower API Error Details:', errorMessage);
      return NextResponse.json({ success: false, message: errorMessage, stronpower_status: stronpowerResponse.status }, { status: stronpowerResponse.status });
    }

    // Stronpower returned 2xx (OK)
    try {
      if (responseText.trim() === "" || responseText.trim() === "{}") {
        console.error('[vend-stronpower-token] Stronpower API returned 200-range status with empty or literal "{}". Response:', responseText);
        return NextResponse.json({ success: false, message: 'Stronpower API returned an empty or invalid success-like response.' }, { status: 500 });
      }

      const parsedDataFromStronpower = JSON.parse(responseText);

      // Check if the response is an array and has the 'Token' property
      if (parsedDataFromStronpower && Array.isArray(parsedDataFromStronpower) && parsedDataFromStronpower.length > 0 && parsedDataFromStronpower[0].hasOwnProperty('Token')) {
        const token = parsedDataFromStronpower[0].Token;
        if (token === null || token === "") { // Check for null or empty string token specifically
            console.warn('[vend-stronpower-token] Stronpower API returned a null or empty token string. MeterID:', meterId, 'Amount:', numericAmount, 'Response:', JSON.stringify(parsedDataFromStronpower));
            return NextResponse.json({ success: false, message: 'Stronpower API returned an empty token. Please verify the transaction details or contact support.' }, { status: 200 }); // 200 because the API call was "ok" but result is problematic
        }
        console.log(`[vend-stronpower-token] Vending successful for meterId ${meterId}. Token: ${token}`);
        return NextResponse.json({ success: true, token: token });
      } else {
        console.error('[vend-stronpower-token] Unexpected Stronpower API 200-range response structure. Parsed Data:', parsedDataFromStronpower, 'Raw Text (first 500 chars):', responseText.substring(0, 500));
        return NextResponse.json({ success: false, message: 'Failed to retrieve token from Stronpower due to unexpected API response format.' }, { status: 500 });
      }
    } catch (parseError: any) {
      console.error('[vend-stronpower-token] Failed to parse Stronpower API 200-range response as JSON. Raw response text (first 500 chars):', responseText.substring(0, 500), 'Error:', parseError.message);
      return NextResponse.json({ success: false, message: 'Stronpower API returned a non-JSON response or response was malformed.', rawResponsePreview: responseText.substring(0, 200) }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[vend-stronpower-token] Critical error in /api/vend-stronpower-token:', error.message, error.stack);
    let clientMessage = 'An internal server error occurred in the token vending API.';
    // Propagate specific config errors if they were the cause
    if (error.message.includes('Stronpower API credentials not configured') || error.message.includes('Stronpower API credentials incomplete')) {
        clientMessage = error.message;
    }
    return NextResponse.json({ success: false, message: clientMessage }, { status: 500 });
  }
}
