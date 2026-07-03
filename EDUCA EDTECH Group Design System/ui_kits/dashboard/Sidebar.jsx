// Sidebar.jsx
function Sidebar({ active, onNav }) {
  const items = [
    { key: 'home', icon: 'home', label: 'Inicio' },
    { key: 'courses', icon: 'book-open', label: 'Mis cursos' },
    { key: 'paths', icon: 'route', label: 'Itinerarios' },
    { key: 'community', icon: 'users', label: 'Comunidad' },
    { key: 'certificates', icon: 'award', label: 'Certificados' },
    { key: 'settings', icon: 'settings', label: 'Ajustes' },
  ];
  return (
    <aside style={{
      width: 248, background: '#202020', color: '#fff', minHeight: '100vh',
      display: 'flex', flexDirection: 'column', padding: '28px 0',
      position: 'sticky', top: 0,
    }}>
      <div style={{ padding: '0 24px 24px' }}>
        <img src="../../assets/logo-horizontal-negative.svg" alt="EDUCA EDTECH Group" style={{ height: 28 }} />
      </div>
      <hr style={{ height: 2, background: 'linear-gradient(90deg,#60BFB8,#2E7ABE,#244A80,#963058,#E96A73)', border: 0, margin: '0 24px 20px' }} />
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px' }}>
        {items.map(it => (
          <button key={it.key} onClick={() => onNav(it.key)} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: active === it.key ? 'rgba(46,122,190,0.16)' : 'transparent',
            color: active === it.key ? '#2E7ABE' : '#BABABA',
            border: 0, borderRadius: 8, padding: '12px 14px', cursor: 'pointer',
            fontFamily: 'Lato', fontSize: 14, fontWeight: active === it.key ? 700 : 400,
            textAlign: 'left',
            position: 'relative',
          }}>
            {active === it.key && <span style={{ position: 'absolute', left: -12, top: 8, bottom: 8, width: 3, background: '#2E7ABE', borderRadius: 2 }} />}
            <i data-lucide={it.icon} style={{ width: 18, height: 18, strokeWidth: 1.75 }} />
            {it.label}
          </button>
        ))}
      </nav>
      <div style={{ marginTop: 'auto', padding: '0 24px' }}>
        <div style={{ background: '#2A2A2A', borderRadius: 12, padding: 16, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#60BFB8,#2E7ABE,#244A80,#963058,#E96A73)' }} />
          <div style={{ fontFamily: 'Rubik', fontWeight: 500, fontSize: 14, marginTop: 6 }}>EDUCA LXP Pro</div>
          <div style={{ fontSize: 12, color: '#BABABA', marginTop: 6, lineHeight: 1.5 }}>Personaliza tu aprendizaje con IA.</div>
          <button style={{ marginTop: 12, width: '100%', background: '#2E7ABE', color: '#fff', border: 0, borderRadius: 999, padding: '8px 12px', fontFamily: 'Lato', fontWeight: 700, fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', cursor: 'pointer' }}>Activar</button>
        </div>
      </div>
    </aside>
  );
}
window.Sidebar = Sidebar;
