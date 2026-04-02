import { Navbar } from "@/components/Navbar";

export default function ForumLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 min-h-screen">
      <Navbar />
      {children}
    </div>
  );
}
