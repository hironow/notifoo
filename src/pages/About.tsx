import styles from "./About.module.css";

export function About() {
  return (
    <main className={styles.main}>
      <h2>About Page</h2>
      <wa-card className={styles.card}>
        <h2>Did you know?</h2>
        <p>
          PWAs have access to many useful APIs in modern browsers! These APIs have enabled many new
          types of apps that can be built as PWAs, such as advanced graphics editing apps, games,
          apps that use machine learning and more!
        </p>
        <p>
          Check out{" "}
          <a href="https://docs.microsoft.com/en-us/microsoft-edge/progressive-web-apps-chromium/how-to/handle-files">
            these docs
          </a>{" "}
          to learn more about the advanced features that you can use in your PWA
        </p>
      </wa-card>
    </main>
  );
}
