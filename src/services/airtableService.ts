/**
 * Airtable Service
 * Handles verification of customer emails against Airtable database
 */

interface AirtableResponse {
  records: Array<{
    id: string;
    fields: Record<string, any>;
  }>;
}

interface VerifyCustomerResponse {
  authorized: boolean;
  customerData?: Record<string, any>;
}

/**
 * Verify if customer email exists in Airtable
 * This should call your backend API that interacts with Airtable
 */
export async function verifyCustomerEmail(email: string): Promise<VerifyCustomerResponse> {
  try {
    const response = await fetch('/api/verify-customer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      throw new Error('Failed to verify customer');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error verifying customer:', error);
    throw error;
  }
}

/**
 * Direct Airtable API call (for server-side use only)
 * Note: This should NOT be called from the frontend for security reasons.
 * The API key should be kept server-side only.
 */
export async function checkAirtableForEmail(email: string, apiKey: string, baseId: string, tableName: string): Promise<VerifyCustomerResponse> {
  try {
    const url = `https://api.airtable.com/v0/${baseId}/${tableName}?filterByFormula={email}="${email}"`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to query Airtable');
    }

    const data: AirtableResponse = await response.json();
    
    return {
      authorized: data.records.length > 0,
      customerData: data.records.length > 0 ? data.records[0].fields : undefined,
    };
  } catch (error) {
    console.error('Error checking Airtable:', error);
    throw error;
  }
}

/**
 * Download file helper
 */
export function downloadFile(filePath: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = filePath;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

