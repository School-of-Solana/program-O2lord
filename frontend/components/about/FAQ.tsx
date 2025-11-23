import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
type AccordionItemProps = {
    question: string;
    answer: string;
};

export function FAQ() {
  const faqs = [
    {
      question: "What is Trust Pay?",
      answer: "Trust Pay is a secure platform for conducting peer-to-peer transactions using cryptocurrency. We provide escrow services, multi-signature protection, and secure transaction protocols to ensure safe exchanges between parties."
    },
    {
      question: "How does the Trust Pay system work?",
      answer: "Our vault system holds funds in a secure smart contract until all conditions of the transaction are met. This protects both the Client and Service by ensuring that funds are only released when both parties are satisfied."
    },
    {
      question: "Which cryptocurrencies are supported?",
      answer: "TrustPay currently supports our test USDC & USDT which you can get via the airdrop button. Once on mainnet we would support additional cryptocurrencies."
    },
    {
      question: "How are my funds secured?",
      answer: "Your funds are secured through a combination of multi-signature technology, smart contracts, and end-to-end encryption. We never have direct access to your private keys, ensuring that you maintain full control of your assets."
    },
    {
      question: "What fees does TrustPay charge?",
      answer: "TrustPay charges a small fee of 0.05% per successful transaction. There are no monthly fees, setup costs, or hidden charges. You only pay when you complete a transaction."
    },
    {
      question: "Can I use TrustPay internationally?",
      answer: "Yes, TrustPay is available worldwide. Our platform facilitates global transactions without the limitations of traditional banking systems, allowing you to transact with anyone, anywhere."
    }
  ];

  return (
    <section id="faq" className="py-20 bg-background relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Frequently Asked <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-blue-500">Questions</span>
          </h2>
          <p className="text-foreground/70 max-w-2xl mx-auto">
            Find answers to common questions about TrustPay and our services.
          </p>
        </div>
        
        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem 
              key={index}
              question={faq.question}
              answer={faq.answer}
            />
          ))}
        </div>
      </div>
      
      {/* Background gradient */}
      <div className="absolute -top-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"></div>
    </section>
  );
}

function AccordionItem({ question, answer }: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 text-left focus:outline-none focus:ring-2 focus:ring-primary/50"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-medium">{question}</span>
        {isOpen ? 
          <ChevronUp className="h-5 w-5 text-primary" /> : 
          <ChevronDown className="h-5 w-5 text-foreground/70" />
        }
      </button>
      
      <div 
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? 'max-h-96' : 'max-h-0'
        }`}
      >
        <div className="p-4 pt-0 text-foreground/70">
          {answer}
        </div>
      </div>
    </div>
  );
}