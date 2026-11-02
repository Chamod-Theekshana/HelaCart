import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { LegalPage } from "@/components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t("legal.terms.title"),
    description:
      "Terms for buying and selling on HelaCart, a Sri Lankan cash-on-delivery marketplace.",
    alternates: { canonical: "/legal/terms" },
  };
}

export default function TermsPage() {
  return (
    <LegalPage titleKey="legal.terms.title" updated="1 November 2026">
      <p>
        These terms govern your use of HelaCart, operated by{" "}
        <mark>[TO CONFIRM: company name and registration number]</mark>. By
        creating an account or placing an order you agree to them and to our{" "}
        <Link href="/legal/privacy">Privacy Policy</Link>.
      </p>
      <h2>1. The marketplace</h2>
      <p>
        HelaCart lets independent sellers in Sri Lanka list physical goods. Each
        order is a contract between you and the seller who sells the item;
        HelaCart provides the platform, reviews listings before publication and
        may step in to resolve problems. An order that contains items from
        several shops is split into one seller order per shop.
      </p>
      <h2>2. Accounts</h2>
      <p>
        You must give accurate information, verify your email address before
        checkout and keep your password secret. You may be asked to verify your
        delivery mobile number by SMS code. We may suspend accounts or shops
        that break these terms, misuse cash on delivery or put other users at
        risk.
      </p>
      <h2>3. Prices and cash on delivery</h2>
      <ul>
        <li>
          Prices are in Sri Lankan Rupees (LKR) and include any applicable taxes
          stated by the seller. Delivery fees are shown per shop before you
          confirm.
        </li>
        <li>
          Payment is cash on delivery only. Pay the courier or seller the total
          shown for that seller order when it arrives; do not pay anyone in
          advance.
        </li>
        <li>
          To limit fraud we may cap the value of a COD order, the number of open
          orders per buyer, or require phone verification.
        </li>
      </ul>
      <h2>4. Orders, cancellations and delivery</h2>
      <p>
        You can cancel a seller order before the seller accepts it. Sellers may
        cancel orders they cannot fulfil and must give a reason. Orders not
        accepted within <mark>[TO CONFIRM: e.g. 48 hours]</mark> are cancelled
        automatically. If a delivery fails (for example you are unreachable or
        refuse the parcel), the seller may re-attempt delivery or mark the
        parcel returned. Repeatedly refusing COD parcels may lead to account
        restrictions.
      </p>
      <h2>5. Returns and refunds</h2>
      <p>
        Returns are handled under our{" "}
        <Link href="/legal/returns">Returns Policy</Link>, without affecting
        your rights under the Consumer Affairs Authority Act, No. 9 of 2003.
      </p>
      <h2>6. Sellers</h2>
      <p>
        Sellers must list only lawful goods they are entitled to sell, describe
        them accurately, keep stock up to date, dispatch promptly and pay
        HelaCart the agreed commission on delivered orders. Seller-specific
        terms apply in Seller Center.{" "}
        <mark>[TO CONFIRM: seller agreement and commission schedule]</mark>
      </p>
      <h2>7. Reviews and content</h2>
      <p>
        Reviews must be honest and based on a genuine purchase. We may remove
        content that is unlawful, abusive or misleading.
      </p>
      <h2>8. Liability</h2>
      <p>
        To the extent permitted by Sri Lankan law, HelaCart is not liable for
        indirect losses or for the acts of sellers or couriers.{" "}
        <mark>[TO CONFIRM: liability cap with legal adviser]</mark>
      </p>
      <h2>9. Law and disputes</h2>
      <p>
        These terms are governed by the laws of the Democratic Socialist
        Republic of Sri Lanka. Contact support first; unresolved disputes fall
        under the courts of <mark>[TO CONFIRM: e.g. Colombo]</mark>.
      </p>
    </LegalPage>
  );
}
