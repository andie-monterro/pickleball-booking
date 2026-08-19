"use client";

import { useEffect, useState } from "react";
import styles from "./app-header.module.css";

export function SignInLink() {
  const [href, setHref] = useState("/sign-in");

  useEffect(() => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    setHref(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  }, []);

  return (
    <a className={styles.signIn} href={href}>
      Sign in
    </a>
  );
}
