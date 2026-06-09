import React, { useEffect, useState } from "react";
import { formatNumberForLocale, parseNumberFromString } from "../utils/formatNumber";

type NumericInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  value?: number | null;
  onChange?: (value: number | null) => void;
  locale?: string;
  maximumFractionDigits?: number;
};

export default function NumericInput({
  value = null,
  onChange,
  locale = "fr-FR",
  maximumFractionDigits = 2,
  className,
  placeholder,
  ...rest
}: NumericInputProps) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState<string>(value === null ? "" : String(value));

  useEffect(() => {
    if (value === null || value === undefined) {
      setRaw("");
    } else if (!focused) {
      setRaw(String(value));
    }
  }, [value, focused]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target.value;
    setRaw(input);
    const parsed = parseNumberFromString(input, locale);
    onChange?.(Number.isFinite(parsed) ? parsed : null);
  }

  function handleFocus() {
    setFocused(true);
    const parsed = parseNumberFromString(raw, locale);
    setRaw(Number.isFinite(parsed) ? String(parsed) : raw);
  }

  function handleBlur() {
    setFocused(false);
    const parsed = parseNumberFromString(raw, locale);
    if (Number.isFinite(parsed)) {
      setRaw(formatNumberForLocale(parsed, locale, maximumFractionDigits));
    } else {
      setRaw("");
    }
  }

  const display = focused
    ? raw
    : raw === ""
    ? ""
    : (() => {
        const parsed = parseNumberFromString(raw, locale);
        return Number.isFinite(parsed)
          ? formatNumberForLocale(parsed, locale, maximumFractionDigits)
          : raw;
      })();

  return (
    <input
      {...rest}
      type="text"
      className={className}
      placeholder={placeholder}
      value={display}
      onChange={handleInputChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      inputMode="numeric"
    />
  );
}
