import Link from 'next/link';
import Image from 'next/image';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

/** Centered, full-screen card used by the sign-in and sign-up pages. */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#FFFFFF] px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_18%,rgba(255,116,82,0.12),transparent_26%),radial-gradient(circle_at_14%_82%,rgba(125,158,255,0.12),transparent_28%),linear-gradient(135deg,rgba(247,250,255,0.86)_0%,rgba(255,245,241,0.9)_52%,rgba(255,255,255,0.98)_100%)]" />

      <div className="relative w-full max-w-[420px]">
        <Link href="/" className="mb-7 flex items-center justify-center gap-3">
          {/* Logo includes the wordmark — no adjacent text. Icon only on mobile. */}
          <Image
            src="/logo-icon.png"
            alt="vlogs.fun"
            width={56}
            height={56}
            className="rounded-lg sm:hidden"
            priority
          />
          <Image
            src="/logo.png"
            alt="vlogs.fun"
            width={72}
            height={72}
            className="hidden rounded-lg sm:block"
            priority
          />
        </Link>

        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-7 shadow-[0_18px_40px_rgba(16,24,40,0.07)]">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold leading-8 text-[#0D1117]">{title}</h1>
            <p className="mt-1.5 text-sm leading-5 text-[#6B7280]">{subtitle}</p>
          </div>

          {children}
        </div>

        <p className="mt-5 text-center text-sm text-[#6B7280]">{footer}</p>
      </div>
    </div>
  );
}
