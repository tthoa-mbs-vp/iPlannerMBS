import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Open/close state + keyboard contract for the dropdown menus (export, filters, …).
 *
 * Every menu in this app had the same shape: a trigger button plus a
 * click-outside backdrop. That left two accessibility gaps:
 *   • `aria-expanded` was never set, so assistive tech could not tell whether
 *     the menu was open or closed.
 *   • Escape did nothing. The only way to dismiss was to click the backdrop,
 *     which a keyboard user cannot reach, so the menu stayed open until focus
 *     happened to leave the region.
 *
 * The hook owns the open state so the caller never has to wire the two
 * together by hand.
 *
 * Usage:
 *   const menu = useDismissableMenu();
 *   <button {...menu.triggerProps} onClick={menu.toggle}>…</button>
 *   {menu.open && <div onClick={menu.close} />}
 */
export function useDismissableMenu() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      // Return focus to the trigger, otherwise focus falls to <body> and the
      // next Tab restarts from the top of the page.
      triggerRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return {
    open,
    toggle,
    close,
    triggerRef,
    // Spread onto the trigger button.
    triggerProps: {
      ref: triggerRef,
      "aria-expanded": open,
      "aria-haspopup": "menu" as const,
    },
  };
}
