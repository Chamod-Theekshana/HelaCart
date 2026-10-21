import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, Banknote, MapPin, ShoppingBag, Sparkles, Truck } from "lucide-react";
import styles from "./storefront-hero.module.css";

export function StorefrontHero() {
  return <section className={styles.hero} aria-labelledby="storefront-hero-heading">
    <div className={styles.stage}>
      <div className={styles.content}>
        <span className={styles.eyebrow}><Sparkles size={14} aria-hidden="true" /> A WORLD OF FINDS. A LOCAL FEEL.</span>
        <h1 id="storefront-hero-heading">Good finds.<span>Closer to home.</span></h1>
        <p>Little upgrades. Everyday favourites. Discover something you&apos;ll love from sellers across Sri Lanka, all in one place.</p>
        <div className={styles.actions}>
          <Link className={styles.primaryAction} href="/products">Shop the marketplace <ArrowRight size={18} aria-hidden="true" /></Link>
          <a className={styles.secondaryAction} href="#categories">Explore categories <ArrowDown size={16} aria-hidden="true" /></a>
        </div>
        <span className={styles.footnote}><span aria-hidden="true" /> Your next favourite is waiting.</span>
      </div>
      <div className={styles.visual}>
        <Image className={styles.image} src="/marketplace-hero.webp" alt="A woven bag, soft linen, headphones and ceramics arranged in warm sunlight" fill sizes="(max-width: 760px) 100vw, 52vw" preload />
        <div className={styles.visualCaption}>
          <span className={styles.captionIcon}><ShoppingBag size={21} aria-hidden="true" /></span>
          <span>For all the little things.<small>And the things you&apos;ll love a little more.</small></span>
        </div>
      </div>
    </div>
    <div className={styles.benefits} aria-label="Shopping with HelaCart">
      <div><Banknote size={22} aria-hidden="true" /><span><strong>Pay on delivery</strong><small>Shop with cash on delivery</small></span></div>
      <div><MapPin size={22} aria-hidden="true" /><span><strong>Discover local sellers</strong><small>Find stores across Sri Lanka</small></span></div>
      <div><Truck size={22} aria-hidden="true" /><span><strong>Know your total</strong><small>Delivery fees shown at checkout</small></span></div>
    </div>
  </section>;
}
