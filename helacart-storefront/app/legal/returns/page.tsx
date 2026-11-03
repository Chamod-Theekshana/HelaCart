import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { LegalPage } from "@/components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t("legal.returns.title"),
    description:
      "How returns, refunds and failed cash-on-delivery deliveries work on HelaCart.",
    alternates: { canonical: "/legal/returns" },
  };
}

export default function ReturnsPage() {
  return (
    <LegalPage titleKey="legal.returns.title" updated="1 November 2026">
      <h2>1. Return window</h2>
      <p>
        You can request a return for eligible items within{" "}
        <mark>[RETURNS WINDOW — TO CONFIRM, e.g. 7 days]</mark> of delivery from{" "}
        <Link href="/orders">My orders</Link>. Choose the items and quantities
        and tell us what is wrong.
      </p>
      <h2>2. Eligible reasons</h2>
      <ul>
        <li>The item arrived damaged, defective or incomplete.</li>
        <li>You received the wrong item, size or colour.</li>
        <li>The item is materially different from its listing.</li>
        <li>
          Change of mind:{" "}
          <mark>[TO CONFIRM whether accepted and on what terms]</mark>
        </li>
      </ul>
      <p>
        Perishable food, personal-care items once opened, and custom-made goods
        cannot be returned unless faulty.{" "}
        <mark>[TO CONFIRM list of excluded categories]</mark>
      </p>
      <h2>3. How it works</h2>
      <ol>
        <li>Submit a return request with photos where possible.</li>
        <li>
          HelaCart reviews the request with the seller and approves or rejects
          it with a reason.
        </li>
        <li>
          Return the item as instructed. Return delivery costs are paid by{" "}
          <mark>[TO CONFIRM: seller for faulty items / buyer otherwise]</mark>.
        </li>
        <li>
          Because you paid cash on delivery, approved refunds are paid by the
          seller by bank transfer or another agreed method within{" "}
          <mark>[TO CONFIRM, e.g. 14 days]</mark>, and recorded in your account.
        </li>
      </ol>
      <h2>4. Failed and refused deliveries</h2>
      <p>
        If a COD parcel cannot be delivered, the seller may try again. Parcels
        that return to the seller are cancelled and no payment is due. Please
        cancel orders you no longer want before they ship instead of refusing
        them at the door.
      </p>
      <h2>5. Need help?</h2>
      <p>
        Open a support case from{" "}
        <Link href="/account/support">Support &amp; help</Link> or contact{" "}
        <mark>[TO CONFIRM: support@helacart.lk / phone]</mark>. These rules do
        not limit your statutory rights as a consumer in Sri Lanka.
      </p>
    </LegalPage>
  );
}
