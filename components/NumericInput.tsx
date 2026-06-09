'use client';

import React, { useEffect, useState } from "react";

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
  
  // Utilisation directe de Intl.NumberFormat pour un formatage parfait et sans bug
  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: maximumFractionDigits,
    minimumFractionDigits: 0, // N'affiche les décimales que si elles existent
  });

  // Fonction locale ultra-robuste pour nettoyer n'importe quel séparateur de milliers (espace normal, espace insécable, etc.)
  const parseStringToNumber = (str: string): number | null => {
    if (!str) return null;
    // Remplace les virgules par des points et supprime tous les types d'espaces
    const cleanStr = str.replace(/,/g, '.').replace(/\s/g, '').replace(/\u00a0/g, '');
    const parsed = parseFloat(cleanStr);
    return Number.isFinite(parsed) ? parsed : null;
  };

  // Valeur brute textuelle pour l'édition dans l'input
  const [inputValue, setInputValue] = useState<string>("");

  // Synchronisation avec la valeur externe venant de Supabase/State parent
  useEffect(() => {
    if (value === null || value === undefined) {
      setInputValue("");
    } else if (!focused) {
      // Quand on n'a pas le focus, on affiche DIRECTEMENT la version formatée avec séparateur de milliers
      setInputValue(formatter.format(value));
    }
  }, [value, focused]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    let targetValue = e.target.value;

    // Autoriser uniquement les chiffres, la virgule, le point et les espaces pendant la saisie
    targetValue = targetValue.replace(/[^0-9.,\s]/g, "");
    
    setInputValue(targetValue);

    // Convertir en vrai nombre et envoyer au parent
    const parsedNumber = parseStringToNumber(targetValue);
    onChange?.(parsedNumber);
  }

  function handleFocus() {
    setFocused(true);
    // Quand on clique, on repasse le nombre en brut (ex: "1500000" ou "1500.50") pour pouvoir le modifier facilement
    const parsedNumber = parseStringToNumber(inputValue);
    setInputValue(parsedNumber !== null ? String(parsedNumber).replace('.', ',') : "");
  }

  function handleBlur() {
    setFocused(false);
    // Quand on sort du champ, on applique le magnifique formatage avec les espaces de milliers
    const parsedNumber = parseStringToNumber(inputValue);
    if (parsedNumber !== null) {
      setInputValue(formatter.format(parsedNumber));
    } else {
      setInputValue("");
    }
  }

  return (
    <input
      {...rest}
      type="text"
      className={className}
      placeholder={placeholder}
      value={inputValue}
      onChange={handleInputChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      inputMode="decimal" // "decimal" est encore mieux que "numeric" car il affiche aussi la virgule sur le clavier mobile
    />
  );
}