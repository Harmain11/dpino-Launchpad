import { createContext, useContext } from "react";

export const PROTECTED_PATHS = ["/dashboard", "/projects", "/stake", "/apply"];

export type WalletGateCtx = { openConnectModal: () => void };
export const WalletGateContext = createContext<WalletGateCtx>({ openConnectModal: () => {} });
export const useWalletGate = () => useContext(WalletGateContext);
