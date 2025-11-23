'use client'
import { HowItWorks } from "@/components/about/HowItWorks";
import {FAQ} from "@/components/about/FAQ";
import { Footer } from "@/components/about/Footer";

export default function Home() {
  return (
    <>
    <section id="features" className="py-20 bg-background relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Powerful <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-blue-500">Features</span>
          </h2>
          <p className="text-foreground/70 max-w-2xl mx-auto">
            Designed with security and simplicity in mind, TrustPay provides everything you need for safe P2P transactions.
          </p>
        </div>
      </div>
      <HowItWorks />
       <FAQ/>
    </section>
    <Footer />
    </>
  );
}


