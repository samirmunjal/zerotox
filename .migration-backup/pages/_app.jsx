import dynamic from "next/dynamic";

// Disable SSR entirely — this app is client-only (localStorage, browser APIs)
const App = dynamic(() => import("./index"), { ssr: false });

export default function MyApp({ Component, pageProps }) {
  return <App {...pageProps} />;
}
