import type { ReactNode } from "react";
import { BarChart3, ClipboardCheck, Landmark } from "lucide-react";
import { LogoFull } from "@/components/shared/Logo";
import { siteConfig } from "@/config/site";

const highlights = [
  { icon: Landmark, text: "GAA upload, appropriations and allotments in one place" },
  { icon: ClipboardCheck, text: "Track obligations from review to posting" },
  { icon: BarChart3, text: "Generate BFARS 1–11 financial reports" },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-sidebar lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="absolute -top-32 -right-32 size-[28rem] rounded-full bg-brand-600/25 blur-3xl" />
        <div aria-hidden className="absolute -bottom-40 -left-24 size-[26rem] rounded-full bg-brand-700/20 blur-3xl" />
        <div className="relative">
          <div className="inline-flex rounded-2xl bg-white px-6 py-5 shadow-xl">
            <LogoFull className="w-48" />
          </div>
        </div>
        <div className="relative max-w-lg">
          <h2 className="text-4xl leading-tight font-bold text-white">{siteConfig.tagline}</h2>
          <p className="mt-4 text-lg text-gray-300">
            A unified workspace for budget officers, accountants and agency heads.
          </p>
          <ul className="mt-8 space-y-4">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-gray-200">
                <span className="flex size-10 items-center justify-center rounded-lg bg-brand-600/90 text-white">
                  <Icon className="size-5" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-gray-400">© 2026 {siteConfig.name}. All rights reserved.</p>
      </section>
      <main className="flex items-center justify-center bg-surface px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center lg:hidden">
            <LogoFull className="w-40" />
          </div>
          <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-sm sm:p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
