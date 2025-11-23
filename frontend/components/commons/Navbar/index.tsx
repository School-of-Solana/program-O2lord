import React from "react";
import DesktopNavBar from "./DesktopNavBar";
import MobileNavBar from "./MobileNavBar";



const NavBar: React.FC = () => {
  return (
    <>
      <DesktopNavBar />
      <MobileNavBar />
    </>
  );
};

export default NavBar;
