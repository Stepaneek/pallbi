import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-11-20.acacia",
});

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const PRICE_MONTHLY = Deno.env.get("STRIPE_PRICE_MONTHLY");
const PRICE_YEARLY = Deno.env.get("STRIPE_PRICE_YEARLY");

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    if (webhookSecret && signature) {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } else {
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (e) {
    console.error("webhook signature error", e);
    return new Response(`Bad signature`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId =
          (sub.metadata?.supabase_user_id as string | undefined) ??
          await resolveUserFromCustomer(sub.customer as string);
        if (!userId) {
          console.warn("No user for subscription", sub.id);
          break;
        }
        const priceId = sub.items.data[0]?.price.id;
        const plan =
          priceId === PRICE_YEARLY ? "yearly" :
          priceId === PRICE_MONTHLY ? "monthly" : null;
        const status = event.type === "customer.subscription.deleted" ? "canceled" : sub.status;

        await admin.from("subscriptions").upsert({
          user_id: userId,
          stripe_customer_id: sub.customer as string,
          stripe_subscription_id: sub.id,
          status,
          plan,
          cancel_at_period_end: sub.cancel_at_period_end ?? false,
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        }, { onConflict: "user_id" });
        break;
      }
      default:
        break;
    }
    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("webhook handler error", e);
    return new Response(`Handler error`, { status: 500 });
  }
});

async function resolveUserFromCustomer(customerId: string): Promise<string | null> {
  const { data } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (data?.user_id) return data.user_id;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (!("deleted" in customer && customer.deleted)) {
      return (customer.metadata?.supabase_user_id as string) ?? null;
    }
  } catch (_) { /* ignore */ }
  return null;
}
