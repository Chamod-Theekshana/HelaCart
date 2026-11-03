import type { ProductDetails } from "@/lib/product-feedback";
import s from "./product-feedback.module.css";
export function ProductSpecifications({
  product,
}: {
  product: {
    brand?: string | null;
    warranty?: string | null;
    specifications?: ProductDetails["specifications"];
  };
}) {
  return (
    <div className={s.specifications}>
      {product.brand || product.specifications?.length ? (
        <dl>
          {product.brand && (
            <div>
              <dt>Brand</dt>
              <dd>{product.brand}</dd>
            </div>
          )}
          {product.specifications?.map((row, index) => (
            <div key={`${row.name}:${index}`}>
              <dt>{row.name}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {product.warranty && (
        <div className={s.warranty}>
          <h3>Seller warranty</h3>
          <p>{product.warranty}</p>
        </div>
      )}
    </div>
  );
}
