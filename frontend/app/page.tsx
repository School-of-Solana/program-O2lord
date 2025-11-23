'use client'

import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, JSX } from 'react';
import { ChevronRight, Shield, Lock, Zap } from 'lucide-react';

type FeatureCardProps = {
  icon: JSX.Element;
  title: string;
  description: string;
  delay?: number;
};
export default function Home() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
        <section className="relative min-h-screen flex flex-col items-center justify-center pt-16 overflow-hidden">
      {/* Background particles */}
      <div className="absolute inset-0 z-0">
        <ParticleBackground />
      </div> 
      
      {/* Content */}
      <div className="container relative z-10 mx-auto px-4 py-12 md:py-20 text-center">
        <div className={`space-y-6 max-w-4xl mx-auto transition-all duration-1000 ${isVisible ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-10'}`}>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-500 via-blue-500 to-teal-500 pb-2">
            Trust Pay
          </h1>
          <div className="max-width flex items-center justify-center gap-4">
            <Link href="/users" className="flex items-center">
              <img
                src={"/logo.png"}
                alt="Trust Pay Logo"
                width="220"
                height="220"
                className="rounded-full "
              />
            </Link>
          </div>
          <p className="text-xl md:text-2xl text-foreground/80 max-w-3xl mx-auto leading-relaxed">
            Your secure digital vault for managing your contracts and payments safely.
          </p>
          <p className="text-sm md:text-base text-foreground/60 max-w-3xl mx-auto leading-relaxed mt-2">
            &apos;Work without worrying about payments.&apos;
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <Button variant="gradient" size="lg" className="group">
              <Link href={"/users"} className="flex items-center"> 
              Get Started
              <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button variant="outline" size="lg">
              <Link href={"/about"} className="flex items-center">
                
              Learn More
             </Link>
            </Button>
          </div>      
          <div className="pt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <FeatureCard 
              icon={<Shield className="h-6 w-6 text-purple-500" />}
              title="Secure Trust Pay"
              description="All transactions are secured through our advanced Escrow system"
              delay={300}
            />
            <FeatureCard 
              icon={<Lock className="h-6 w-6 text-blue-500" />}
              title="End-to-End Encryption"
              description="Your data is encrypted and never exposed to third parties"
              delay={500}
            />
            <FeatureCard 
              icon={<Zap className="h-6 w-6 text-teal-500" />}
              title="Instant Settlements"
              description="Complete transactions in seconds with our optimized protocols"
              delay={700}
            />
          </div>
        </div>
      </div>
    </section>
    </>
  );
}

function FeatureCard({ icon, title, description, delay = 0 } : FeatureCardProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div 
      className={`bg-card/30 backdrop-blur-sm p-6 rounded-xl border border-border/50 transition-all duration-1000 hover:bg-card/50 hover:shadow-lg hover:shadow-primary/5 ${
        isVisible ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-10'
      }`}
    >
      <div className="p-3 bg-background rounded-lg inline-block mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-foreground/70 text-sm">{description}</p>
    </div>
  );
}

function ParticleBackground() {
  return (
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-background via-background to-background overflow-hidden">
      <div className="stars-container">
        <div className="stars"></div>
        <div className="stars2"></div>
        <div className="stars3"></div>
      </div>
    </div>
  );
}