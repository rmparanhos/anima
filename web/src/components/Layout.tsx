import { Outlet } from "react-router-dom"
import { Link } from "react-router-dom"

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const baseStyle: React.CSSProperties = {
    color: "#8888aa",
    textDecoration: "none",
    fontSize: "14px",
    padding: "6px 10px",
    borderRadius: "6px",
    transition: "color 0.15s, background 0.15s",
  }
  return (
    <Link
      to={to}
      style={baseStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "#e2e2e9"
        e.currentTarget.style.background = "#2a2a3a"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "#8888aa"
        e.currentTarget.style.background = "transparent"
      }}
    >
      {children}
    </Link>
  )
}

export default function Layout() {
  return (
    <>
      <nav
        style={{
          background: "#16161f",
          borderBottom: "1px solid #2a2a3a",
          padding: "0 24px",
          height: "48px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span style={{ fontWeight: 700, color: "#fff", marginRight: "16px", fontSize: "15px" }}>
          anima
        </span>
        <NavLink to="/chat">chat</NavLink>
        <NavLink to="/pending">pending</NavLink>
        <NavLink to="/docs">docs</NavLink>
      </nav>
      <Outlet />
    </>
  )
}
