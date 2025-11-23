"use client";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NavBarItemType } from "@/types/NavBarItem.type";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

type Props = {
  item: NavBarItemType;
  onClick?: () => void;
  isMobile?: boolean;
};

const NavBarItem: React.FC<Props> = ({ item, onClick, isMobile = false }) => {
  const pathname = usePathname();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Check if current path matches any child items
  const isActive = item.link ? pathname === item.link : 
    item.children?.some(child => pathname === child.link) || false;

  // Check if any child is active (for parent highlighting)
  const hasActiveChild = item.children?.some(child => pathname === child.link) || false;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isDropdownOpen]);

  const handleMouseEnter = () => {
    if (!isMobile && item.hasDropdown) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setIsDropdownOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile && item.hasDropdown) {
      timeoutRef.current = setTimeout(() => {
        setIsDropdownOpen(false);
      }, 200);
    }
  };

  const handleClick = () => {
    if (item.hasDropdown) {
      if (isMobile) {
        setIsDropdownOpen(!isDropdownOpen);
      }
    } else if (onClick) {
      onClick();
    }
  };

  const handleChildClick = () => {
    setIsDropdownOpen(false);
    if (onClick) {
      onClick();
    }
  };

  // Mobile dropdown (accordion style)
  if (isMobile && item.hasDropdown) {
    return (
      <div className="w-full">
        <button
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "w-full justify-between text-lg text-muted-foreground hover:text-foreground",
            (hasActiveChild || isActive) && "text-foreground"
          )}
          onClick={handleClick}
        >
          <span>{item.label}</span>
          <ChevronDown 
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isDropdownOpen && "rotate-180"
            )} 
          />
        </button>
        {isDropdownOpen && (
          <div className="ml-4 mt-1 space-y-1">
            {item.children?.map((child) => (
              <Link
                key={child.label}
                href={child.link!}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "w-full justify-start text-base text-muted-foreground hover:text-foreground",
                  pathname === child.link && "text-foreground bg-muted"
                )}
                onClick={handleChildClick}
              >
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Desktop dropdown
  if (!isMobile && item.hasDropdown) {
    return (
      <div 
        className="relative flex items-center"
        ref={dropdownRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "flex items-center gap-1 text-lg text-muted-foreground hover:text-foreground",
            (hasActiveChild || isActive) && "text-foreground"
          )}
          onClick={handleClick}
        >
          {item.label}
          <ChevronDown className="h-4 w-4" />
        </button>
        
        {(hasActiveChild || isActive) && (
          <div className="absolute -bottom-[2px] left-1/2 h-[2px] w-[80%] -translate-x-1/2 rounded-xl bg-lime-500" />
        )}

        {isDropdownOpen && (
          <div className="absolute top-full left-0 z-50 mt-1 min-w-[200px] rounded-md border bg-background p-1 shadow-lg">
            {item.children?.map((child) => (
              <Link
                key={child.label}
                href={child.link!}
                className={cn(
                  "block w-full rounded-sm px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                  pathname === child.link && "bg-muted text-foreground"
                )}
                onClick={handleChildClick}
              >
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Regular link item (no dropdown)
  return (
    <div className="relative flex items-center w-full">
      <Link
        href={item.link!}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "w-full justify-start text-lg text-muted-foreground hover:text-foreground",
          isActive && "text-foreground"
        )}
        onClick={onClick}
      >
        {item.label}
      </Link>
      {isActive && !isMobile && (
        <div className="absolute -bottom-[2px] left-1/2 hidden h-[2px] w-[80%] -translate-x-1/2 rounded-xl bg-lime-500 md:block" />
      )}
    </div>
  );
};

export default NavBarItem;