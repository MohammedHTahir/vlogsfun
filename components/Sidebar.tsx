'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Home, FolderOpen, Lightbulb, CreditCard } from 'lucide-react';
import SidebarUser from './SidebarUser';
import SidebarBilling from './billing/SidebarBilling';

const navigationItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/billing', label: 'Billing', icon: CreditCard },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[#E5E7EB] bg-white px-5 py-8">
      <Link href="/" className="mb-9 flex items-center gap-3 px-1">
        {/* Logo includes the wordmark — no adjacent text (sidebar is desktop-only). */}
        <Image
          src="/logotext.png"
          alt="vlogs.fun"
          width={140}
          height={48}
          className="shrink-0"
          priority
        />
      </Link>

      <nav className="space-y-1.5">
        {navigationItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-[15px] transition-colors ${isActive
                ? 'bg-[#0D1117] text-white'
                : 'text-[#3B424B] hover:bg-[#F3F4F6]'
                }`}
            >
              <span className={`grid h-7 w-7 place-items-center rounded-md ${isActive ? 'bg-white/10' : 'bg-[#F1F2F5]'}`}>
                <Icon size={18} strokeWidth={1.8} />
              </span>
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">
        <SidebarBilling />
        <SidebarUser />
      </div>
    </aside>
  );
}
