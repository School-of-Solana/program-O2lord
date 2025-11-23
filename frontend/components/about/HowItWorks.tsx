import { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import Link from 'next/link';

type TimelineStepProps = {
  number: string;
  title: string;
  description: string;
  isLeft: boolean;
  index: number;
};

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 bg-muted/30 relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            How <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-blue-500">It Works</span>
          </h2>
          <p className="text-foreground/70 max-w-2xl mx-auto">
            TrustPay makes P2P transactions simple, secure, and stress-free in just a few steps.
          </p>
        </div>
        
        <div className="max-w-4xl mx-auto">
          <Timeline />
        </div>
        
        <div className="text-center mt-16"
        >
          <Button variant="gradient" size="lg">
             <Link href={"/explorer"} className="flex items-center"> 
            Start Your First Transaction
            </Link>
          </Button>
        </div>
      </div>
      
      {/* Background gradient */}
      <div className="absolute top-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
    </section>
  );
}

function Timeline() {
  const steps = [
    {
      number: "01",
      title: "Connect Your Wallet",
      description: "Securely connect your preferred crypto wallet with just a few clicks. We support multiple wallet providers.",
    },
    {
      number: "02",
      title: "Create a Contract",
      description: "Specify the details of your contract, including Your Role(Service Provider or client), type of contract (One Time or Milestone), amount, recipient, and T&C that must be met.",
    },
    {
      number: "03",
      title: "Secure Funds in vaults",
      description: "Funds are held securely in our smart-contract vault until all conditions are verified and met by both parties.",
    },
    {
      number: "04",
      title: "Complete the Work",
      description: "Service Provider Marks the Work as complete and sends evidence to the Client.",
    },
     {
      number: "05",
      title: "Approve Payment",
      description: "Once the client verifies the work, they approve payment and the funds are released to the Service Providers Wallet.",
    },
  ];

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-500 to-blue-500 transform md:-translate-x-0.5"></div>
      
      <div className="space-y-12">
        {steps.map((step, index) => (
          <TimelineStep 
            key={index}
            number={step.number}
            title={step.title}
            description={step.description}
            isLeft={index % 2 === 0}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

function TimelineStep({ number, title, description, isLeft, index }: TimelineStepProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (observerRef.current && ref.current) {
            observerRef.current.unobserve(ref.current);
          }
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current && observerRef.current) {
      observerRef.current.observe(ref.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div 
      ref={ref}
      className={`relative flex flex-col md:flex-row ${isLeft ? 'md:flex-row-reverse' : ''} items-center transition-all duration-700 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ transitionDelay: `${index * 200}ms` }}
    >
      {/* Timeline dot */}
      <div className="absolute left-4 md:left-1/2 w-8 h-8 bg-background rounded-full border-2 border-primary shadow-lg transform -translate-y-1/2 md:-translate-x-1/2 z-10 flex items-center justify-center">
        <div className="w-3 h-3 bg-primary rounded-full"></div>
      </div>
      
      {/* Content */}
      <div className={`md:w-1/2 pl-16 md:pl-0 ${isLeft ? 'md:pr-12' : 'md:pl-12'}`}>
        <div className="bg-card/40 backdrop-blur-sm p-6 rounded-xl border border-border/50 hover:shadow-lg transition-all">
          <div className="text-sm font-mono text-primary mb-2">{number}</div>
          <h3 className="text-xl font-semibold mb-2">{title}</h3>
          <p className="text-foreground/70">{description}</p>
        </div>
      </div>
    </div>
  );
}