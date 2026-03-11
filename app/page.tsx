import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Grid - Adjusted for Light Theme */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      {/* Radial Gradient overlay - subtler for light theme */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent to-white/80 pointer-events-none" />

      <div className="z-10 text-center space-y-12">
        <h1
          className="text-6xl md:text-9xl font-black tracking-tighter glitch-text select-none text-neutral-900"
          data-text="BFH SANDBOX"
        >
          BFH SANDBOX
        </h1>

        <p className="text-xl md:text-2xl font-mono tracking-widest opacity-80 uppercase text-neutral-600">
          Neural Interface v2.0.25
        </p>

        <Link
          href="/login"
          className="cyber-button inline-flex items-center px-10 py-4 text-xl font-bold group"
        >
          Enter System
          <ArrowRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* Footer / Decorative Tech Specs */}
      <div className="absolute bottom-8 left-8 text-xs text-neutral-500 font-mono flex flex-col gap-1">
        <span>SYS.STATUS: ONLINE</span>
        <span>SEC.LEVEL: MAX</span>
        <span>LATENCY: 12ms</span>
      </div>

      <div className="absolute bottom-8 right-8 text-xs text-neutral-500 font-mono">
        &copy; 2025 BFH DEV DIVISION
      </div>
    </main>
  );
}
