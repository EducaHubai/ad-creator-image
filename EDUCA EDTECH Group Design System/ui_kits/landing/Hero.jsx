// Hero.jsx — dark hero with gradient line and parallelogram image stack
function Hero() {
  return (
    <section style={{ background: '#202020', color: '#fff', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        maxWidth: 1280, margin: '0 auto', padding: '120px 32px 140px',
        display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 80, alignItems: 'center',
      }}>
        <div>
          <hr style={{ height: 3, width: 120, background: 'linear-gradient(90deg,#60BFB8,#2E7ABE,#244A80,#963058,#E96A73)', border: 0, margin: '0 0 32px 0' }} />
          <div style={{ fontFamily: 'Lato', fontSize: 13, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#60BFB8', marginBottom: 24 }}>
            Together our future is bright
          </div>
          <h1 style={{ fontFamily: 'Rubik', fontWeight: 500, fontSize: 72, lineHeight: 1.04, letterSpacing: '-0.01em', margin: 0, textWrap: 'pretty' }}>
            Llevamos la educación online a todos los rincones del mundo.
          </h1>
          <p style={{ fontFamily: 'Lato', fontSize: 20, lineHeight: 1.55, color: '#BABABA', marginTop: 28, maxWidth: 580 }}>
            Creamos experiencias educativas online a medida mediante herramientas de Inteligencia Artificial propias. 20+ años democratizando el acceso a la formación de calidad.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 40 }}>
            <button style={btnPrimary}>Descubrir el grupo</button>
            <button style={btnSecondaryDark}>Ver instituciones</button>
          </div>
        </div>
        <div style={{ position: 'relative', height: 500 }}>
          <div style={{ position: 'absolute', top: 0, left: 60, width: 280, height: 360, background: 'linear-gradient(135deg,#244A80,#60BFB8)', transform: 'skewX(-12deg)', borderRadius: 8, boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }} />
          <div style={{ position: 'absolute', top: 120, right: 0, width: 280, height: 360, background: 'linear-gradient(135deg,#963058,#E96A73)', transform: 'skewX(-12deg)', borderRadius: 8, boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }} />
        </div>
      </div>
      <hr style={{ height: 6, background: 'linear-gradient(90deg,#60BFB8 0%,#2E7ABE 25%,#244A80 50%,#963058 80%,#E96A73 100%)', border: 0, margin: 0 }} />
    </section>
  );
}
const btnPrimary = {
  border: 0, borderRadius: 999, background: '#60BFB8', color: '#fff',
  fontFamily: 'Lato', fontWeight: 700, fontSize: 13, letterSpacing: '0.10em', textTransform: 'uppercase',
  padding: '14px 30px', cursor: 'pointer',
};
const btnSecondaryDark = {
  borderRadius: 999, background: 'transparent', color: '#fff',
  border: '1.5px solid rgba(255,255,255,0.5)',
  fontFamily: 'Lato', fontWeight: 700, fontSize: 13, letterSpacing: '0.10em', textTransform: 'uppercase',
  padding: '13px 28px', cursor: 'pointer',
};
window.Hero = Hero;
