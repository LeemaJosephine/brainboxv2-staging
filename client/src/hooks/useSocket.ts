import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { apiBaseUrl } from "../env";

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(apiBaseUrl, { transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    return () => {
      socket.off("connect").off("disconnect");
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { socket: socketRef.current, connected };
}

export function getSocket(): Socket | null {
  return io(apiBaseUrl, { transports: ["websocket", "polling"] });
}
