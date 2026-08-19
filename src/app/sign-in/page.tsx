import { AuthPanel } from "@/components/auth-panel";
import styles from "./page.module.css";

type SignInPageProps = {
  searchParams?: Promise<{ returnTo?: string | string[] }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const requestedReturnTo = typeof params?.returnTo === "string" ? params.returnTo : "/";
  const returnTo = requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//")
    ? requestedReturnTo
    : "/";

  return (
    <main className={styles.main}>
      <section className={styles.intro}>
        <h2>Sign up or sign in</h2>
        <p>Create a Player profile or use your verified phone number to return.</p>
      </section>
      <AuthPanel returnTo={returnTo} />
    </main>
  );
}
