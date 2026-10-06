// ─── GENERATE WIZARD ────────────────────────────────────────────────
export const GOALS = ["Reconocimiento de marca","Tráfico / visitas","Generación de leads","Reservar demo","Descargar brochure","Prueba gratuita","Inicio de solicitud","Matrícula / compra","Retargeting / nurture"];

export const PAINS = ["Quiero un mejor trabajo o ascenso","Necesito mejorar mis habilidades rápido","Estoy suspendiendo exámenes","No sé qué curso elegir","Me falta tiempo","Me falta confianza o estructura","Quiero habilidades prácticas, no teoría","Quiero prueba de que valdrá la pena","Necesito aprendizaje online flexible","Me abruman las opciones"];

export const AUDIENCES = ["Profesionales en activo","Estudiantes universitarios","Personas en transición de carrera","Managers y líderes de equipo","Profesionales en etapa inicial","Padres que compran para sus hijos","Compradores de RRHH / formación","Aprendices continuos"];

export const CTAS_BY_GOAL = {
  "Matrícula / compra": ["Inscríbete ahora","Empieza hoy","Reserva tu plaza","Comenzar"],
  "Generación de leads": ["Descargar brochure","Reservar demo","Hablar con un asesor","Empezar"],
  "Reconocimiento de marca": ["Saber más","Explorar cursos","Ver qué es posible","Descubrir"],
  "Tráfico / visitas": ["Ver temario","Ver el programa","Explorar","Saber más"],
  "Reservar demo": ["Reservar demo","Hablar con un asesor","Programar llamada","Reserva plaza"],
  "Prueba gratuita": ["Prueba gratis","Ver clase gratuita","Probar gratis","Acceso de muestra"],
  "Inicio de solicitud": ["Solicitar ahora","Iniciar solicitud","Reserva tu plaza","Hacer el test"],
  "Retargeting / nurture": ["Continuar aprendiendo","Retomar donde lo dejaste","Inscríbete ahora","Reserva plaza"],
};

export const ALL_CTAS = ["Saber más","Ver temario","Descargar brochure","Ver clase gratis","Prueba gratis","Reservar demo","Reserva tu plaza","Hacer el test","Hablar con asesor","Solicitar ahora","Inscríbete ahora"];

export const FORMATS = [
  { id: "story",     label: "Stories / Reels",   dim: "1080×1920", ratio: "9:16" },
  { id: "feed_4x5",  label: "Feed priority",      dim: "1080×1350", ratio: "4:5"  },
  { id: "square",    label: "Universal square",   dim: "1080×1080", ratio: "1:1"  },
  { id: "landscape", label: "Legacy landscape",   dim: "1200×628",  ratio: "1.9:1" },
];

export const EUROINNOVA_IMAGE_RULES = `No incluir texto ni logotipos en la imagen. Paleta: granate #B0263E, negro #202020, blanco. Sin degradados, sin formas orgánicas, bloques de color planos, bordes geométricos nítidos. Modelos de 20-40 años, ropa neutra, poses desenfadadas. Dejar la esquina superior izquierda (15% alto, 25% ancho) completamente limpia y de color plano, sin objetos — se reservará para superponer el logo.`;
