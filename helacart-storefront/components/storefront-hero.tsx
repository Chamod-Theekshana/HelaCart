"use client";
import Link from "next/link";
import { ArrowRight, Banknote, MapPin, Truck } from "lucide-react";
import styles from "./storefront-hero.module.css";
import { defaultHero, type HeroContent } from "@/lib/storefront-content";
import { HeroPicture } from "./hero-picture";
import { useT } from "./language-provider";

export function StorefrontHero({
  hasCategories = true,
  content = defaultHero,
  preview = false,
  previewMobile = false,
}: {
  hasCategories?: boolean;
  content?: HeroContent;
  preview?: boolean;
  previewMobile?: boolean;
}) {
  const t = useT();
  const Heading = preview ? "h2" : "h1";
  const id = preview ? "hero-preview-heading" : "storefront-hero-heading";
  return (
    <section
      className={`${styles.hero} ${preview ? styles.preview : ""}`}
      aria-labelledby={id}
    >
      <div className={styles.backdrop}>
        <div className={styles.stage}>
          <div className={styles.content}>
            <span className={styles.eyebrow}>{content.eyebrow}</span>
            <Heading id={id}>
              {content.title}
              {content.accent && <span> {content.accent}</span>}
            </Heading>
            <p>{content.description}</p>
            <div className={styles.actions}>
              <Link
                className={styles.primaryAction}
                href={content.buttonHref}
                tabIndex={preview ? -1 : undefined}
              >
                {content.buttonLabel}
                <ArrowRight size={18} />
              </Link>
              {hasCategories ? (
                <a
                  className={styles.secondaryAction}
                  href="#categories"
                  tabIndex={preview ? -1 : undefined}
                >
                  {t("hero.exploreCategories")}
                </a>
              ) : (
                <Link
                  className={styles.secondaryAction}
                  href="/shops"
                  tabIndex={preview ? -1 : undefined}
                >
                  {t("hero.discoverShops")}
                </Link>
              )}
            </div>
          </div>
          <div className={styles.visual}>
            <HeroPicture
              desktop={content.desktopImageUrl}
              mobile={content.mobileImageUrl}
              alt={content.imageAlt}
              mobileOnly={previewMobile}
            />
          </div>
        </div>
      </div>
      <div className={styles.benefits} aria-label={t("hero.benefitsLabel")}>
        {[
          {
            icon: Banknote,
            title: t("trust.cod.title"),
            description: t("trust.cod.text"),
          },
          {
            icon: MapPin,
            title: t("hero.localShops.title"),
            description: t("hero.localShops.text"),
          },
          {
            icon: Truck,
            title: t("hero.fees.title"),
            description: t("hero.fees.text"),
          },
        ].map(({ icon: BenefitIcon, title, description }) => {
          return (
            <div key={title}>
              <span className={styles.benefitIcon}>
                <BenefitIcon size={22} aria-hidden="true" />
              </span>
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
