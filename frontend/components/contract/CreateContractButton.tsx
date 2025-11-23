"use client";
import React from "react";
import{DollarSign} from "lucide-react"
import { Button } from "../ui/button";
import CreateContractDialog from "./CreateContractDialog";

type Props = {
  className?: string;
};

const CreateContractButton: React.FC<Props> = ({className}) => {
  return (
  <CreateContractDialog 
  trigger={
    <Button 
        variant="default" 
        className="bg-blue-600 hover:bg-blue-700 text-white"
        >
       <div className="relative flex items-center space-x-2">
        <div className="relative">
          <div className="relative bg-gradient-to-r from-blue-400 to-blue-300 p-1.5 rounded-md group">
          <DollarSign className="w-4 h-4 " />
          </div>
        </div>
      <span>
      Create Contract
      </span>    
       </div>   
      </Button>
    } 
  />);
};

export default CreateContractButton;
    