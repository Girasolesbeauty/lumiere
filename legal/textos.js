// Textos legales de Lumiere: Terminos y Condiciones y Politica de Privacidad.
// Es la unica fuente: de aca los toma el sistema (pantalla de aceptacion) y con
// `node legal/generar-web.js` se generan las paginas de la web.
// Si se cambia el texto, cambiar VERSION: a cada dueño se le vuelve a pedir que acepte.
const VERSION = '2026-10-05.2';
const VIGENCIA = '5 de octubre de 2026';

// Datos del prestador. Si cambian (por ejemplo al pasar a una sociedad), subir la VERSION.
const TITULAR = 'Sabrina Soledad Morales';
const CUIT = '27-32768966-0';
const DOMICILIO = 'Independencia 710, ciudad de Córdoba, Provincia de Córdoba, República Argentina';
const MAIL = 'hola@sistemalumiere.com';
const WEB = 'www.sistemalumiere.com';

const prestador = TITULAR + (CUIT ? ', CUIT ' + CUIT : '') + ', con domicilio en ' + DOMICILIO;

const terminos = {
  titulo: 'Términos y Condiciones de Uso',
  intro: [
    'Estos Términos y Condiciones (los "Términos") regulan el uso de Lumiere, un software de gestión para negocios que se ofrece por internet (el "Servicio"), prestado por ' + prestador + ' ("Lumiere", "nosotros").',
    'Al crear una cuenta, aceptar estos Términos en pantalla o usar el Servicio, la persona o empresa que contrata (el "Cliente") declara que los leyó, los entiende y los acepta, y que quien acepta tiene facultades suficientes para obligar al negocio. Si no está de acuerdo, no debe usar el Servicio.',
  ],
  secciones: [
    { t: '1. El Servicio', p: [
      'Lumiere es una herramienta de gestión comercial (ventas, stock, caja, clientes, finanzas, equipo, análisis y recomendaciones, entre otras funciones) a la que se accede por internet desde un navegador. Las funciones disponibles dependen del plan contratado y pueden cambiar, mejorarse o reemplazarse con el tiempo.',
      'Lumiere otorga al Cliente un permiso de uso limitado, no exclusivo, intransferible y revocable para usar el Servicio en la gestión de su propio negocio mientras la cuenta esté vigente. No se vende ni se entrega el software, su código ni ningún derecho de propiedad sobre él.',
      'El Cliente declara que contrata el Servicio para su actividad comercial, profesional o empresarial, y no como consumidor final.',
    ] },
    { t: '2. Cuenta y usuarios', p: [
      'El Cliente debe dar datos verdaderos y mantenerlos actualizados. El mail de registro es el medio principal de comunicación entre las partes.',
      'El Cliente es responsable de sus usuarios y contraseñas, de los permisos que les da a sus empleados y de todo lo que se haga con sus cuentas. Debe mantener las contraseñas en secreto y avisar de inmediato a ' + MAIL + ' si sospecha un acceso no autorizado.',
      'Cada mail de acceso corresponde a un único negocio. Lumiere puede pedir que se verifique la identidad del titular antes de hacer cambios en la cuenta.',
    ] },
    { t: '3. Prueba gratuita', p: [
      'Lumiere puede ofrecer un período de prueba gratuito (por defecto, 7 días corridos, o el plazo que se informe al crear la cuenta) con las funciones que se indiquen. La prueba no obliga a contratar ni requiere medio de pago.',
      'Al terminar la prueba sin que se active un plan pago, la cuenta pasa a modo de solo lectura: el Cliente puede ver y descargar sus datos pero no cargar ni modificar información. Lumiere puede eliminar las cuentas de prueba no activadas pasados 60 días desde su vencimiento.',
      'El período de prueba existe para que el Cliente evalúe si el Servicio le sirve antes de pagar. Por eso los pagos no son reembolsables (ver punto 5).',
    ] },
    { t: '4. Planes, precios y pagos', p: [
      'El Servicio se paga por adelantado, por mes. El Cliente puede optar por pagar el año completo por adelantado, en cuyo caso se bonifican 2 (dos) meses: paga 10 y usa 12.',
      'Los precios, planes y medios de pago vigentes son los que se informan en ' + WEB + ' o los que se acuerden por escrito (incluido WhatsApp o mail) con el Cliente. Los precios no incluyen los impuestos que correspondan según el país del Cliente, que están a su cargo.',
      'Lumiere puede modificar los precios avisando al Cliente con al menos 30 días de anticipación al mail de registro o dentro del Servicio. El nuevo precio rige desde el siguiente período de facturación; los períodos ya pagados (incluido un año pago por adelantado) no se modifican.',
      'Falta de pago: si un período no se paga dentro de los 10 (diez) días corridos desde su vencimiento, el Servicio se pausa: el Cliente y sus usuarios no pueden ingresar ni usar el Servicio hasta que se regularice el pago. La pausa no borra nada: los datos se conservan y el Servicio se reactiva al acreditarse el pago. El tiempo que la cuenta esté pausada por falta de pago no se descuenta ni se compensa.',
      'Si la cuenta permanece pausada por falta de pago más de 90 días corridos, Lumiere puede darla de baja y eliminar los datos, avisando antes al mail de registro. Durante la pausa, el Cliente puede pedir su copia de seguridad escribiendo a ' + MAIL + ' desde su mail de registro.',
    ] },
    { t: '5. Sin reembolsos', p: [
      'Los pagos realizados no se reembolsan, total ni parcialmente, ni siquiera si el Cliente deja de usar el Servicio o lo da de baja antes de terminar el período pago (mensual o anual). El Cliente conserva el acceso hasta el final del período que pagó.',
      'Lo anterior es sin perjuicio de los derechos que las leyes de orden público le reconozcan al Cliente y que no puedan renunciarse.',
    ] },
    { t: '6. Los datos del Cliente', p: [
      'Los datos que el Cliente carga en el Servicio (productos, ventas, clientes, caja, etc.) son del Cliente. Lumiere los usa solo para prestar, mantener, proteger y mejorar el Servicio, para dar soporte y para cumplir obligaciones legales. Lumiere no vende los datos del Cliente a terceros.',
      'El Cliente puede descargar una copia de sus datos en cualquier momento desde "Configuración del Negocio → Copia de seguridad", también en modo de solo lectura.',
      'Datos personales de terceros: el Cliente es el responsable de los datos personales de sus propios clientes, empleados y proveedores que cargue en el Servicio, y garantiza que los obtuvo y los usa de manera legal (incluido el envío de mensajes y promociones). Respecto de esos datos, Lumiere actúa como encargado del tratamiento, siguiendo las instrucciones del Cliente y aplicando medidas de seguridad razonables.',
      'El tratamiento de los datos personales del Cliente y sus usuarios se describe en la Política de Privacidad, que forma parte de estos Términos.',
    ] },
    { t: '7. Copias de seguridad', p: [
      'Lumiere aplica medidas razonables para resguardar la información, pero ningún sistema es infalible. El Cliente es responsable de descargar periódicamente su copia de seguridad y de conservarla en un lugar seguro.',
      'Lumiere no garantiza la recuperación de datos perdidos, borrados o modificados por el Cliente o sus usuarios, ni de datos afectados por fallas de terceros o hechos fuera de su control.',
    ] },
    { t: '8. Facturación electrónica, impuestos y obligaciones del Cliente', p: [
      'Las funciones de facturación electrónica y de conexión con organismos fiscales (por ejemplo ARCA, en Argentina) son herramientas que el Cliente usa con sus propios datos, certificados y credenciales. El Cliente es el único responsable de su situación fiscal, de los comprobantes que emite o deja de emitir, de la veracidad de los datos que carga y del cumplimiento de las leyes impositivas, laborales, comerciales y de defensa del consumidor que le correspondan.',
      'Lumiere no presta asesoramiento contable, impositivo, legal ni financiero. La disponibilidad de los servicios de organismos públicos y de terceros no depende de Lumiere.',
    ] },
    { t: '9. Análisis, recomendaciones e inteligencia artificial', p: [
      'El Servicio incluye análisis, indicadores, alertas, recomendaciones y respuestas generadas automáticamente, en algunos casos con inteligencia artificial ("Tu gerente", "Toma de decisiones", el asistente de ayuda y similares). Se elaboran con los datos que el Cliente carga y son orientativos: pueden contener errores, estar incompletos o no ser adecuados para el caso concreto.',
      'Todo lo que Lumiere recomienda, sugiere, calcula o proyecta (qué pedir y cuánto, qué precio poner, qué liquidar, si conviene contratar, hacer una promoción o cualquier otra acción) es solo eso: una sugerencia. No es una orden, una garantía ni un asesoramiento profesional, y no reemplaza el criterio del Cliente ni el de sus asesores.',
      'Las decisiones sobre el negocio (precios, compras, stock, personal, inversiones u otras) las toma siempre el Cliente y son de su exclusiva responsabilidad. Lumiere no garantiza resultados económicos ni comerciales, y no se responsabiliza por ningún resultado, pérdida, daño o consecuencia que surja de seguir, de no seguir o de aplicar parcialmente una recomendación o sugerencia del Servicio.',
      'Para generar algunas respuestas, la información necesaria puede ser procesada por proveedores externos de inteligencia artificial, bajo condiciones de confidencialidad.',
    ] },
    { t: '10. Uso permitido', p: [
      'El Cliente se compromete a no: (a) usar el Servicio para actividades ilegales o para cargar contenido ilícito; (b) copiar, modificar, descompilar, hacer ingeniería inversa o intentar obtener el código del Servicio; (c) revender, alquilar o dar acceso al Servicio a terceros ajenos a su negocio sin autorización escrita; (d) intentar acceder a datos de otros clientes, vulnerar la seguridad o sobrecargar el Servicio; (e) usar el Servicio para desarrollar un producto que compita con Lumiere.',
      'Ante un incumplimiento, Lumiere puede suspender o dar de baja la cuenta, sin derecho a reembolso.',
    ] },
    { t: '11. Disponibilidad y servicios de terceros', p: [
      'Lumiere trabaja para que el Servicio esté disponible de forma continua, pero se presta "tal cual es" y "según disponibilidad": puede haber interrupciones por mantenimiento, actualizaciones, fallas técnicas, cortes de internet o de energía, o por problemas de proveedores externos (servidores, mensajería, medios de pago, organismos fiscales u otros).',
      'Lumiere no garantiza que el Servicio funcione sin errores ni interrupciones, ni que sea compatible con todos los equipos, impresoras, lectores o navegadores. El Cliente debe contar con conexión a internet y equipos adecuados.',
    ] },
    { t: '12. Propiedad intelectual', p: [
      'El software, el diseño, las marcas, los logos, los textos, las metodologías y toda mejora del Servicio son de Lumiere o de sus licenciantes. Estos Términos no transfieren al Cliente ningún derecho sobre ellos.',
      'Si el Cliente envía sugerencias o ideas de mejora, Lumiere puede usarlas libremente sin obligación de compensarlo.',
    ] },
    { t: '13. Limitación de responsabilidad', p: [
      'En la máxima medida permitida por la ley, Lumiere no responde por: lucro cesante, pérdida de ventas, de ganancias, de clientes o de oportunidades; pérdida o alteración de datos; daños indirectos o consecuenciales; decisiones tomadas por el Cliente a partir de la información del Servicio; errores en los datos cargados por el Cliente o sus usuarios; diferencias de stock, de caja o de facturación; sanciones o reclamos fiscales, laborales o de consumidores contra el Cliente; ni por hechos de terceros, caso fortuito o fuerza mayor.',
      'En cualquier caso, la responsabilidad total de Lumiere frente al Cliente, por cualquier causa, queda limitada al monto efectivamente pagado por el Cliente por el Servicio en los 3 (tres) meses anteriores al hecho que origina el reclamo.',
      'Estas limitaciones no se aplican en los casos en que la ley no permite limitar la responsabilidad, como el dolo.',
    ] },
    { t: '14. Indemnidad', p: [
      'El Cliente mantendrá indemne a Lumiere frente a reclamos, multas, daños y gastos (incluidos honorarios razonables de abogados) originados en el uso que el Cliente o sus usuarios hagan del Servicio, en los datos que carguen, en el incumplimiento de estos Términos o en la violación de leyes o de derechos de terceros.',
    ] },
    { t: '15. Vigencia, baja y qué pasa con los datos', p: [
      'El contrato rige mientras el Cliente tenga una cuenta. El Cliente puede darlo de baja cuando quiera escribiendo a ' + MAIL + ' desde su mail de registro; la baja se hace efectiva al final del período ya pagado.',
      'Lumiere puede suspender o terminar el Servicio por falta de pago, por incumplimiento de estos Términos, por exigencia legal o si deja de prestar el Servicio, avisando con anticipación razonable cuando sea posible.',
      'Terminado el contrato, el Cliente tiene 30 días corridos para descargar su copia de seguridad. Pasado ese plazo, Lumiere puede eliminar los datos de forma definitiva, salvo los que deba conservar por obligación legal.',
    ] },
    { t: '16. Cambios en estos Términos', p: [
      'Lumiere puede modificar estos Términos. Los cambios importantes se avisarán con al menos 15 días de anticipación al mail de registro o dentro del Servicio, donde podrá pedirse una nueva aceptación. Si el Cliente no está de acuerdo puede dar de baja la cuenta; seguir usando el Servicio después de la fecha de vigencia implica aceptar los cambios.',
    ] },
    { t: '17. Comunicaciones', p: [
      'Lumiere se comunica con el Cliente al mail de registro, por WhatsApp al número informado o mediante avisos dentro del Servicio. El Cliente puede escribir a ' + MAIL + '. Las comunicaciones por esos medios se consideran válidas.',
    ] },
    { t: '18. Ley aplicable y jurisdicción', p: [
      'Estos Términos se rigen por las leyes de la República Argentina. Cualquier controversia se someterá a los tribunales ordinarios competentes de la ciudad de Córdoba, Provincia de Córdoba, República Argentina, con renuncia a cualquier otro fuero o jurisdicción, salvo que una norma de orden público disponga otra cosa.',
    ] },
    { t: '19. Disposiciones generales', p: [
      'Si alguna cláusula resultara inválida, las demás siguen vigentes. Que Lumiere no ejerza un derecho en un momento no significa que renuncie a él. El Cliente no puede ceder este contrato sin autorización escrita; Lumiere puede cederlo en caso de reorganización o transferencia del Servicio, avisando al Cliente. Estos Términos y la Política de Privacidad son el acuerdo completo entre las partes sobre el Servicio.',
    ] },
  ],
};

const privacidad = {
  titulo: 'Política de Privacidad',
  intro: [
    'Esta Política explica qué datos personales trata Lumiere, para qué y qué derechos tienen sus titulares. El responsable es ' + prestador + '. Contacto: ' + MAIL + '.',
  ],
  secciones: [
    { t: '1. Qué datos tratamos', p: [
      'Datos de la cuenta: nombre del negocio, nombre y apellido, mail, teléfono, país y contraseña (guardada de forma cifrada, no legible) del titular y de los usuarios que el Cliente cree.',
      'Datos del negocio: la información que el Cliente carga para gestionar su actividad (productos, ventas, caja, proveedores, etc.).',
      'Datos de terceros cargados por el Cliente: datos de sus propios clientes, empleados y proveedores (por ejemplo nombre, documento, teléfono, compras). Sobre estos datos el responsable es el Cliente y Lumiere actúa como encargado del tratamiento.',
      'Datos técnicos y de uso: fecha y hora de acceso, dirección IP, tipo de navegador y dispositivo, y registro de la aceptación de los Términos.',
    ] },
    { t: '2. Para qué los usamos', p: [
      'Para prestar el Servicio, autenticar a los usuarios, dar soporte, cobrar, avisar novedades o cambios, mejorar el producto, prevenir fraudes y usos indebidos, y cumplir obligaciones legales. No vendemos datos personales ni los usamos para publicidad de terceros.',
      'Podemos elaborar estadísticas agregadas y anónimas (que no identifican a ningún negocio ni persona) para mejorar el Servicio.',
    ] },
    { t: '3. Con quién los compartimos', p: [
      'Con proveedores que nos prestan servicios necesarios para operar (alojamiento de servidores y bases de datos, correo electrónico, protección y entrega del sitio, e inteligencia artificial para las funciones que la usan), que solo pueden usar los datos para ese fin y bajo confidencialidad. Algunos de esos proveedores están en otros países, incluidos los Estados Unidos, por lo que los datos pueden transferirse y alojarse fuera de la Argentina; al aceptar esta Política, el titular consiente esa transferencia.',
      'También podemos entregar datos cuando una autoridad competente lo exija legalmente.',
    ] },
    { t: '4. Cuánto tiempo los guardamos', p: [
      'Mientras la cuenta esté vigente y, después de la baja, por los plazos indicados en los Términos (30 días para descargar la copia; luego se eliminan), salvo los datos que debamos conservar por obligación legal o para la defensa de reclamos.',
    ] },
    { t: '5. Seguridad', p: [
      'Aplicamos medidas técnicas y organizativas razonables: conexión cifrada, contraseñas cifradas, acceso con sesión, separación de los datos de cada negocio y permisos por usuario. Aun así, ningún sistema es totalmente seguro; el Cliente debe cuidar sus contraseñas y descargar copias de seguridad.',
    ] },
    { t: '6. Derechos de los titulares', p: [
      'El titular de los datos puede pedir acceder a sus datos, rectificarlos, actualizarlos o suprimirlos escribiendo a ' + MAIL + '. Si los datos fueron cargados por un negocio que usa Lumiere, el pedido debe dirigirse a ese negocio, que es el responsable; Lumiere colaborará con él.',
      'El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto, conforme lo establecido en el artículo 14, inciso 3 de la Ley Nº 25.326.',
      'La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la Ley Nº 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.',
    ] },
    { t: '7. Cookies y almacenamiento en el navegador', p: [
      'El Servicio guarda en el navegador solo lo necesario para funcionar (por ejemplo la sesión iniciada, el local elegido y preferencias de pantalla). No usamos cookies de publicidad.',
    ] },
    { t: '8. Menores de edad', p: [
      'El Servicio está dirigido a negocios y a personas mayores de edad con capacidad para contratar.',
    ] },
    { t: '9. Cambios en esta Política', p: [
      'Podemos actualizar esta Política. Los cambios importantes se avisarán al mail de registro o dentro del Servicio.',
    ] },
  ],
};

module.exports = { VERSION, VIGENCIA, TITULAR, MAIL, terminos, privacidad };
