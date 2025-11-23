
import Link from "next/link";
import React from "react";
import Image from "next/image";

function Logo({ isMobile }: { isMobile?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2">
      {!isMobile ? (
        <img
          src="/logo.png"
          alt="Trust Pay Logo"
          width="32"
          height="32"
          className="rounded-full"
        />
      ) : null}
      <p className="bg-gradient-to-r from-lime-100 to-blue-500 bg-clip-text text-2xl font-bold leading-tight tracking-tighter text-transparent">
        Trust Pay
      </p>
    </Link>
  );
}

export default Logo;