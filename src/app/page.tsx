import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Google Drive Video Player</h1>
      <p>Select an area:</p>
      <ul>
        <li>
          <Link href="/config">Admin configuration</Link>
        </li>
        <li>
          <Link href="/player">Video player</Link>
        </li>
      </ul>
    </main>
  );
}
