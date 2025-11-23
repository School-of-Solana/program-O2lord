import { useState, useEffect, useCallback } from "react";
import type { Milestone } from "./useTrustPay";
import useTrustPay from "./useTrustPay";


interface WindowWithVolumeUtils extends Window {
  volumeUtils?: {
    resetVolume: () => boolean;
    getVolumeData: () => VolumeData;
  };
}

// Volume data structure
export interface VolumeData {
  currentMonth: number;
  previousMonth: number;
  month: number;
  year: number;
  processedIds: string[];
  lastUpdated: number;
}

// Event name for manual volume updates
export const MANUAL_VOLUME_UPDATE = "MANUAL_VOLUME_UPDATE";

// In-memory storage for volume data (no localStorage)
let volumeDataStore: VolumeData | null = null;

/**
 * Initialize volume data in memory with proper structure
 */
export const initializeVolumeData = (): VolumeData => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    if (volumeDataStore) {
      // Check if we need to rotate months
      if (
        volumeDataStore.month !== undefined &&
        volumeDataStore.year !== undefined &&
        (volumeDataStore.month !== currentMonth || volumeDataStore.year !== currentYear)
      ) {
        // Rotate months
        volumeDataStore = {
          currentMonth: 0,
          previousMonth: volumeDataStore.currentMonth || 0,
          month: currentMonth,
          year: currentYear,
          processedIds: [],
          lastUpdated: Date.now(),
        };
      }
    } else {
      // Create new data
      volumeDataStore = {
        currentMonth: 0,
        previousMonth: 0,
        month: currentMonth,
        year: currentYear,
        processedIds: [],
        lastUpdated: Date.now(),
      };
    }

    return volumeDataStore;
  } catch (e) {
    console.error("Error initializing volume data:", e);
    const now = new Date();
    return {
      currentMonth: 0,
      previousMonth: 0,
      month: now.getMonth(),
      year: now.getFullYear(),
      processedIds: [],
      lastUpdated: Date.now(),
    };
  }
};

/**
 * Reset volume data
 */
export const resetVolumeData = (): boolean => {
  try {
    volumeDataStore = null;
    const volumeData = initializeVolumeData();

    const event = new CustomEvent(MANUAL_VOLUME_UPDATE, {
      detail: volumeData,
    });
    window.dispatchEvent(event);

    return true;
  } catch (e) {
    console.error("Error resetting volume data:", e);
    return false;
  }
};

/**
 * Hook to track and calculate volume from trust pay contracts
 */
export const useVolume = () => {
  const [volumeData, setVolumeData] = useState<VolumeData>(() =>
    initializeVolumeData()
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { getTrustPayAccounts } = useTrustPay();

  const loadVolumeData = useCallback((): VolumeData => {
    return volumeDataStore || initializeVolumeData();
  }, []);

  const saveVolumeData = useCallback((data: VolumeData) => {
    volumeDataStore = data;
    setVolumeData(data);

    const event = new CustomEvent(MANUAL_VOLUME_UPDATE, {
      detail: data,
    });
    window.dispatchEvent(event);
  }, []);

  const calculateVolume = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const currentData = loadVolumeData();
      const accounts = getTrustPayAccounts.data;

      if (!accounts || accounts.length === 0) {
        setLoading(false);
        return;
      }

      let newVolume = 0;
      const newProcessedIds: string[] = [...currentData.processedIds];

      for (const accountData of accounts) {
        const account = accountData.account;
        const trustPayId = accountData.publicKey.toString();

        if (account.milestones && account.milestones.length > 0) {
          account.milestones.forEach((milestone: Milestone, index: number) => {
            const milestoneId = `${trustPayId}-milestone-${index}`;


            if (
              milestone.status === 2 && // APPROVED_BY_PAYER
              !currentData.processedIds.includes(milestoneId)
            ) {
              const amount = milestone.amount?.toNumber() || 0;
              newVolume += amount;
              newProcessedIds.push(milestoneId);
            }
          });
        }
      }

      if (newVolume > 0) {
        const updatedData: VolumeData = {
          ...currentData,
          currentMonth: currentData.currentMonth + newVolume,
          processedIds: newProcessedIds,
          lastUpdated: Date.now(),
        };

        saveVolumeData(updatedData);
      }

      setLoading(false);
    } catch (err) {
      console.error("Error calculating volume:", err);
      setError(
        err instanceof Error ? err.message : "Failed to calculate volume"
      );
      setLoading(false);
    }
  }, [getTrustPayAccounts.data, loadVolumeData, saveVolumeData]);

  useEffect(() => {
    const handleManualUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<VolumeData>;
      if (customEvent.detail) {
        setVolumeData(customEvent.detail);
      }
    };

    window.addEventListener(MANUAL_VOLUME_UPDATE, handleManualUpdate);

    return () => {
      window.removeEventListener(MANUAL_VOLUME_UPDATE, handleManualUpdate);
    };
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (getTrustPayAccounts.data) {
        calculateVolume();
      }
    }, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, [getTrustPayAccounts.data, calculateVolume]);


  const resetVolume = useCallback(() => {
    return resetVolumeData();
  }, []);

  const refreshVolume = useCallback(() => {
    calculateVolume();
  }, [calculateVolume]);

  return {
    volumeData,
    currentMonth: volumeData.currentMonth,
    previousMonth: volumeData.previousMonth,
    loading,
    error,
    resetVolume,
    refreshVolume,
  };
};

/**
 * Hook to get global state volume metrics
 */
export const useGlobalVolume = () => {
  const { getGlobalState } = useTrustPay();
  const [totalVolume, setTotalVolume] = useState<number | null>(null);
  const [highWatermarkVolume, setHighWatermarkVolume] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGlobalVolume = async () => {
      try {
        const globalState = getGlobalState.data;

        if (!globalState) {
          setLoading(false);
          return;
        }

        const total = globalState.totalVolume?.toNumber() || 0;
        const highWatermark = globalState.highWatermarkVolume?.toNumber() || 0;
        const decimals = globalState.tokenDecimals || 0;

        setTotalVolume(total / Math.pow(10, decimals));
        setHighWatermarkVolume(highWatermark / Math.pow(10, decimals));

        setError(null);
      } catch (err) {
        console.error("Error fetching global volume:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch global volume"
        );
      } finally {
        setLoading(false);
      }
    };

    if (getGlobalState.data) {
      fetchGlobalVolume();
    } else {
      setLoading(false);
    }
  }, [getGlobalState.data]);

  return {
    totalVolume,
    highWatermarkVolume,
    loading,
    error,
  };
};

/**
 * Initialize volume data on app mount
 */
export const useVolumeDataInitializer = (): void => {
  useEffect(() => {
    initializeVolumeData();

    (window as WindowWithVolumeUtils).volumeUtils = {
      resetVolume: resetVolumeData,
      getVolumeData: () => volumeDataStore || initializeVolumeData(),
    };

    return () => {
      delete (window as WindowWithVolumeUtils).volumeUtils;
    };
  }, []);
};