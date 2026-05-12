"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const token = localStorage.getItem("pipeline_token");
    router.replace(token ? "/records" : "/login");
  }, [router]);
  return null;
}
