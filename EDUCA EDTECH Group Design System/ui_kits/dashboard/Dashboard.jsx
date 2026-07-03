// Dashboard.jsx — combined: TopBar, WelcomeHero, CourseCards, AIRecommendation, MainContent

function TopBar() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '20px 32px', borderBottom: '1px solid #E0E0E0', background: '#fff',
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1.5px solid #BABABA', padding: '6px 0', flex: 1 }}>
          <i data-lucide="search" style={{ width: 18, height: 18, color: '#BABABA', strokeWidth: 1.75 }} />
          <input placeholder="Buscar cursos, instructores, certificados…" style={{ border: 0, outline: 'none', fontFamily: 'Lato', fontSize: 15, flex: 1, background: 'transparent' }} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <button style={{ background: 'transparent', border: 0, cursor: 'pointer', position: 'relative', color: '#666' }}>
          <i data-lucide="bell" style={{ width: 20, height: 20, strokeWidth: 1.75 }} />
          <span style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, background: '#963058', borderRadius: '50%' }} />
        </button>
        <button style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#666' }}>
          <i data-lucide="message-square" style={{ width: 20, height: 20, strokeWidth: 1.75 }} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#963058,#244A80)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Rubik', fontWeight: 500, fontSize: 14 }}>MR</div>
          <div>
            <div style={{ fontFamily: 'Lato', fontWeight: 700, fontSize: 13 }}>María Romero</div>
            <div style={{ fontSize: 11, color: '#666' }}>Estudiante · Educa University</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WelcomeHero() {
  return (
    <div style={{
      borderRadius: 16, padding: 36, color: '#fff', position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(110deg,#244A80 0%,#963058 80%,#E96A73 100%)',
    }}>
      <div style={{ position: 'absolute', top: -40, right: -60, width: 360, height: 360, background: 'rgba(96,191,184,0.18)', transform: 'skewX(-18deg)', borderRadius: 12 }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ fontFamily: 'Lato', fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.85 }}>Buenos días, María</div>
        <div style={{ fontFamily: 'Rubik', fontWeight: 500, fontSize: 36, lineHeight: 1.15, marginTop: 12, maxWidth: 640 }}>
          Llevas 4 días con racha. Termina el módulo de hoy y suma tu quinto.
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button style={{ background: '#fff', color: '#202020', border: 0, borderRadius: 999, padding: '12px 24px', fontFamily: 'Lato', fontWeight: 700, fontSize: 12, letterSpacing: '0.10em', textTransform: 'uppercase', cursor: 'pointer' }}>Continuar</button>
          <button style={{ background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: 999, padding: '11px 22px', fontFamily: 'Lato', fontWeight: 700, fontSize: 12, letterSpacing: '0.10em', textTransform: 'uppercase', cursor: 'pointer' }}>Ver progreso</button>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ value }) {
  return (
    <div style={{ height: 6, background: '#E0E0E0', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: `${value}%`, height: '100%', background: 'linear-gradient(90deg,#60BFB8,#2E7ABE)', borderRadius: 999 }} />
    </div>
  );
}

function CourseCards() {
  const courses = [
    { tag: 'Máster', title: 'Inteligencia Artificial Aplicada a la Educación', inst: 'Educa University', progress: 68, time: '12h restantes', icon: 'cpu' },
    { tag: 'Curso', title: 'Liderazgo y Gestión de Equipos', inst: 'Educa Business School', progress: 32, time: '24h restantes', icon: 'users' },
    { tag: 'Certificado', title: 'Marketing Digital y Analítica Avanzada', inst: 'Euroinnova', progress: 91, time: '2h restantes', icon: 'bar-chart-3' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'Rubik', fontWeight: 500, fontSize: 24, margin: 0 }}>En curso</h2>
        <a href="#" style={{ fontFamily: 'Lato', fontSize: 13, color: '#2E7ABE', fontWeight: 700 }}>Ver todos →</a>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {courses.map(c => (
          <div key={c.title} style={{
            background: '#fff', border: '1px solid #E0E0E0', borderRadius: 12, padding: 24,
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ width: 48, height: 48, background: '#F4F4F4', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60BFB8' }}>
                <i data-lucide={c.icon} style={{ width: 22, height: 22, strokeWidth: 1.75 }} />
              </div>
              <span style={{ fontFamily: 'Lato', fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#963058', background: '#FFE6E8', padding: '4px 10px', borderRadius: 999 }}>{c.tag}</span>
            </div>
            <div>
              <div style={{ fontFamily: 'Rubik', fontWeight: 500, fontSize: 17, lineHeight: 1.3, minHeight: 44 }}>{c.title}</div>
              <div style={{ fontFamily: 'Lato', fontSize: 12, color: '#666', marginTop: 6 }}>{c.inst}</div>
            </div>
            <ProgressBar value={c.progress} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: '#202020', fontWeight: 700 }}>{c.progress}%</span>
              <span style={{ color: '#666' }}>{c.time}</span>
            </div>
            <button style={{ background: '#202020', color: '#fff', border: 0, borderRadius: 999, padding: '10px 20px', fontFamily: 'Lato', fontWeight: 700, fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', cursor: 'pointer', alignSelf: 'flex-start' }}>Continuar</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIRecommendation() {
  return (
    <div style={{
      background: '#202020', color: '#fff', borderRadius: 12, padding: 28,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#60BFB8,#2E7ABE,#244A80,#963058,#E96A73)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, background: 'rgba(46,122,190,0.18)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2E7ABE' }}>
          <i data-lucide="sparkles" style={{ width: 18, height: 18, strokeWidth: 1.75 }} />
        </div>
        <div style={{ fontFamily: 'Lato', fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#2E7ABE' }}>Recomendado por IA</div>
      </div>
      <h3 style={{ fontFamily: 'Rubik', fontWeight: 500, fontSize: 20, lineHeight: 1.3, margin: 0 }}>Curso siguiente sugerido para ti</h3>
      <div style={{ fontFamily: 'Lato', fontSize: 14, color: '#BABABA', marginTop: 8, lineHeight: 1.55 }}>
        Basado en tu progreso en IA Aplicada, hemos identificado <strong style={{ color: '#fff' }}>Procesamiento del Lenguaje Natural</strong> como tu siguiente paso óptimo.
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button style={{ background: '#2E7ABE', color: '#fff', border: 0, borderRadius: 999, padding: '10px 22px', fontFamily: 'Lato', fontWeight: 700, fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', cursor: 'pointer' }}>Inscribirme</button>
        <button style={{ background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,0.4)', borderRadius: 999, padding: '9px 20px', fontFamily: 'Lato', fontWeight: 700, fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', cursor: 'pointer' }}>Ver detalles</button>
      </div>
    </div>
  );
}

function StatGrid() {
  const stats = [
    { num: '4', label: 'cursos en curso', icon: 'book-open', color: '#2E7ABE' },
    { num: '12', label: 'horas esta semana', icon: 'clock', color: '#60BFB8' },
    { num: '7', label: 'certificados', icon: 'award', color: '#963058' },
    { num: '92%', label: 'media de evaluación', icon: 'trending-up', color: '#E96A73' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      {stats.map(s => (
        <div key={s.label} style={{ background: '#fff', border: '1px solid #E0E0E0', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: `${s.color}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
            <i data-lucide={s.icon} style={{ width: 22, height: 22, strokeWidth: 1.75 }} />
          </div>
          <div>
            <div style={{ fontFamily: 'Rubik', fontWeight: 500, fontSize: 24, lineHeight: 1 }}>{s.num}</div>
            <div style={{ fontFamily: 'Lato', fontSize: 12, color: '#666', marginTop: 2 }}>{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MainContent() {
  return (
    <main style={{ padding: '32px 40px', background: '#F4F4F4', minHeight: 'calc(100vh - 73px)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        <WelcomeHero />
        <StatGrid />
        <CourseCards />
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20 }}>
          <div style={{ background: '#fff', border: '1px solid #E0E0E0', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'Rubik', fontWeight: 500, fontSize: 20, margin: 0 }}>Próximas sesiones</h3>
              <a href="#" style={{ fontFamily: 'Lato', fontSize: 12, color: '#2E7ABE', fontWeight: 700 }}>Ver calendario →</a>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Lato', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #963058' }}>
                  <th style={th}>Sesión</th>
                  <th style={th}>Curso</th>
                  <th style={th}>Profesor/a</th>
                  <th style={th}>Cuándo</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Webinar en directo', 'IA Aplicada', 'Dr. Carlos Vega', 'Hoy · 18:00'],
                  ['Tutoría 1-a-1', 'Liderazgo', 'Ana Pérez', 'Mañana · 10:30'],
                  ['Foro de discusión', 'Marketing Digital', 'Equipo Euroinnova', 'Vie · 16:00'],
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #E0E0E0' }}>
                    {row.map((c, j) => <td key={j} style={td}>{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AIRecommendation />
        </div>
      </div>
    </main>
  );
}
const th = { textAlign: 'left', padding: '12px 8px', fontFamily: 'Lato', fontWeight: 700, fontSize: 12, color: '#202020', letterSpacing: '0.06em', textTransform: 'uppercase' };
const td = { padding: '14px 8px', color: '#444' };

window.TopBar = TopBar;
window.MainContent = MainContent;
