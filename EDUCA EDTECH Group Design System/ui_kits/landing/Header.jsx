// Header.jsx — sticky top nav for EDUCA EDTECH Group landing
function Header() {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: scrolled ? 'rgba(255,255,255,0.92)' : 'transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      borderBottom: scrolled ? '1px solid #E0E0E0' : '1px solid transparent',
      transition: 'all 200ms cubic-bezier(0.22,1,0.36,1)',
    }}>
      <div style={{
        maxWidth: 1280, margin: '0 auto', padding: '20px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <a href="#" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="../../assets/logo-horizontal.svg" alt="EDUCA EDTECH Group" style={{ height: 32 }} />
        </a>
        <nav style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          <a href="#instituciones" style={navLink}>Instituciones</a>
          <a href="#edtech" style={navLink}>EdTech</a>
          <a href="#investigacion" style={navLink}>Investigación</a>
          <a href="#contacto" style={navLink}>Contacto</a>
          <button style={{
            border: 0, borderRadius: 999, background: '#202020', color: '#fff',
            fontFamily: 'Lato', fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase',
            padding: '12px 26px', cursor: 'pointer',
          }}>Acceder</button>
        </nav>
      </div>
    </header>
  );
}
const navLink = { fontFamily: 'Lato', fontWeight: 700, fontSize: 14, color: '#202020', textDecoration: 'none' };
window.Header = Header;
