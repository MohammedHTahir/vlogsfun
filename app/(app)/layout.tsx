import { Sidebar } from "@/components";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-1">
      <Sidebar />
      <main className="flex-1 pl-64">{children}</main>
    </div>
  );
}
