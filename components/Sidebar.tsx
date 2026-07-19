'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FolderOpen, Sparkles } from 'lucide-react';

const navigationItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/inspiration', label: 'Inspiration', icon: Sparkles },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-56 border-r border-neutral-200 bg-white px-6 py-8 overflow-y-auto">
      <nav className="space-y-2">
        {navigationItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-orange-50 text-orange-600'
                  : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-12 pt-8 border-t border-neutral-200">
        <p className="text-xs text-neutral-600 font-medium">
          Build amazing Shopify themes with the power of AI.
        </p>
      </div>
    </aside>
  );
}
