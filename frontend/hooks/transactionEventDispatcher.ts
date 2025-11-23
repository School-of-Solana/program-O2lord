import { PublicKey } from "@solana/web3.js";

// Define transaction event types
export enum TransactionType {
  MILESTONE_COMPLETE = "milestone_complete",
  MILESTONE_DISPUTED = "milestone_disputed",
  CONTRACT_ACCEPTED = "contract_accepted",
  CONTRACT_CREATED = "contract_created",
  MILESTONE_APPROVED = "milestone_approved",
  CONTRACT_COMPLETED = "contract_completed",
  PAYMENT_CONFIRMED = "payment_confirmed",
  GLOBAL_STATE_INITIALIZED = "global_state_initialized",
  ANY = "any_transaction",
}

// Transaction details interface
export interface TransactionDetails {
  type: TransactionType;
  trustPay?: PublicKey;
  amount?: number;
  signature?: string;
  timestamp: number;
  details?: Record<string, unknown>;
}

// Custom event type
export const TRANSACTION_EVENT = "trust_pay:transaction";

// In-memory storage for last transaction (no localStorage)
let lastTransaction: TransactionDetails | null = null;

class TransactionEventDispatcher {
  // Dispatch a transaction event
  public dispatchEvent(details: TransactionDetails): void {
    // Create and dispatch custom event
    const event = new CustomEvent(TRANSACTION_EVENT, {
      detail: details,
      bubbles: true
    });
    
    window.dispatchEvent(event);
    
    // Store the last transaction in memory
    this.storeLastTransaction(details);
  }

  // Store transaction data in memory
  private storeLastTransaction(details: TransactionDetails): void {
    try {
      lastTransaction = details;
    } catch (e) {
      console.error("Error storing transaction details:", e);
    }
  }

  // Get the last transaction from memory
  public getLastTransaction(): TransactionDetails | null {
    return lastTransaction;
  }
}

// Export singleton instance
export const transactionDispatcher = new TransactionEventDispatcher();
export default transactionDispatcher;