import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#0f172a",
      color: "#f8fafc",
      fontFamily: "sans-serif"
    }}>
      <h1 style={{ fontSize: "3rem", fontWeight: 700, margin: 0 }}>404</h1>
      <p style={{ color: "#94a3b8", fontSize: "1.1rem", marginTop: "0.5rem" }}>Página no encontrada</p>
      <Link href="/" style={{
        marginTop: "1.5rem",
        padding: "0.6rem 1.2rem",
        backgroundColor: "#3b82f6",
        color: "#ffffff",
        borderRadius: "0.375rem",
        textDecoration: "none",
        fontWeight: 600
      }}>
        Volver al inicio
      </Link>
    </div>
  );
}
