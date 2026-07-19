'use client';

import { Input } from "@/components";
import { Send, Wand2, AtSign, LayoutTemplate, ShoppingCart, Grid3x3, Zap } from "lucide-react";
import Image from "next/image";

const templateCards = [
  {
    icon: LayoutTemplate,
    title: "Create a landing page",
    desc: "High-converting hero section with modern design",
  },
  {
    icon: ShoppingCart,
    title: "Build product page",
    desc: "Beautiful product showcase that drives sales",
  },
  {
    icon: ShoppingCart,
    title: "Design cart page",
    desc: "Streamlined cart experience that boosts checkout",
  },
  {
    icon: Grid3x3,
    title: "Explore collection page",
    desc: "Display your products in stunning collections",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-linear-to-br from-white via-orange-50/30 to-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <h1 className="text-5xl md:text-6xl font-bold text-neutral-900 mb-6 leading-tight">
            Build stunning Shopify themes<br />
            with the power of <span className="text-orange-600">AI&nbsp;+</span>
          </h1>
          <p className="text-lg text-neutral-600 mb-4">
            Describe a page, pick a starting point, or get inspired.
          </p>
          <p className="text-lg text-neutral-600 mb-12">
            I&apos;ll generate a fully editable Shopify template for you.
          </p>

          {/* Input Section */}
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6 mb-8">
            <div className="flex gap-3 mb-4">
              <Input
                placeholder="Ask me to build a Shopify page or theme..."
                className="flex-1 border-0 px-0 py-0 text-base placeholder:text-neutral-400"
              />
              <button className="p-3 hover:bg-neutral-100 rounded-lg transition-colors">
                <Send size={20} className="text-orange-600" />
              </button>
            </div>
            <div className="flex gap-2">
              <button className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50 rounded-lg transition-colors">
                <Wand2 size={16} />
                AI
              </button>
              <button className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50 rounded-lg transition-colors">
                <AtSign size={16} />
              </button>
            </div>
          </div>

          {/* Template Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
            {templateCards.map((card) => {
              const IconComponent = card.icon;
              return (
                <div
                  key={card.title}
                  className="bg-white rounded-lg border border-neutral-200 p-6 hover:border-orange-300 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <div className="text-left">
                      <div className="mb-3">
                        <IconComponent size={24} className="text-neutral-600 group-hover:text-orange-600 transition-colors" />
                      </div>
                      <h3 className="text-base font-semibold text-neutral-900 mb-1">
                        {card.title}
                      </h3>
                      <p className="text-sm text-neutral-600">
                        {card.desc}
                      </p>
                    </div>
                    <div className="text-neutral-400 group-hover:text-orange-600 transition-colors">
                      →
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Section */}
          <div className="bg-linear-to-r from-orange-50 to-yellow-50 rounded-lg border border-orange-200 p-8 flex items-center gap-6">
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={20} className="text-orange-600" />
                <h3 className="text-lg font-semibold text-neutral-900">
                  From idea to live store
                </h3>
              </div>
              <p className="text-neutral-600 text-sm">
                Generate, customize, and export production-ready themes in minutes.
              </p>
            </div>
            <div className="shrink-0">
              <Image
                src="/shopify-logo.png"
                alt="Shopify"
                width={80}
                height={80}
                className="opacity-80"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
