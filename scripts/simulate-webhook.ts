import crypto from "crypto";
import axios from "axios";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? "velvet_webhook_2026";

async function main() {
  const payload = {
    event: "payment_link.paid",
    payload: {
      payment_link: {
        entity: {
          amount_paid: 49900,
          notes: {
            contactId: "19",
            mediaId: "2"
          }
        }
      },
      payment: {
        entity: {
          id: "pay_MEDIA_" + Date.now()
        }
      }
    }
  };


  const body = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  try {
    const res = await axios.post("http://localhost:3000/api/razorpay/webhook", body, {
      timeout: 5000,
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": signature,
      }
    });
    console.log("Webhook response:", res.data);
  } catch (e: any) {
    console.error("Webhook failed:", e.response?.data || e.code || e.message);
  }
}

main();
