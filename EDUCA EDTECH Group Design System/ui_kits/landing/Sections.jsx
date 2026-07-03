// PillarsSection.jsx + StatStrip + Quote + CTASection + Footer (combined)

function PillarsSection() {
  const [active, setActive] = React.useState(0);
  const tabs = ['Educación superior', 'Educación continua', 'Oposiciones', 'EdTech & IA'];
  const panels = [
    { eyebrow: 'B2C · Business Schools & University', title: 'Cursos, expertos y másteres con metodología propia.', body: 'Repartidos por más de 15 instituciones de formación, comprenden buena parte del conocimiento necesario para los profesionales de hoy.' },
    { eyebrow: 'B2B · Editoriales', title: 'Contenidos especializados de última generación.', body: 'Materiales educativos elaborados por especialistas, respaldados por editoriales que también son parte del grupo.' },
    { eyebrow: 'Temarios PDF', title: 'Preparación al acceso al empleo público.', body: 'Documentación jurídica y temarios actualizados conforme a las particularidades de cada comunidad autónoma.' },
    { eyebrow: 'EDUCA LXP', title: 'Inteligencia Artificial al servicio del alumnado.', body: 'Detección temprana de abandono, internacionalización de contenido, recomendación personalizada de itinerarios.' },
  ];
  return (
    <section id="instituciones" style={{ background: '#F4F4F4', padding: '120px 32px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ fontFamily: 'Lato', fontSize: 13, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#963058' }}>
          Instituciones
        </div>
        <h2 style={{ fontFamily: 'Rubik', fontWeight: 500, fontSize: 48, margin: '16px 0 12px', maxWidth: 800, lineHeight: 1.1 }}>
          20+ años creando experiencias formativas.
        </h2>
        <hr style={gradientLine} />
        <div style={{ display: 'flex', gap: 36, marginTop: 56, borderBottom: '1px solid #E0E0E0' }}>
          {tabs.map((t, i) => (
            <button key={t} onClick={() => setActive(i)} style={{
              background: 'transparent', border: 0, padding: '14px 4px', cursor: 'pointer',
              fontFamily: 'Lato', fontWeight: 700, fontSize: 14, letterSpacing: '0.04em',
              color: i === active ? '#202020' : '#BABABA',
              position: 'relative', borderBottom: i === active ? '3px solid transparent' : 'none',
              backgroundImage: i === active ? 'linear-gradient(#fff,#fff), linear-gradient(90deg,#60BFB8,#2E7ABE,#244A80,#963058,#E96A73)' : undefined,
              backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box',
              marginBottom: -1,
            }}>
              {t}
              {i === active && <span style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 3, background: 'linear-gradient(90deg,#60BFB8,#2E7ABE,#244A80,#963058,#E96A73)' }} />}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 56, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'Lato', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#963058' }}>{panels[active].eyebrow}</div>
            <h3 style={{ fontFamily: 'Rubik', fontWeight: 500, fontSize: 36, margin: '12px 0 20px', lineHeight: 1.15 }}>{panels[active].title}</h3>
            <p style={{ fontFamily: 'Lato', fontSize: 18, lineHeight: 1.6, color: '#444' }}>{panels[active].body}</p>
            <button style={{ marginTop: 28, border: '1.5px solid #963058', background: 'transparent', color: '#963058', borderRadius: 999, fontFamily: 'Lato', fontWeight: 700, fontSize: 13, letterSpacing: '0.10em', textTransform: 'uppercase', padding: '12px 26px', cursor: 'pointer' }}>Saber más</button>
          </div>
          <div style={{ position: 'relative', height: 360 }}>
            <div style={{ position: 'absolute', top: 0, left: 60, width: 220, height: 280, background: 'linear-gradient(135deg,#244A80,#60BFB8)', transform: 'skewX(-12deg)', borderRadius: 8 }} />
            <div style={{ position: 'absolute', top: 80, right: 0, width: 220, height: 280, background: 'linear-gradient(135deg,#963058,#E96A73)', transform: 'skewX(-12deg)', borderRadius: 8 }} />
          </div>
        </div>
      </div>
    </section>
  );
}

function StatStrip() {
  const stats = [
    { num: '20+', label: 'años de experiencia' },
    { num: '30+', label: 'universidades acreditan la metodología' },
    { num: '15', label: 'instituciones de formación' },
    { num: '+1M', label: 'estudiantes formados' },
  ];
  return (
    <section style={{ background: 'linear-gradient(90deg,#60BFB8 0%,#2E7ABE 25%,#244A80 50%,#963058 80%,#E96A73 100%)', padding: '64px 32px', color: '#fff' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32 }}>
        {stats.map(s => (
          <div key={s.label}>
            <div style={{ fontFamily: 'Rubik', fontWeight: 500, fontSize: 64, lineHeight: 1 }}>{s.num}</div>
            <div style={{ fontFamily: 'Lato', fontSize: 16, marginTop: 8, opacity: 0.9 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Quote() {
  return (
    <section style={{ background: '#fff', padding: '120px 32px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', textAlign: 'left' }}>
        <hr style={{ ...gradientLine, marginBottom: 40 }} />
        <div style={{ fontFamily: 'Rubik', fontWeight: 500, fontSize: 48, lineHeight: 1.2, letterSpacing: '-0.005em' }}>
          Creemos que todos merecen tener acceso a una educación de calidad, sin importar su ubicación o situación.
        </div>
        <div style={{ marginTop: 32, fontFamily: 'Lato', fontSize: 13, color: '#666', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
          Filosofía de marca
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section style={{ background: '#202020', color: '#fff', padding: '120px 32px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', textAlign: 'center' }}>
        <hr style={{ height: 3, width: 100, background: 'linear-gradient(90deg,#60BFB8,#2E7ABE,#244A80,#963058,#E96A73)', border: 0, margin: '0 auto 32px' }} />
        <h2 style={{ fontFamily: 'Rubik', fontWeight: 500, fontSize: 56, lineHeight: 1.1, letterSpacing: '-0.01em', margin: 0 }}>
          Together our future is bright.
        </h2>
        <p style={{ fontFamily: 'Lato', fontSize: 20, color: '#BABABA', marginTop: 24, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
          Únete al grupo educativo que lleva la educación online a todos los rincones del mundo.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 40 }}>
          <button style={{ border: 0, borderRadius: 999, background: 'linear-gradient(90deg,#963058,#244A80)', color: '#fff', fontFamily: 'Lato', fontWeight: 700, fontSize: 13, letterSpacing: '0.10em', textTransform: 'uppercase', padding: '14px 32px', cursor: 'pointer' }}>Contactar con el grupo</button>
          <button style={{ borderRadius: 999, background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,0.5)', fontFamily: 'Lato', fontWeight: 700, fontSize: 13, letterSpacing: '0.10em', textTransform: 'uppercase', padding: '13px 28px', cursor: 'pointer' }}>Ver memorias</button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ background: '#202020', color: '#BABABA', padding: '64px 32px 40px', borderTop: '1px solid #3A3A3A' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 40 }}>
        <div>
          <img src="../../assets/logo-horizontal-negative.svg" alt="EDUCA EDTECH Group" style={{ height: 32 }} />
          <p style={{ fontFamily: 'Lato', fontSize: 14, lineHeight: 1.6, marginTop: 20, maxWidth: 320 }}>
            El grupo educativo que lleva la educación online a todos los rincones del mundo.
          </p>
        </div>
        {[
          { h: 'Grupo', items: ['Quiénes somos', 'Instituciones', 'Investigación', 'Sala de prensa'] },
          { h: 'Productos', items: ['EDUCA LXP', 'Editoriales', 'Temarios PDF', 'B2B'] },
          { h: 'Legal', items: ['Aviso legal', 'Privacidad', 'Cookies', 'Accesibilidad'] },
        ].map(col => (
          <div key={col.h}>
            <div style={{ fontFamily: 'Lato', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fff' }}>{col.h}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {col.items.map(it => <li key={it}><a href="#" style={{ color: '#BABABA', fontSize: 14, textDecoration: 'none' }}>{it}</a></li>)}
            </ul>
          </div>
        ))}
      </div>
      <hr style={{ height: 3, background: 'linear-gradient(90deg,#60BFB8,#2E7ABE,#244A80,#963058,#E96A73)', border: 0, margin: '48px 0 24px' }} />
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span>© 2025 EDUCA EDTECH Group. Todos los derechos reservados.</span>
        <span>educaedtech.com</span>
      </div>
    </footer>
  );
}

window.PillarsSection = PillarsSection;
window.StatStrip = StatStrip;
window.Quote = Quote;
window.CTASection = CTASection;
window.Footer = Footer;
