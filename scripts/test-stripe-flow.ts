/**
 * test-stripe-flow.ts
 *
 * End-to-end smoke test for the Stripe payment flow in emp-billing.
 *
 * What it does:
 *   1. Logs into the API to get an auth token
 *   2. Creates a test client (or uses an existing one)
 *   3. Creates a test invoice for that client
 *   4. Calls the portal /pay endpoint to create a Stripe Checkout session
 *   5. Verifies that a checkout URL is returned
 *   6. Prints manual testing instructions
 *
 * Usage:
 *   npx tsx scripts/test-stripe-flow.ts
 *
 * Prerequisites:
 *   - Server running at http://localhost:4001
 *   - STRIPE_SECRET_KEY set in .env
 *   - Database seeded (npm run db:seed) so a user/org exists
 */

const API_BASE = process.env.API_BASE || "http://localhost:4001/api/v1";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function apiPost<T = unknown>(
  path: string,
  body: Record<string, unknown>,
  token?: string
): Promise<{ success: boolean; data: T; message?: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`POST ${path} failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json as { success: boolean; data: T; message?: string };
}

async function apiGet<T = unknown>(
  path: string,
  token?: string
): Promise<{ success: boolean; data: T }> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { headers });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`GET ${path} failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json as { success: boolean; data: T };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Stripe Payment Flow Test ===\n");

  // Step 0: Check if Stripe is configured
  console.log("Step 0: Checking if Stripe gateway is configured...");
  let authToken: string;

  try {
    // Login with seed user
    const loginRes = await apiPost<{ accessToken: string }>("/auth/login", {
      email: "admin@acme.com",
      password: "password123",
    });
    authToken = loginRes.data.accessToken;
    console.log("  Logged in successfully.\n");
  } catch (err) {
    console.error("  Failed to login. Make sure the server is running and the database is seeded.");
    console.error(`  Error: ${(err as Error).message}`);
    process.exit(1);
  }

  // Check available gateways
  let stripeAvailable = false;
  try {
    const gwRes = await apiGet<Array<{ name: string; displayName: string }>>(
      "/portal/payment-gateways",
      authToken
    );
    const gateways = gwRes.data || [];
    stripeAvailable = gateways.some((g) => g.name === "stripe");
    console.log(`  Available gateways: ${gateways.map((g) => g.displayName).join(", ") || "(none)"}`);

    if (!stripeAvailable) {
      console.log("\n  WARNING: Stripe is NOT configured. Set STRIPE_SECRET_KEY in .env to test.");
      console.log("  The test will continue to verify the API structure, but the checkout URL step will fail.\n");
    } else {
      console.log("  Stripe is configured and available.\n");
    }
  } catch {
    console.log("  Could not check gateways via portal endpoint. Continuing with auth endpoint...\n");
  }

  // Step 1: Get or create a test client
  console.log("Step 1: Finding or creating a test client...");
  let clientId: string;
  let clientEmail: string;

  try {
    const clientsRes = await apiGet<Array<{ id: string; email: string }>>(
      "/clients?limit=1",
      authToken
    );
    const clients = clientsRes.data || [];
    if (clients.length > 0) {
      clientId = clients[0].id;
      clientEmail = clients[0].email;
      console.log(`  Using existing client: ${clientEmail} (${clientId})\n`);
    } else {
      const createRes = await apiPost<{ id: string; email: string }>(
        "/clients",
        {
          name: "Stripe Test Client",
          email: "stripe-test@example.com",
          phone: "+1234567890",
          billingAddress: {
            line1: "123 Test Street",
            city: "Test City",
            state: "TS",
            postalCode: "12345",
            country: "US",
          },
        },
        authToken
      );
      clientId = createRes.data.id;
      clientEmail = createRes.data.email;
      console.log(`  Created test client: ${clientEmail} (${clientId})\n`);
    }
  } catch (err) {
    console.error(`  Failed to get/create client: ${(err as Error).message}`);
    process.exit(1);
  }

  // Step 2: Create a test invoice
  console.log("Step 2: Creating a test invoice...");
  let invoiceId: string;
  let invoiceNumber: string;

  try {
    const invoiceRes = await apiPost<{ id: string; invoiceNumber: string; amountDue: number; status: string }>(
      "/invoices",
      {
        clientId,
        currency: "USD",
        issueDate: new Date().toISOString().split("T")[0],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        items: [
          {
            name: "Stripe Test Service",
            description: "Testing Stripe Checkout integration",
            quantity: 1,
            rate: 5000, // $50.00 in cents
            taxRate: 0,
          },
        ],
        notes: "This is a test invoice for Stripe flow verification.",
        status: "sent", // must be sent to be payable
      },
      authToken
    );
    invoiceId = invoiceRes.data.id;
    invoiceNumber = invoiceRes.data.invoiceNumber;
    console.log(`  Created invoice: ${invoiceNumber} (${invoiceId})`);
    console.log(`  Amount due: ${invoiceRes.data.amountDue} (smallest unit)`);
    console.log(`  Status: ${invoiceRes.data.status}\n`);
  } catch (err) {
    console.error(`  Failed to create invoice: ${(err as Error).message}`);
    process.exit(1);
  }

  // Step 3: Create a payment order via the portal pay endpoint
  console.log("Step 3: Creating Stripe Checkout session via /portal/pay...");

  if (!stripeAvailable) {
    console.log("  SKIPPED: Stripe is not configured. Set STRIPE_SECRET_KEY to test this step.");
    console.log("\n=== Test Complete (partial) ===");
    console.log("The API structure is correct. Configure STRIPE_SECRET_KEY to fully test the flow.");
    process.exit(0);
  }

  try {
    const payRes = await apiPost<{
      gatewayOrderId: string;
      checkoutUrl?: string;
      metadata?: Record<string, unknown>;
    }>(
      "/portal/pay",
      { invoiceId, gateway: "stripe" },
      authToken
    );

    const order = payRes.data;

    console.log(`  Gateway Order ID: ${order.gatewayOrderId}`);
    console.log(`  Checkout URL: ${order.checkoutUrl || "(MISSING)"}`);
    console.log(`  Metadata: ${JSON.stringify(order.metadata, null, 2)}\n`);

    if (!order.checkoutUrl) {
      console.error("  ERROR: No checkoutUrl returned! The Stripe integration is broken.");
      process.exit(1);
    }

    console.log("=== Test PASSED ===\n");
    console.log("The Stripe Checkout session was created successfully.");
    console.log("A valid checkout URL was returned.\n");

    console.log("--- Manual Testing Instructions ---");
    console.log("1. Open this URL in your browser to test the payment flow:");
    console.log(`   ${order.checkoutUrl}\n`);
    console.log("2. Use Stripe test card: 4242 4242 4242 4242");
    console.log("   Expiry: any future date   CVC: any 3 digits\n");
    console.log("3. After payment, you should be redirected back to the portal.");
    console.log("4. The webhook (POST /webhooks/gateway/stripe) will record the payment.");
    console.log("   For local testing, use Stripe CLI to forward webhooks:");
    console.log("   stripe listen --forward-to localhost:4001/webhooks/gateway/stripe\n");
    console.log("5. Verify the invoice status changed to 'paid' after the webhook fires.\n");
  } catch (err) {
    console.error(`  Failed to create payment order: ${(err as Error).message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
