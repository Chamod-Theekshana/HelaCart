import type { Messages, MessageKey } from "./en";
export type { Messages, MessageKey } from "./en";
export * from "./config";

export type TranslateValues = Record<string, string | number>;
export type Translate = (key: MessageKey, values?: TranslateValues) => string;

/** Builds `t(key, values)` for a dictionary. `{name}` placeholders are replaced. */
export function createTranslator(messages: Messages): Translate {
  return (key, values) => {
    const template = messages[key] ?? key;
    return values
      ? template.replace(/\{(\w+)\}/g, (match, name: string) =>
          name in values ? String(values[name]) : match,
        )
      : template;
  };
}
