// ValueGrid.jsx — four values from the brand book
function ValueGrid() {
  const values = [
    { icon: 'shield-check', title: 'Responsabilidad', body: 'Compromiso con el alumnado, con la calidad de la formación y con la aplicación de la tecnología.' },
    { icon: 'badge-check', title: 'Honestidad', body: 'Integridad, transparencia y cercanía en cada proceso del grupo.' },
    { icon: 'award', title: 'Excelencia', body: 'Profesionalidad, equipos cualificados, experiencia y pasión.' },
    { icon: 'heart-handshake', title: 'Respeto', body: 'Al entorno y a las personas implicadas en la actividad del grupo.' },
  ];
  return (
    <section style={{ background: '#fff', padding: '120px 32px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ fontFamily: 'Lato', fontSize: 13, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#963058' }}>
          Nuestros valores
        </div>
        <h2 style={{ fontFamily: 'Rubik', fontWeight: 500, fontSize: 48, margin: '16px 0 12px', maxWidth: 720, lineHeight: 1.1 }}>
          Una misma manera de entender la educación.
        </h2>
        <hr style={gradientLine} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginTop: 64 }}>
          {values.map(v => (
            <div key={v.title} style={{
              background: '#fff', border: '1px solid #E0E0E0', borderRadius: 12, padding: 32,
              display: 'flex', flexDirection: 'column', gap: 16,
            }}>
              <div style={{ width: 52, height: 52, background: '#F4F4F4', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60BFB8' }}>
                <i data-lucide={v.icon} style={{ width: 26, height: 26, strokeWidth: 1.75 }} />
              </div>
              <div style={{ fontFamily: 'Rubik', fontWeight: 500, fontSize: 22 }}>{v.title}</div>
              <div style={{ fontFamily: 'Lato', fontSize: 16, lineHeight: 1.55, color: '#666' }}>{v.body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
const gradientLine = { height: 3, width: 100, background: 'linear-gradient(90deg,#60BFB8,#2E7ABE,#244A80,#963058,#E96A73)', border: 0, margin: '0' };
window.ValueGrid = ValueGrid;
