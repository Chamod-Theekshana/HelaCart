"use client";
import type { ProductDetails } from "@/lib/product-feedback";
import s from "./product-feedback.module.css";
export function ProductDetailsFields({
  value,
  onChange,
  disabled = false,
}: {
  value: ProductDetails;
  onChange: (value: ProductDetails) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className={s.fields} disabled={disabled}>
      <legend>Specifications & warranty</legend>
      <p>
        Optional details help buyers choose. Add only information that applies
        to this item.
      </p>
      <label>
        Brand
        <input
          maxLength={100}
          value={value.brand}
          onChange={(e) => onChange({ ...value, brand: e.target.value })}
          placeholder="Brand or maker"
        />
      </label>
      <label>
        Warranty
        <textarea
          maxLength={500}
          rows={3}
          value={value.warranty}
          onChange={(e) => onChange({ ...value, warranty: e.target.value })}
          placeholder="Coverage, duration and how buyers can claim"
        />
      </label>
      {value.specifications.map((row, index) => (
        <div className={s.specRow} key={index}>
          <label>
            Specification {index + 1}
            <input
              required
              maxLength={60}
              value={row.name}
              onChange={(e) =>
                onChange({
                  ...value,
                  specifications: value.specifications.map((item, i) =>
                    i === index ? { ...item, name: e.target.value } : item,
                  ),
                })
              }
              placeholder="e.g. Material"
            />
          </label>
          <label>
            Value
            <input
              required
              maxLength={300}
              value={row.value}
              onChange={(e) =>
                onChange({
                  ...value,
                  specifications: value.specifications.map((item, i) =>
                    i === index ? { ...item, value: e.target.value } : item,
                  ),
                })
              }
              placeholder="e.g. Cotton"
            />
          </label>
          <button
            className="outline-btn"
            type="button"
            onClick={() =>
              onChange({
                ...value,
                specifications: value.specifications.filter(
                  (_, i) => i !== index,
                ),
              })
            }
            aria-label={`Remove specification ${index + 1}`}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        className="outline-btn"
        type="button"
        disabled={disabled || value.specifications.length >= 20}
        onClick={() =>
          onChange({
            ...value,
            specifications: [...value.specifications, { name: "", value: "" }],
          })
        }
      >
        Add specification
      </button>
    </fieldset>
  );
}
