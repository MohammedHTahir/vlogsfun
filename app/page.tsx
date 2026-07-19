import Link from "next/link";
import { Button, Card } from "@/components";

export default function Home() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="max-w-6xl mx-auto px-6 py-20">
        {/* Hero Section */}
        <div className="mb-20">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-primary-600 rounded-base flex items-center justify-center text-white text-3xl font-bold">
              ⬡
            </div>
            <div>
              <h1 className="text-h1 text-neutral-900">
                AI Shopify Theme Builder
              </h1>
              <p className="text-body-lg text-neutral-500 mt-2">
                Generate beautiful Shopify themes with AI
              </p>
            </div>
          </div>
          <p className="text-body-lg text-neutral-600 max-w-2xl mb-8">
            Enter a prompt describing your Shopify website, generate responsive HTML and Tailwind CSS storefronts in real time, and export a complete Shopify theme.
          </p>
          <div className="flex gap-4 flex-wrap">
            <Button variant="primary" size="lg" asChild>
              <Link href="/builder">Start Building</Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/design-system">View Design System</Link>
            </Button>
          </div>
        </div>

        {/* Features */}
        <section className="mb-20">
          <h2 className="text-h2 mb-8 text-neutral-900">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: "✨",
                title: "AI Generation",
                desc: "Generate complete store designs from simple text prompts",
              },
              {
                icon: "👁️",
                title: "Live Preview",
                desc: "See changes in real-time as the AI builds your theme",
              },
              {
                icon: "✏️",
                title: "Inline Editing",
                desc: "Edit sections and elements without regenerating everything",
              },
              {
                icon: "🔄",
                title: "Revisions",
                desc: "Track and manage all versions of your design",
              },
              {
                icon: "📦",
                title: "Shopify Export",
                desc: "Download a complete, production-ready Shopify theme",
              },
              {
                icon: "🎨",
                title: "Design System",
                desc: "Built with a consistent, accessible design language",
              },
            ].map((feature) => (
              <Card key={feature.title} shadow="sm" padding="lg">
                <div className="text-3xl mb-3">{feature.icon}</div>
                <h3 className="text-h4 text-neutral-900 mb-2">{feature.title}</h3>
                <p className="text-body-sm text-neutral-600">{feature.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Supported Pages */}
        <section>
          <h2 className="text-h2 mb-8 text-neutral-900">Supported Pages</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {["Home", "Product", "Collection", "Cart", "Custom"].map((page) => (
              <Card key={page} shadow="sm" padding="md" className="text-center">
                <p className="text-body-base text-neutral-900 font-medium">{page}</p>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
