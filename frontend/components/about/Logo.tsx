
import Image from 'next/image';

export function Logo() {
  return (
    <div className="flex items-center space-x-2">
      <div className="relative">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
          <Image
            src="/logo.png"
            alt="TrustPay Logo"
            width={120}
            height={120}
            className="rounded-full"
          />
        </div>
        <div className="absolute -inset-0.5 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 opacity-50 blur-sm"></div>
      </div>
      <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-blue-500">
        TrustPay
      </span>
    </div>
  );
}