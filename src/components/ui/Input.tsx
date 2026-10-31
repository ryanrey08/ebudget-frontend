import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
}

export const fieldClasses =
  "block w-full rounded-lg border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 transition-colors " +
  "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none " +
  "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500";

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, leftIcon, rightSlot, ...props },
  ref,
) {
  return (
    <div className="relative">
      {leftIcon && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">{leftIcon}</span>
      )}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          fieldClasses,
          "h-10 px-3",
          leftIcon && "pl-9",
          rightSlot && "pr-10",
          invalid && "border-red-400 focus:border-red-500 focus:ring-red-500/20",
          className,
        )}
        {...props}
      />
      {rightSlot && <span className="absolute inset-y-0 right-1 flex items-center">{rightSlot}</span>}
    </div>
  );
});
