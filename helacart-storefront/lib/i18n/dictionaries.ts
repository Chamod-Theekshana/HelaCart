import type { Locale } from "./config";
import { en, type Messages } from "./en";
import { si } from "./si";
import { ta } from "./ta";

/** Server-side dictionary lookup. Client components receive only the active dictionary. */
export const dictionaries: Record<Locale, Messages> = { en, si, ta };
