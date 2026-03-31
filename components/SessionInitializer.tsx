"use client";

import { useEffect } from "react";

export default function SessionInitializer() {
  useEffect(() => {
    fetch("/api/session").catch(console.error);
  }, []);

  return null;
}
