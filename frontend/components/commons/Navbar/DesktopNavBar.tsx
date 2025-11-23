"use client";
import React from "react";
import Logo from "../Logo";
import { NAVBAR_ITEMS } from "@/lib/constants";
import NavBarItem from "./NavBarItem";
import { ThemeSwitcherButton } from "../ThemeSwitcherButton";
import ConnectWalletButton from "@/components/ConnectWalletButton";
import { useWallet } from "@solana/wallet-adapter-react";



const DesktopNavBar: React.FC = () => {
  const { publicKey } = useWallet();
  const adminAddress = process.env.NEXT_PUBLIC_ADMIN_WALLET;
  const isAdmin = publicKey?.toBase58() === adminAddress;

  const navItems = isAdmin
    ? [...NAVBAR_ITEMS, { label: "Admin", link: "/admin" }]
    : NAVBAR_ITEMS;

  return (
    <div className="hidden border-separate border-b bg-background md:block">
      <nav className="container flex items-center justify-between px-8">
        <div className="flex h-[80px] min-h-[60px] items-center gap-x-4">
          <Logo />
          <div className="flex h-full items-center">
            {navItems.map((item) => (
              <NavBarItem key={item.label} item={item} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitcherButton />
          <ConnectWalletButton />
        </div>
      </nav>
    </div>
  );
};

export default DesktopNavBar;