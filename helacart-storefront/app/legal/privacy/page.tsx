import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { LegalPage } from "@/components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t("legal.privacy.title"),
    description:
      "How HelaCart collects, uses and protects personal data under Sri Lanka's Personal Data Protection Act, No. 9 of 2022.",
    alternates: { canonical: "/legal/privacy" },
  };
}

export default function PrivacyPage() {
  return (
    <LegalPage titleKey="legal.privacy.title" updated="1 November 2026">
      <p>
        HelaCart (&quot;we&quot;, &quot;us&quot;) operates an online marketplace
        where independent Sri Lankan sellers offer goods that buyers pay for by
        cash on delivery (COD). This notice explains how we process personal
        data in line with the Personal Data Protection Act, No. 9 of 2022
        (&quot;PDPA&quot;). The data controller is{" "}
        <mark>
          [TO CONFIRM: registered company name, registration number and address]
        </mark>
        .
      </p>
      <h2>1. Data we collect</h2>
      <ul>
        <li>
          Account data: name, email address, phone number, password (handled by
          our authentication provider, Google Firebase) and an optional profile
          photo.
        </li>
        <li>
          Delivery data: recipient name, delivery address, district, postal code
          and the mobile number you verify by SMS one-time code.
        </li>
        <li>
          Order data: items, prices, delivery fees, order status history,
          returns, refunds, reviews and support messages.
        </li>
        <li>
          Seller data: shop details, pickup address, contact numbers and the
          identity or business-registration documents sellers submit for
          verification.
        </li>
        <li>
          Technical data: device and notification tokens, approximate request
          information (IP address, browser) and security logs used to prevent
          fraud and abuse. Uploaded photos have location (EXIF/GPS) metadata
          removed.
        </li>
      </ul>
      <h2>2. Why we use it (purposes and legal bases)</h2>
      <ul>
        <li>
          To create your account, take COD orders, pass delivery details to the
          seller who fulfils your order and keep you informed about it
          (performance of a contract).
        </li>
        <li>
          To prevent COD fraud, for example by verifying delivery phone numbers
          and limiting unusually large or numerous open orders (legitimate
          interests and legal obligations).
        </li>
        <li>
          To keep accounting, tax and commission records that the law requires
          (legal obligation).
        </li>
        <li>
          To send service messages by email, SMS and push notification. You can
          switch channels off in{" "}
          <Link href="/account/security">Account security</Link> (consent and
          legitimate interests).
        </li>
      </ul>
      <h2>3. Who we share it with</h2>
      <p>
        Sellers receive only the details needed to fulfil and deliver your
        order. We use service providers for hosting, authentication (Google
        Firebase), file storage (Cloudflare R2), email (Resend), SMS (Notify.lk)
        and push notifications (Firebase Cloud Messaging). Some providers
        process data outside Sri Lanka; we rely on safeguards permitted by the
        PDPA.{" "}
        <mark>
          [TO CONFIRM: list of processors and cross-border transfer basis]
        </mark>
        . We do not sell personal data.
      </p>
      <h2>4. How long we keep it</h2>
      <p>
        Account data is kept while your account is active. Order, payment and
        commission records are kept for{" "}
        <mark>[TO CONFIRM: retention period, e.g. 7 years for accounting]</mark>{" "}
        even after account deletion, in anonymised form where possible.
      </p>
      <h2>5. Your rights</h2>
      <p>
        Under the PDPA you may request access to, correction of, or erasure of
        your personal data, withdraw consent, and object to certain processing.
        Signed-in buyers can download their data and delete their account from{" "}
        <Link href="/account/security">Account security</Link>. When you delete
        your account we anonymise your name, phone and email, remove your
        addresses, devices, cart and favourites, and keep order and ledger rows
        that we must retain for accounting. You may also complain to the Data
        Protection Authority of Sri Lanka.
      </p>
      <h2>6. Security</h2>
      <p>
        We use encrypted connections, access controls, audit logs for
        administrative actions and data minimisation. No system is perfectly
        secure; contact us immediately if you suspect misuse of your account.
      </p>
      <h2>7. Contact</h2>
      <p>
        Data protection officer:{" "}
        <mark>[TO CONFIRM: name, support@helacart.lk, phone]</mark>.
      </p>
    </LegalPage>
  );
}
