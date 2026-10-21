import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  Banknote,
  MapPin,
  ShoppingBag,
  Sparkles,
  Truck,
} from "lucide-react";
import styles from "./storefront-hero.module.css";
import { defaultHero, type HeroContent } from "@/lib/storefront-content";
import { HeroPicture } from "./hero-picture";

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
  const Heading = preview ? "h2" : "h1";
  const headingId = preview
    ? "hero-preview-heading"
    : "storefront-hero-heading";
  return (
    <section
      className={`${styles.hero} ${preview ? styles.preview : ""}`}
      aria-labelledby={headingId}
    >
      <div className={styles.stage}>
        <div className={styles.content}>
          <span className={styles.eyebrow}>
            <Sparkles size={14} aria-hidden="true" /> {content.eyebrow}
          </span>
          <Heading id={headingId}>
            {content.title}
            {content.accent && <span>{content.accent}</span>}
          </Heading>
          <p>{content.description}</p>
          <div className={styles.actions}>
            <Link
              className={styles.primaryAction}
              href={content.buttonHref}
              tabIndex={preview ? -1 : undefined}
            >
              {content.buttonLabel} <ArrowRight size={18} aria-hidden="true" />
            </Link>
            {hasCategories ? (
              <a
                className={styles.secondaryAction}
                href="#categories"
                tabIndex={preview ? -1 : undefined}
              >
                Explore categories <ArrowDown size={16} aria-hidden="true" />
              </a>
            ) : (
              <Link
                className={styles.secondaryAction}
                href="/shops"
                tabIndex={preview ? -1 : undefined}
              >
                Meet the shops <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
          </div>
          <span className={styles.footnote}>
            <span aria-hidden="true" /> Your next favourite is waiting.
          </span>
        </div>
        <div className={styles.visual}>
          <HeroPicture
            desktop={content.desktopImageUrl}
            mobile={content.mobileImageUrl}
            alt={content.imageAlt}
            mobileOnly={previewMobile}
          />
          <div className={styles.visualCaption}>
            <span className={styles.captionIcon}>
              <ShoppingBag size={21} aria-hidden="true" />
            </span>
            <span>
              For all the little things.
              <small>And the things you&apos;ll love a little more.</small>
            </span>
          </div>
        </div>
      </div>
      <div className={styles.benefits} aria-label="Shopping with HelaCart">
        <div>
          <Banknote size={22} aria-hidden="true" />
          <span>
            <strong>Pay on delivery</strong>
            <small>Shop with cash on delivery</small>
          </span>
        </div>
        <div>
          <MapPin size={22} aria-hidden="true" />
          <span>
            <strong>Local shops</strong>
            <small>Discover sellers across Sri Lanka</small>
          </span>
        </div>
        <div>
          <Truck size={22} aria-hidden="true" />
          <span>
            <strong>Know your total</strong>
            <small>Delivery fees shown at checkout</small>
          </span>
        </div>
      </div>
    </section>
  );
}
