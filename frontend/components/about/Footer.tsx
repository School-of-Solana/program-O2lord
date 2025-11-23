import { Logo } from './Logo';
import { Github, Twitter, Linkedin, Mail } from 'lucide-react';
import React from 'react';

type SocialLinkProps = {
    icon: React.ReactElement;
    href: string;
    label: string;
};
type FooterLinkProps = {
    href: string;
    children: React.ReactNode;
};
export function Footer() {
  return (
    <footer className="bg-muted/20 border-t border-border/50 pt-12 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-1 md:col-span-1">
            <Logo />
            <p className="mt-4 text-foreground/70 text-sm">
              Secure your P2P transactions with the most trusted platform for digital escrow services.
            </p>
            <div className="flex space-x-4 mt-6">
              <SocialLink icon={<Twitter size={18} />} href="https://x.com/emmanuel_o2" label="Twitter" />
              <SocialLink icon={<Github size={18} />} href="https://github.com/O2lord" label="GitHub" />
              <SocialLink icon={<Linkedin size={18} />} href="#" label="LinkedIn" />
              <SocialLink icon={<Mail size={18} />} href="#" label="Email" />
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4">Product</h3>
            <ul className="space-y-2">
              <FooterLink href="#features">Features</FooterLink>
              <FooterLink href="#security">Security</FooterLink>
              <FooterLink href="/about#how-it-works">How It Works</FooterLink>
              <FooterLink href="/about#faq">FAQ</FooterLink>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4">Company</h3>
            <ul className="space-y-2">
              <FooterLink href="/about">About Us</FooterLink>
              <FooterLink href="#blog">Blog</FooterLink>
              <FooterLink href="#careers">Careers</FooterLink>
              <FooterLink href="#contact">Contact</FooterLink>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <FooterLink href="#terms">Terms of Service</FooterLink>
              <FooterLink href="#privacy">Privacy Policy</FooterLink>
              <FooterLink href="#cookies">Cookie Policy</FooterLink>
              <FooterLink href="#compliance">Compliance</FooterLink>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-border/50 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-foreground/60">
            © {new Date().getFullYear()} TrustPay. All rights reserved.
          </p>
          <p className="text-sm text-foreground/60 mt-2 md:mt-0">
            Built with security and privacy in mind.
          </p>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({ icon, href, label } : SocialLinkProps) {
  return (
    <a 
      href={href} 
      aria-label={label}
      className="h-8 w-8 flex items-center justify-center rounded-full bg-background border border-border hover:bg-primary/10 hover:border-primary/50 transition-colors"
    >
      {icon}
    </a>
  );
}

function FooterLink({ href, children } : FooterLinkProps) {
  return (
    <li>
      <a 
        href={href} 
        className="text-sm text-foreground/70 hover:text-primary transition-colors"
      >
        {children}
      </a>
    </li>
  );
}