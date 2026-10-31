"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/Input";

export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, "type" | "rightSlot">>(
  function PasswordInput(props, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        leftIcon={<Lock className="size-4" />}
        rightSlot={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="rounded-md p-1.5 text-gray-400 hover:text-gray-600"
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        }
        {...props}
      />
    );
  },
);
