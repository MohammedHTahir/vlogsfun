'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components';
import { Settings } from 'lucide-react';

export default function Header() {
  return (
    <header className="fixed top-0 right-0 left-0 border-b border-neutral-200 bg-white z-40">
      <div className="flex items-center justify-between px-6 h-16">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            {/* Logo includes the wordmark — no adjacent text. Icon only on mobile. */}
            <Image
              src="/logo-icon.png"
              alt="vlogs.fun"
              width={36}
              height={36}
              className="rounded-lg sm:hidden"
            />
            <Image
              src="/logo.png"
              alt="vlogs.fun"
              width={44}
              height={44}
              className="hidden rounded-lg sm:block"
            />
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
            <Settings size={20} className="text-neutral-600" />
          </button>
          <Button variant="ghost" size="md">
            Sign in
          </Button>
          <Button variant="primary" size="md">
            Sign up
          </Button>
        </div>
      </div>
    </header>
  );
}
