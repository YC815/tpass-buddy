"use client";

// 相機掃不到時的備援：手打對方螢幕上的六位數碼。
//
// 活動現場一定會有人拒絕相機權限、或手機就是不配合。沒有這條路，那些人當場就出局了。
import { useRef, useState } from "react";
import { Button } from "@/components/ui/primitives";

export function CodeInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (code: string) => void;
  disabled?: boolean;
}) {
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function change(next: string) {
    const digits = next.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    // 打滿就送，省一次點擊——現場兩個人舉著手機對打，少一步是一步。
    if (digits.length === 6) onSubmit(digits);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === 6) onSubmit(code);
      }}
      className="flex items-center gap-2"
    >
      <input
        ref={inputRef}
        value={code}
        onChange={(e) => change(e.target.value)}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        placeholder="000000"
        aria-label="對方的六位數配對碼"
        className="w-40 rounded-xl border-2 border-foreground bg-card px-3 py-2 text-center font-mono text-xl font-bold tracking-[0.3em] text-foreground outline-none transition-shadow placeholder:text-muted-foreground/40 focus:shadow-[3px_3px_0_0_var(--color-ring)] disabled:opacity-50"
      />
      <Button type="submit" variant="primary" disabled={disabled || code.length !== 6}>
        相認
      </Button>
    </form>
  );
}
