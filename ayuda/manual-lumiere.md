# Manual de Lumiere

Lumiere es un sistema de gestión para comercios minoristas con uno o dos locales: punto de venta con factura electrónica de ARCA, stock por local, caja, clientes, compras a proveedores, finanzas y equipo. Los nombres de los locales, el logo y los datos del negocio se configuran en cada negocio (en este manual se dice "local 1" y "local 2").

## Roles y permisos
- **Jefe**: ve y configura todo.
- **Admin / Administrativo**: casi todo; algunas configuraciones son solo del jefe.
- **Vendedor/a**: ve lo que el jefe le habilite en **Configuración → Usuarios** (permisos por sección). Si alguien no ve una sección del menú, es porque no tiene ese permiso: tiene que pedírselo al jefe.
Abajo a la izquierda del menú están **Cambiar local**, **Cerrar sesión** y el interruptor de **fondo claro / oscuro**. El botón **‹** achica el menú (quedan solo los íconos).

## ✨ Lumiere, tu gerente
Es el primer grupo del menú. Mira todos los números del negocio (ventas, plata, stock, clientes y equipo) y te dice qué conviene hacer. Arriba se elige el local (o Todos). Tiene 5 pestañas:
- **📊 Cómo está tu negocio**: el puntaje de salud del mes (0 a 100), el mensaje con lo que salió bien o qué corregir, y cada costo comparado con lo sano para un comercio.
- **🔁 Mejora continua**: acciones concretas sacadas de tus números, en tres columnas: **⚡ corto plazo** (esta semana: reponer lo que se agota, avisar pedidos, entregar premios, escribir a clientes que no vuelven, cargar costos), **📈 mediano plazo** (este mes: liquidar mercadería parada, pedir descuento a proveedores, negociar la tasa de la tarjeta, revisar precios con poco margen) y **🎯 largo plazo** (3 a 6 meses: llegar a 15% de margen, bajar el peso de los costos fijos, achicar el surtido que no rota, mejorar la exactitud del stock, fidelizar clientes). Cada una dice cuánta plata o qué ganás, y tiene **Resolver →** (te lleva a la sección), **✓ Hecho** y **Descartar**. Lo hecho vuelve a aparecer a los 30 días si el problema sigue.
- **💬 Preguntale a tu gerente**: preguntas rápidas que se responden al instante con tus números (¿Cómo viene este mes? ¿Por qué cambiaron mis ventas? ¿Cuánto estoy ganando? ¿Cuánto tengo que vender para cubrir los costos? ¿Qué conviene empujar? ¿Qué liquidar? ¿A qué clientes escribirles? ¿Cómo viene el equipo? ¿Qué día y hora se vende más? ¿En qué se me va la plata?). Abajo hay un chat para preguntarle lo que quieras: responde con los números del negocio, pero puede equivocarse, así que las decisiones grandes conviene simularlas en Toma de decisiones. El chat necesita estar activado en el servidor.
- **🧭 Toma de decisiones**: las simulaciones (contratar, subir precios, promociones, bajar costos, llegar a una ganancia).
- **🏅 Tus logros**: las medallas del negocio.
Es parte del plan Estratégico. Permisos: "Ver salud del negocio, mejora continua, preguntas y logros" y "Usar Toma de decisiones".

## Menú (secciones)
El menú de la izquierda tiene 8 grupos (arriba de todo, **✨ Tu gerente**) que se abren y cierran tocando su nombre (el grupo de la sección en la que estás queda abierto y el sistema recuerda cómo lo dejaste):
- **VENTAS**: Dashboard, Punto de Venta, Ventas Online, Buscar Precio, Cambio / Devolución.
- **STOCK**: Inventario, Compras y proveedores, Ingresos, Control de Inventario, Rotación, Inconsistencias, Kits, Insumos.
- **CAJA**: Caja, Cierre de Caja, Caja de Respaldo, Gift Cards, Comprobantes.
- **CLIENTES**: Clientes, Pedidos, Fidelización, Portal Cliente, Postventa WA, Cupones, Promociones.
- **EQUIPO**: Tareas, Comisiones, Productividad.
- **FINANZAS**: Finanzas, Calculadoras.
- **NEGOCIO**: Configuración del Negocio, y solo para el jefe: Usuarios, Ticket, Insumos en POS y Auditoría.

**En el celular**: abajo hay una barra fija con **Inicio, Vender, Stock y Clientes**, y **☰ Más** abre el menú completo. Las tablas se ven como tarjetas (sin correr de costado) y el Dashboard muestra los números; los gráficos se abren con **📊 Ver gráficos**. En el Punto de Venta la barra no aparece, para dejar lugar al cobro.

**Buscador**: arriba del menú está **Buscar sección…** (o **Ctrl+K** desde cualquier pantalla). Escribí una palabra, por ejemplo "cierre", "devolución" o "qué pedir", y con **Enter** vas directo. No importan las tildes.

**Globitos rojos**: al lado de cada sección aparece cuántas cosas hay para atender: **Portal Cliente** (premios canjeados para entregar), **Pedidos** (mercadería que llegó y hay que avisar), **Compras y proveedores** (productos en o por debajo del stock mínimo), **Tareas** (tus tareas sin terminar). **Control de Inventario** muestra un puntito naranja cuando ya pasó el tiempo elegido sin controlar. Si el grupo está cerrado, el número aparece al lado del nombre del grupo. Se actualizan solos cada 2 minutos.

### VENTAS
- **Dashboard**: resumen del mes por local o consolidado.
  - Ventas del mes, resultado neto, margen bruto, ticket promedio, clientes nuevos, stock bajo y sin stock.
  - Facturación diaria, medios de pago, ventas por persona y alertas.
  - Arriba se elige el local (o Consolidado) y se actualiza con **Actualizar**.
- **Punto de Venta**: donde se vende y se factura. Ver "Cómo vender (Punto de Venta)".
  - Pestañas: **Nueva venta**, **Preventas**, **Facturas pendientes** y **Cambios / devoluciones**.
  - Arriba: **Modo prueba**, **Preventa**, **Señar**, el sonido y los modos de vista (Clásico, Catálogo, Celular, Táctil). **Atajos** muestra las teclas rápidas.
- **Ventas Online**: registrar ventas hechas por otros canales (Tienda Nube, Instagram, Mercado Libre, Pedidos Ya, TikTok Shop, etc.) que ya se facturaron por su plataforma.
  - No se vuelven a facturar en ARCA; sí descuentan stock y suman a las ventas.
  - Se cargan canal, N° de pedido, comprobante ya emitido (opcional), productos, envío cobrado, medio de pago y fecha.
  - Si el pedido parece estar cargado, avisa para no duplicarlo.
- **Buscar Precio**: buscar un producto (escribiendo o escaneando con la cámara del celular) para ver precio, stock de cada local y promos.
  - Copiar el precio o compartir un mensaje prolijo por WhatsApp o Instagram.
  - **Editar mensaje**: solo para ese envío, o como plantilla para todos los productos (jefe/admin).
- **Cambio / Devolución**: buscar la compra (N° de ticket, factura, DNI o nombre), elegir qué devuelve y qué se lleva y resolver la diferencia.
  - Pestañas **Nuevo cambio / devolución** e **Historial**.
  - Se puede hacer sin ticket (se toma el precio actual).

### STOCK
- **Inventario**: productos, precios, costos, stock por local, variantes, fotos, categorías, marcas y proveedores.
  - Pestañas: **Stock** (con filtros: stock bajo, sin stock, con reservas, sin costo cargado, sin código), **Valorización** (mercadería a costo, a precio de lista y ganancia potencial, por categoría), **En tránsito**, **Traspasos** e **Historial de ajustes**.
  - Botones **+ Nuevo producto** y **📥 Exportar**. En cada producto: **± Ajustar**, editar, desactivar/reactivar y eliminar.
- **Ingresos**: mercadería que llega de proveedores.
  - **📄 Cargar factura** lee la foto o PDF de la factura y detecta los productos.
  - **+ Nueva orden** para cargar a mano.
  - Las órdenes quedan "por recibir" (mercadería en camino) hasta que se tocan **📦 Recibir mercadería** y se cuenta lo que llegó en cada local.
  - La pestaña **Stock recibido** muestra el historial.
- **Inconsistencias**: diferencias al recibir mercadería (para reclamar al proveedor) y ventas hechas sin stock suficiente, con el motivo que puso quien vendió.
- **Kits**: combos de productos. El precio es la suma de los productos y al venderlo descuenta el stock de cada componente. Botón **Vender kit**.
- **Insumos**: stock de uso interno (bolsas, cajas, papel, limpieza), con costo de reposición, precio opcional para cobrarle al cliente y stock mínimo.
- **Control de Inventario**: conteo físico contra el stock del sistema.
  - Arriba: hace cuánto fue el último control, su exactitud (% de productos que coincidían), cuánto faltó (a costo) y los controles del año.
  - Conteo de todo el local o por categoría, marca o proveedor (te dice cuántos productos entran y cuánto tiempo lleva). Solo puede haber un control abierto por local.
  - Formas de contar: en la lista (Enter pasa al siguiente producto; el botón **= N** marca que hay lo mismo que dice el sistema; ↺ deshace), pasando el lector en el buscador, o con **📷 Escanear**: escaneás el código y aparece el producto; después escribís cuántos hay, o tocás **📷 Escanear cantidad (de a una)** y pasás cada unidad por la cámara (incluida la primera, sacando cada una del recuadro antes de la siguiente) y se van sumando. Con **−1 / +1** corregís. **Guardar y seguir** guarda y la cámara vuelve a buscar el próximo producto.
  - Al **Terminar control** se corrige solo la diferencia, así las ventas hechas mientras se contaba no se pierden. Los productos sin contar no se tocan.
  - El resultado muestra exactitud, faltantes y sobrantes con su valor, los faltantes más caros, consejos, y se pueden **descargar las diferencias** (CSV para Excel). Tocando un control del historial se ve su detalle.
  - En **🔔 Avisos** se elige cada cuántos días recordar que toca controlar.

### CAJA
- **Caja**: saldo actual de efectivo y movimientos.
  - **Nuevo movimiento**: ingreso o egreso con importe, concepto y destino (pago a proveedor, depósito en cuenta bancaria, gasto operativo, otro).
  - Los movimientos se pueden **Anular**.
- **Caja de Respaldo**: plata guardada aparte (ahorro, reserva). **Guardar plata** / **Sacar plata**, con total guardado e historial.
- **Cierre de Caja**: resumen del día.
  - Total vendido (en verde), ventas por medio de pago, movimientos de efectivo y ventas del día (con Anular).
  - **Arqueo**: fondo de cambio + ventas en efectivo + otros ingresos − egresos = lo que debería haber. Se cuenta por billetes o el total, se ve si cuadra, sobra o falta, y se toca **Cerrar caja**.
  - Pestañas **Productos vendidos** (con análisis ABC) e **Historial de cierres**. Botón **📲 Descargar** como imagen.
- **Gift Cards**: **+ Emitir Gift Card** (monto, a quién, cliente vinculado, forma de pago). Se ve el saldo de cada una, su historial, y se pueden anular.

### CLIENTES
- **Clientes**: alta y edición (nombre, celular, email, CUIT/DNI, cumpleaños), compras, cuánto gastó, última compra, puntos, nivel y si usa el portal.
  - Arriba: total de clientes, activos (compraron en los últimos 90 días), **para recuperar** (compraron pero hace más de 90 días que no vuelven) y **cumplen este mes**.
  - Filtros rápidos: Todos, Frecuentes, Nuevos, Para recuperar, Cumplen este mes y Sin compras. Se puede buscar por nombre, celular, email o DNI y ordenar por última compra, lo que gastó, puntos o nombre.
  - Botón 💬 para escribirle por WhatsApp directo.
  - **Ver ficha** (o tocar la fila): cuánto le falta para el próximo nivel, compras, gasto total, ticket promedio, lo que más compra, gift cards con saldo y últimas compras. Desde ahí: WhatsApp, editar, **cargar compra anterior** (migrar puntos de compras hechas antes de usar Lumiere), **resetear clave** del portal y eliminar (jefe).
  - Pestaña **Niveles**: el nivel se calcula por lo que el cliente compró en total (ventas válidas + compras anteriores cargadas). Cada negocio elige desde qué monto es Silver, Gold, Platinum y Black (sugerido: $50.000, $100.000, $200.000 y $500.000). Al guardar se recalcula el nivel de todos. Si se anula una venta, el nivel se recalcula solo.
- **Pedidos**: productos que un cliente está esperando.
  - **+ Anotar pedido**.
  - Cuando llega stock aparecen para avisar por WhatsApp. Los avisados quedan en historial y se ve si después compró.
  - Pestañas: en espera (por cliente o por producto), **Avisados** y **Estadísticas** (ventas recuperadas, conversión, espera promedio, sugerencias de productos que no vendemos).
- **Fidelización**: puntos y niveles (Bronze, Silver, Gold, Platinum, Black).
  - Los premios para canjear con puntos ahora están en **Portal Cliente → Premios**.
  - Buscar cliente por DNI para ver qué puede canjear, **Validar código de canje** e historial de canjes.

### EQUIPO
- **Tareas**: **+ Nueva tarea** con título, descripción, urgencia (baja, media, alta, urgente) y a quién se asigna.
  - La persona toca **Empezar** y **Finalizar**, o **Marcar error** si falta algo.
  - Muestra la rapidez de resolución por persona.

### FINANZAS
- **Finanzas**: arriba siempre Ingresos, Egresos, Resultado neto y Margen neto del mes (se elige local y mes con las flechas). Pestañas:
  - *Resumen*: en qué se fue la plata, margen de lo vendido (CMV), comisiones de medios de pago e IIBB estimado (el % se puede cambiar), y el formulario **Registrar egreso**.
  - *Movimientos*: ver, buscar, editar o borrar egresos cargados. Los que genera el sistema (ventas, gift cards, cambios, pagos de comisiones) dicen "automático" y no se editan desde acá.
  - *Estado de resultados*: ingresos menos cada tipo de costo, con % sobre ingresos.
  - El análisis de la salud del mes y las medallas se mudaron a **✨ Lumiere, tu gerente**. Allí, debajo del puntaje aparece un mensaje: si el mes fue bueno, te felicita y te dice qué salió mejor; si hay que mejorar, te da ánimo y hasta 3 soluciones concretas con un botón que te lleva a resolverlas. Los niveles son Excelente, Buena, En camino, Necesita ajustes y Momento de actuar.
  - *Comparar*: dos períodos (atajos: este mes vs mes pasado, vs mismo mes del año pasado, últimos 7 días).
  - *Costos por local* y *Punto de equilibrio* (cuánto hay que vender para cubrir los costos fijos, cuánto falta y cuánto vender por día).
- **Comprobantes**: facturas emitidas en ARCA, ventas que quedaron sin facturar (con **↻ Facturar** para reintentar) y anuladas.
  - Búsqueda, filtros por fecha, local, estado y tipo (A, B, C).
  - Reimpresión con CAE y botón **Excel para el contador**.
- **Comisiones**: comisiones de vendedores y desafíos de venta.
  - Pestañas **Comisiones**, **Desafíos** y **Configuración** (jefe/admin).
  - En Configuración se activa o desactiva cada cosa y se elige el tipo de comisión (por metas de monto, % de ventas, % por tramos o % sobre el excedente; diaria, semanal o mensual), con simulador.
- **Compras y proveedores**: pestañas *Qué pedir*, *Proveedores* (con cuentas a pagar y cuentas de pago), *Ventas por proveedor*, *Compras por período* y *Reclamos*.
- **Calculadoras**: fórmulas de precio por tipo de producto (desde el costo o desde el precio de venta del proveedor, con margen, impuestos y costos extra). Pestañas **Calcular** y **Administrar**.
- **Productividad**: ranking del equipo con ventas, total, ticket promedio, tiempo promedio por venta y ventas por hora.

### MARKETING
- **Cupones**: códigos de descuento (% o monto fijo, canal, usos máximos, vencimiento).
  - Influencers con su cupón y su comisión (con **Registrar pago**).
  - Regalos de campaña con código (**Validar y entregar**).
- **Promociones**: descuentos automáticos que el Punto de Venta aplica solo.
  - Tipos: descuento % o $, NxM (2x1, 3x2), cross-selling (llevando X, Y con descuento) y por monto (gastando más de $X).
  - Por producto, categoría o todos, opcionalmente con un medio de pago, y con vigencia.

### POSTVENTA
- **Postventa WA**: reglas automáticas de mensajes de WhatsApp (N días después de la compra, días sin actividad, cumpleaños), por segmento.
  - **Generar mensajes según las reglas activas** arma la lista para enviar uno por uno.

### CLIENTE
- **Portal Cliente**: el panel del portal donde tus clientes ven sus puntos, su nivel y canjean premios.
  - Cuántos clientes lo usan (de los que tienen DNI cargado), cuántos se registraron este mes y cuántos no pueden entrar porque no tienen DNI.
  - **Invitá a tus clientes**: cargá el link del portal y copiá el mensaje listo para mandar por WhatsApp.
  - **Premios para entregar**: los canjes hechos en el portal. Cuando el cliente viene con su código, tocá **Entregado**.
  - **Premios**: crear, editar y pausar los premios que se canjean con puntos.
  - **Diseño**: estilo, fondo (incluso una foto propia), mensaje de bienvenida y qué secciones se muestran, con vista previa en un celular.
  - **Ver el portal como un cliente**: buscá un cliente y mirá exactamente lo que ve él (puntos, cuánto le falta para el próximo nivel, premios que puede canjear, sus compras y canjes).

### NEGOCIO y CONFIGURACIÓN
- **Configuración del Negocio** (jefe):
  - Nombre y logo, y qué pasa con el ticket al terminar una venta (imprimir, enviar por WhatsApp o preguntar).
  - Datos fiscales de ARCA (CUIT, punto de venta, certificado y clave).
  - Locales (nombre y dirección).
  - Medios de pago (tipo, cuotas, comisión %, si es online, activo).
  - Categorías de gastos (variable, fijo, administrativo/marketing, sueldo).
  - Cuentas bancarias y billeteras.
- **Usuarios**: crear usuarios (nombre, email, contraseña inicial, rol y local), editarlos y darles permisos por sección (**Dar todo** / **Quitar todo**).
- **Insumos en POS**: activar **Descontar insumos en cada venta** y elegir cuáles se ofrecen.
- **Ticket**: qué datos salen en el ticket, el logo, el mensaje de agradecimiento y un texto extra (redes, teléfono, dirección).
- **Auditoría**: anulaciones y modificaciones hechas por el equipo, con fecha, usuario y detalle.

## Cómo hacer las tareas más comunes

### Cómo vender (Punto de Venta)
Hay 4 modos de vista arriba: **Clásico**, **Catálogo** (con fotos, ideal para cafeterías), **Celular** y **Táctil**.
1. Escaneá o buscá los productos (F2 va al buscador). Si el producto tiene variantes, elegí la variante.
   - Para cambiar la cantidad usá − / +, o tocá el número para escribirla.
   - El 🏷 de cada producto permite descuento (5/10/15/20% u otro) o cambiar el precio.
2. Si hace falta, tocá **📦 Agregar insumo** (bolsa, caja...) desde el carrito.
3. En Clásico tocá **Continuar →** (F9). En Catálogo, Táctil o Celular tocá **Cobrar →**.
4. Cargá el **DNI** del cliente (F4).
   - Si no está registrado, se puede dar de alta ahí mismo, o elegir **Consumidor final**.
   - Con cliente cargado se puede ver su **Ficha** (compras, ticket promedio, ideas para venderle).
5. Si corresponde, cargá el descuento general, el cupón o la gift card en **Descuentos**.
6. Elegí el **medio de pago** (Efectivo, Débito, Transferencia, Crédito...).
   - En efectivo podés poner con cuánto paga y ves el vuelto.
   - **Dividir pago** permite pagar con varios medios.
7. Elegí el comprobante (Factura B, Factura A o Remito) y tocá **Cobrar** (F9). Se factura en ARCA y se imprime o envía el ticket.

### Cómo cambiar la vista del Punto de Venta
Arriba del Punto de Venta elegí **Clásico** (buscador y carrito), **Catálogo** (grilla con fotos de productos y categorías), **Celular** (pensado para vender desde el teléfono) o **Táctil** (botones grandes para pantallas táctiles). Queda guardado en esa computadora.

### Cómo dividir un pago entre varios medios
En el cobro, en **Medio de pago**, tocá **Dividir pago**. Agregá cada medio con su importe (por ejemplo parte en efectivo y parte con débito) hasta completar el total; **Dividir igual** lo reparte en partes iguales. Después **Cobrar**.

### Cómo poner una venta en espera y retomarla
Con productos en el carrito tocá **⏸ Poner en espera** (F8) y poné un nombre para reconocerla ("rubia campera roja"). El carrito queda libre para atender a otro. Para retomarla, tocá su nombre en la fila **EN ESPERA** (arriba, debajo del buscador); con la ✕ se descarta. Las ventas en espera quedan guardadas en esa computadora.

### Cómo aplicar un descuento
- A un producto: tocá el 🏷 del producto en el carrito y elegí 5, 10, 15, 20% u otro %, o cambiá el precio.
- A toda la venta: en el cobro, **Descuentos** → elegí % o $ y escribí el valor en "Desc. general".
- Con cupón: escribí el código en **Cupón o gift card** y tocá **Aplicar**.
Las promociones configuradas en Promociones se aplican solas.

### Cómo cobrar con una gift card
En el cobro, en **Descuentos**, escribí el código de la gift card (empieza con GIFT) en **Cupón o gift card** → **Aplicar**. Se descuenta su saldo; si no alcanza, la diferencia se paga con otro medio.

### Cómo hacer una preventa o tomar una seña
Para vender algo que todavía no llegó (está en camino): activá **Preventa** arriba del Punto de Venta, armá el carrito y registrala a nombre del cliente. Para cobrar una parte por adelantado, activá **Señar**, poné el monto de la seña y con qué medio se cobró. Las preventas quedan en la pestaña **Preventas**, donde se completan cuando llega la mercadería.

### Cómo usar el modo prueba
Activá **Modo prueba** arriba del Punto de Venta (jefe o admin). Sirve para practicar o enseñar: la venta de prueba no se registra, no descuenta stock, no factura en ARCA ni mueve la caja; el ticket sale marcado "PRUEBA – NO VÁLIDO". Acordate de desactivarlo para vender de verdad.

### Cómo vender un kit
En el Punto de Venta buscá el kit como cualquier producto, o desde **Kits** tocá **Vender kit**. Se descuenta el stock de cada producto que lo compone.

### Cómo reintentar una factura que falló
Si ARCA dio error, la venta igual queda registrada. En el Punto de Venta tocá **Reintentar facturación**, o andá a **Comprobantes** → filtro **Sin facturar** → **↻ Facturar** en esa venta. También está la pestaña **Facturas pendientes** del Punto de Venta.

### Cómo reimprimir un ticket o factura
**Comprobantes** → buscá la venta (por número, cliente, DNI o CAE) → tocá 🖨️. La reimpresión sale con el CAE y dice REIMPRESIÓN.

### Cómo registrar una venta online
**Ventas Online** → elegí el canal (o escribí uno nuevo) → N° de pedido → comprobante ya emitido si lo tenés → agregá los productos → envío cobrado (opcional) → medio de pago → fecha → cliente (opcional, suma puntos) → guardar. No se factura de nuevo en ARCA.

### Cómo buscar un precio y mandárselo a un cliente
**Buscar Precio** → escribí o escaneá con 📷 → se ve el precio, el stock de cada local y las promos → **Copiar** o **Compartir** el mensaje para WhatsApp o Instagram. Con **✏️ Editar mensaje** lo cambiás para ese envío o como plantilla.

### Desafíos de venta
Si están activados (Comisiones → Configuración), después de armar el carrito y tocar **Continuar**, al cargar el DNI de un cliente con al menos 2 compras anteriores se compara el carrito con su ticket promedio. Si está por debajo, aparece el **🎯 Desafío** con cuánto falta para superarlo y una barra de progreso: el/la vendedor/a le ofrece algo más y lo suma al carrito. Si al cobrar el carrito supera el promedio, el desafío queda **superado**. Si al cargar el DNI el carrito ya lo superaba, en esa venta no hay desafío. El objetivo se fija una sola vez por venta (cambiar de cliente lo anula). Al juntar la cantidad de desafíos del mes configurada, el/la vendedor/a gana un producto de regalo (se entrega desde Comisiones → Desafíos).

### Cómo hacer un cambio o devolución
1. **Cambio / Devolución** → buscá la compra por N° de ticket, factura, DNI o nombre. Si no tiene ticket, elegí "No tiene el ticket" (se toma el precio actual).
2. Marcá qué **devuelve** y si vuelve al stock, y el motivo.
3. Elegí si se lleva otra cosa (**Sí, lo cambia**) y agregá lo que se lleva, o **No, solo devuelve**.
4. Resolvé la diferencia: si paga más, elegí con qué paga (entra a la caja, no hace factura nueva). Si queda a favor, elegí **Crédito a favor** (gift card) o **Devolver efectivo** (sale de la caja).
5. Confirmá. Se puede imprimir el comprobante del cambio.

### Cómo anular una venta
Desde **Cierre de Caja** → "Ventas del día" → **Anular** (pide motivo; jefe/administrativo). El stock vuelve al local. Si la venta ya tenía CAE, ante ARCA hay que emitir la nota de crédito (desde el portal de ARCA o el contador); Comprobantes avisa cuáles faltan.

### Cómo cerrar la caja
Cierre de Caja → revisá el total y los medios de pago → en **Arqueo de efectivo** poné el fondo de cambio, contá la plata por billetes (o el total) → si hay diferencia, anotá el motivo → **🔒 Cerrar caja**. Se puede corregir después con "Corregir".

### Qué hacer si la caja no cuadra
En el arqueo, revisá:
- que el **fondo de cambio** sea el correcto;
- los **movimientos de efectivo** del día (retiros o pagos que no se cargaron);
- ventas cobradas en efectivo que en realidad fueron con otro medio (o al revés);
- vueltos mal dados.
Si no aparece, cerrá la caja igual y anotá la diferencia en observaciones: queda en el **Historial de cierres**.

### Cómo registrar un movimiento de caja
**Caja** → **Nuevo movimiento** → ingreso o egreso → importe → concepto → destino u origen (pago a proveedor, depósito en cuenta bancaria, gasto operativo, otro) → **Registrar**. Para un depósito bancario elegí la cuenta destino. Si te equivocaste, usá **Anular**.

### Cómo guardar o sacar plata de la caja de respaldo
**Caja de Respaldo** → **Guardar plata** o **Sacar plata** → importe y concepto (opcional). Se ve el total guardado y el historial.

### Cómo emitir una gift card
**Gift Cards** → **+ Emitir Gift Card** → monto → nombre de quien la recibe → teléfono (opcional) → cliente vinculado (opcional) → forma de pago → **Emitir y cobrar**. También se puede emitir desde el Punto de Venta con **🎁 Emitir gift card**. El código empieza con GIFT.

### Cómo ver el saldo de una gift card
**Gift Cards** → buscá el código o el nombre → se ve el monto inicial, el saldo y **Ver historial** con cada uso.

### Cómo cargar un gasto (egreso)
Finanzas → Resumen → **Registrar egreso**: categoría, concepto, importe, fecha del gasto, local (local 1, local 2 o **Compartido**, con el % que le toca a cada uno) y cómo se pagó → **Registrar egreso**. Si un egreso quedó sin categoría, en Finanzas aparece un aviso con "Categorizar".

### Cómo corregir o categorizar un egreso
Finanzas → **Movimientos** → buscá el egreso (o tocá **Solo sin categoría**) → ✏️ → cambiá categoría, importe, fecha, local o forma de pago → **Guardar cambios**. Con ✕ se borra (pide confirmación).

### Cómo cambiar el reparto de gastos compartidos
Al cargar un egreso **Compartido**, mové la barra o tocá 50/50, 60/40, 70/30 u 80/20. Para dejarlo como reparto por defecto del negocio, tocá **Usar X/Y como reparto por defecto** (jefe/admin). La próxima vez que cargues un gasto de la misma categoría, te propone el último reparto usado.

### Cómo ver si el negocio gana plata
**Finanzas**: arriba están Ingresos, Egresos, Resultado neto y Margen neto del mes. En **Estado de resultados** ves cada tipo de costo y en **Punto de equilibrio** cuánto hay que vender para no perder plata y cuánto vender por día.

### Medallas del negocio
En **✨ Lumiere, tu gerente → 🏅 Tus logros** está la vitrina de **Medallas**: 10 logros que se ganan solos con los números reales del negocio (hasta 2 años hacia atrás). Son: **En equilibrio** (un mes vendiendo por encima del punto de equilibrio), **Antes del 20** (pasar el punto de equilibrio antes del día 20), **Buena salud** (un mes con 70 puntos o más), **Excelencia** (85 o más), **Racha de 3** (3 meses seguidos con salud Buena), **Mejora continua** (que el puntaje suba 3 meses seguidos), **Margen sano** (margen neto del 15% o más), **Costos a raya** (costos fijos del 15% o menos de las ventas), **Mes récord** (vender más que en cualquier mes anterior) y **Año sin pérdidas** (12 meses seguidos con ganancia). Las ganadas se ven en color con el mes en que se ganaron y cuántas veces; las que faltan, en gris con cómo ganarlas y cuánto falta. Las de salud solo cuentan meses ya cerrados y con gastos cargados: si no se cargan los gastos, no se ganan.

### Toma de decisiones (simular antes de decidir)
En **✨ Lumiere, tu gerente → 🧭 Toma de decisiones** simulás una situación con los números reales del negocio (el promedio de los últimos 3 meses cerrados) y Lumiere te da un veredicto con semáforo: 🟢 recomendable, 🟡 posible si vendés más, 🔴 no recomendable por ahora. Las situaciones son:
- **👤 Contratar un empleado**: sueldo bruto, cargas sociales (viene con 28%, consultalo con tu contador), aguinaldo y cuánto más creés que se va a vender. Te dice el costo real por mes y cuánto hay que vender de más para pagarlo.
- **🏠 Sumar un costo fijo**: alquiler, publicidad, un servicio.
- **🏷️ Subir o bajar precios**: cuántas unidades podés perder (si subís) o tenés que ganar (si bajás) para seguir ganando lo mismo.
- **🎉 Promoción o descuento**: % de descuento, 2x1, 3x2 o 2ª unidad con descuento. Primero elegís el objetivo: **vender más** (cuánto más hay que vender durante la promo para ganar lo mismo) o **liquidar lo que no rota** (si recuperás lo que pagaste y cuánto podés ganar reinvirtiendo esa plata; trae cargada la mercadería sin ventas en 90 días).
- **🎯 Llegar a una ganancia**: cuánto tenés que vender por mes y por día.
- **✂️ Bajar costos**: Lumiere revisa tus gastos por categoría, las comisiones de tarjeta, lo que le comprás a cada proveedor, los productos que dejan poco margen y la mercadería parada, y te da ideas concretas con cuánto ahorrarías por mes cada una (por ejemplo, renegociar el alquiler o pedirle un descuento a un proveedor, con el mensaje listo para copiar).
Es una estimación (ganancia = ventas × margen − costos fijos) para comparar opciones; no reemplaza el consejo de tu contador.

### Cómo comparar dos meses
Finanzas → **Comparar** → tocá un atajo (este mes vs mes pasado, vs mismo mes del año pasado, últimos 7 días) o elegí las fechas. Compara facturación, cantidad de ventas y ticket promedio.

### Cómo crear un producto
**Inventario** → **+ Nuevo producto** → código de barras (se puede escanear), nombre, marca, categoría, proveedor, costo, precio, stock inicial y stock mínimo → foto opcional → guardar. Con **🧮 Calcular precio** se usa una calculadora para sugerir el precio.

### Cómo cargar un producto con talles o colores (variantes)
Al crear o editar el producto, tildá **Tiene variantes (talles, colores...)**, escribí el tipo de variante (Talle, Color) y agregá cada variante con **+ Agregar** (valor, código y stock de cada local). Al vender, el Punto de Venta pide elegir la variante.

### Cómo ajustar el stock de un producto
**Inventario** → tocá el producto para abrir su detalle → **± Ajustar stock** → **Contar** (poner la cantidad real) o **Sumar / restar** → motivo (obligatorio) → confirmar. Queda en **Historial de ajustes** con tu nombre y la fecha.

Si no tenés el permiso **"Ajustar stock sin pedir autorización"**, el botón dice **± Pedir ajuste**: completás lo mismo y el pedido le llega al jefe (o a quien tenga ese permiso). Arriba de la lista de Inventario le aparece **"🔐 Ajustes de stock esperan tu aprobación"** con quién lo pidió, el cambio y el motivo: **Aprobar** cambia el stock y queda en el historial como "pedido por … aprobado por …"; **Rechazar** no toca nada.

### Cómo desactivar o eliminar un producto
**Inventario** → editar el producto → destildá **Producto activo** (deja de aparecer en el Punto de Venta sin borrar su historial). Para reactivarlo, filtrá **Inactivos** → **Reactivar**. Eliminar lo borra para siempre (pide confirmación): conviene desactivar.

### Cómo pasar mercadería de un local al otro (traspaso)
**Inventario** → **Traspasos** → **+ Nuevo traspaso** → producto, cantidad, hacia qué local y notas → **Enviar traspaso**. La mercadería queda en tránsito hasta que el otro local toca **Confirmar recepción** (con nota si llegó menos).

### Cómo ver cuánto vale la mercadería
**Inventario** → **Valorización**: mercadería a costo, si se vendiera todo a precio de lista, la ganancia potencial y el detalle por categoría. Con **📥 Exportar** se descarga el inventario.

### Cómo cargar una factura de proveedor
**Ingresos** → **📄 Cargar factura** → proveedor → número de factura (opcional) → subí la foto o el PDF. Revisá los productos detectados: vinculá cada uno con el producto de Lumiere (o **Crear producto nuevo**) y repartí la cantidad entre los locales → **Crear orden**. Queda como mercadería en camino.

### Cómo cargar una orden de ingreso a mano
**Ingresos** → **+ Nueva orden** → proveedor, número y total de factura, notas → agregá cada producto con su costo y la cantidad para cada local → **Crear orden**.

### Cómo recibir mercadería
Ingresos → la orden "por recibir" → **📦 Recibir mercadería** → contá lo que llegó en cada local y confirmá cada producto. Si llegó menos o con problemas, anotalo: aparece en Compras y proveedores → Reclamos → "Llegó distinto en Ingresos".

### Cómo registrar un regalo del proveedor
Al recibir una orden, en **🎁 Ítem extra** buscá el producto que vino de regalo, la cantidad y el local → **+ Agregar**. Suma al stock y queda registrado como extra.

### Cómo hacer un control de inventario (conteo)
**Control de Inventario** → **+ Nuevo control** → elegí qué contar (recomendado: una categoría) → **Empezar a contar**. Contá en la lista (escribí la cantidad y Enter, o **= N** si hay lo mismo que dice el sistema), pasá el lector en el buscador, o usá **📷 Escanear** con el celular (escaneás el producto y después escribís cuántos hay o los escaneás de a uno). Se guarda solo: con **Seguir después** lo retomás cuando quieras. Al **Terminar control** se corrige el stock por la diferencia y ves cuánto faltó y sobró.

### Cómo crear un kit o combo
**Kits** → **+ Nuevo kit** → nombre y descripción → agregá los productos con su cantidad → guardar. El precio es la suma de los productos; el descuento se aplica al venderlo.

### Cómo cargar insumos y descontarlos al vender
1. **Insumos** → **+ Nuevo insumo** → nombre, categoría, unidad, proveedor, costo de reposición, precio al cliente (opcional) y stock mínimo.
2. **Configuración → Insumos en POS** → activá **Descontar insumos en cada venta** y elegí cuáles ofrecer.
3. Al vender aparece **📦 Agregar insumo** en el carrito.

### Cómo calcular el precio de venta
**Calculadoras** → pestaña **Calcular** → elegí la calculadora → poné el costo (o el precio de venta del proveedor) → **Calcular precio**. En **Administrar** se crean las fórmulas (margen, impuestos y costos extra como bolsa o envío).

### Rotación del inventario (qué se vende y qué está parado)
En **♻️ Rotación** (menú STOCK) ves, por local y para los últimos 30, 60, 90 o 180 días:
- **Plata en mercadería** (stock a costo), **🧊 plata parada** (productos sin ventas en el período), **🐢 rotación lenta** (más de 90 días de stock) y **⚠️ para reponer** (productos que se venden y se están por agotar).
- **Clasificación ABC**: **A** son los productos que hacen el 80% de las ventas, **B** el 15% siguiente y **C** el resto. Compara qué % de las ventas hace cada grupo contra qué % de tu plata en stock tiene: si los C tienen mucha plata y venden poco, conviene liquidarlos y usar esa plata en productos A.
- La lista de productos con sus **días de stock** (cuánto te dura lo que tenés al ritmo actual), su estado (🔥 rota rápido, ✅ normal, 🐢 lento, 🧊 parado, 🌱 en evaluación) y **qué hacer**: reponer, o liquidar mostrando hasta qué descuento podés hacer sin perder plata.
- **Productos nuevos (🌱 en evaluación)**: un producto recién llegado no se marca lento ni parado hasta que pasan unos días (45 por defecto; se cambia abajo de la lista: 15, 30, 45, 60 o 90 días). Los días cuentan desde que se cargó o desde su primer ingreso de mercadería. Su ritmo de venta se mide sobre los días que lleva, no sobre todo el período. Si ya se vende rápido, aparece como 🔥 igual.
- **🧭 Simular liquidación** te lleva a Toma de decisiones con la mercadería lenta y parada ya cargada, para ver si el descuento conviene.
- **Costo de mantener**: tener mercadería guardada también cuesta plata. Rotación te muestra cuánto te cuesta por mes la mercadería lenta y parada, en tres partes: **💵 plata inmovilizada** (lo que rendiría esa plata en otro lado; viene con 20% anual), **🏠 espacio** (la parte de tu alquiler real que ocupan las unidades quietas; el alquiler sale de los gastos cargados en Finanzas) y **⚠️ riesgo** (roturas, vencimientos y cosas que pasan de moda; viene con 5% anual). Los % se pueden cambiar ahí mismo.

### Cómo se recalcula el stock mínimo
El **stock mínimo** de cada producto es el que usan las alertas de **stock bajo**. Lumiere lo **recalcula solo cada noche** con las ventas de los últimos 60 días de cada producto: venta diaria × (días que demora el proveedor + 7 días de colchón). Los productos con menos de 14 días de ventas no se tocan, porque hay poca información. Para recalcularlo en el momento, en **Inventario** tocá **↻ Recalcular stock mínimo**. Si preferís cargarlo a mano, en Inventario apagá **🌙 Recalcular solo cada noche**: así el sistema no lo cambia.

### Cómo pedir mercadería (Qué pedir)
Compras y proveedores → **Qué pedir** → elegí el proveedor, para qué local y para cuántos días querés que alcance. El sistema calcula con las ventas reales de cada producto:
- **Stock mínimo** = venta diaria × días de colchón (7 por defecto).
- **Punto de pedido** = venta diaria × días que demora el proveedor + stock mínimo.
- **A pedir** = lo que se va a vender en la demora + los días a cubrir + stock mínimo − (stock + en camino − reservado).
Las cantidades se pueden editar. Si un local tiene de sobra, sugiere traspasar. Después tenés tres opciones:
- **Copiar pedido**;
- **Enviar por WhatsApp** al proveedor;
- **Registrar como mercadería en camino**, que crea la orden que después se recibe en Ingresos.
En "Ajustar cálculo" se cambia la demora del proveedor y los días de colchón.

### Cómo cargar o editar un proveedor
Compras y proveedores → **Proveedores** → **+ Nuevo proveedor** (o ✏️ Editar): nombre, CUIT, qué vende, días para pagar, forma de pago, WhatsApp, teléfono, email, banco, alias, CBU, titular y notas. Con ✕ se desactiva (no se borran sus compras).

### Cómo reclamar a un proveedor
Compras y proveedores → **Reclamos**. Lo que llegó distinto en Ingresos aparece arriba:
- **Reclamar**: sale armado con el producto, la factura y la cantidad.
- **Reclamar las N**: carga juntas todas las de una factura y arma un solo WhatsApp.
- **No reclamar**: la descarta.
Para otros casos, **+ Nuevo reclamo**. Después: **Marcar enviado** → **Cerrar reclamo** (resuelto o rechazado).

### ¿Llego a pagarle al proveedor?
Compras y proveedores → **Ventas por proveedor**: por proveedor, lo que le debés contra lo vendido de sus productos desde la compra, la proyección al vencimiento y, si no llega, cuánto hay que vender por día y qué productos suyos conviene empujar con promociones.

### Cómo pagar a un proveedor
Compras y proveedores → Proveedores → **Cuentas a pagar** → **Pagar** (fecha, forma y cuenta). En la tarjeta del proveedor están el alias y CBU con botón Copiar. Marcar pagada no crea un egreso en Finanzas: si querés que figure, cargalo como egreso.

### Cómo dar de alta un cliente
**Clientes** → **+ Nuevo cliente** → nombre, celular, email, CUIT/DNI y cumpleaños → **Guardar**. También se puede dar de alta desde el Punto de Venta al cargar un DNI que no existe.

### Cómo cargar puntos de compras anteriores
**Clientes** → en el cliente, **Migrar puntos** → monto de la compra y fecha del comprobante → **Cargar puntos**. Se ven las cargas anteriores para no repetirlas.

### Cómo anotar un pedido de un cliente
**Pedidos** → **+ Anotar pedido** → buscá el cliente (o cargá nombre y celular si no está registrado) → el producto que espera (o escribí una sugerencia si no lo vendemos) → local → guardar. Cuando llegue stock aparece para avisarle.

### Cómo avisarle a un cliente que llegó lo que esperaba
Pedidos → **Listos para avisar** → botón de WhatsApp (se abre el mensaje listo) → queda en "Avisados". Si después compra, se marca solo (o con "Compró").

### Cómo crear un premio para canjear con puntos
**Portal Cliente** → pestaña **Premios** → **+ Nuevo premio** → nombre, precio del regalo (te sugiere los puntos para que el cliente gaste 5 veces ese valor), puntos, cuántos hay, quiénes lo pueden canjear (todos o desde un nivel), foto y si es solo del mes de cumpleaños → **Crear premio**. Con **Pausar** deja de verse en el portal sin borrarlo.

### Cómo cambiar el diseño del portal de clientes
**Portal Cliente** → pestaña **Diseño**: elegí el estilo (Girasoles, Claro, Oscuro o Salvia), el fondo (el del estilo, color liso o **una imagen propia**: tocá **Subir imagen**), escribí un mensaje de bienvenida y elegí si se muestra el saludo de cumpleaños y la escalera de niveles. A la derecha ves cómo queda en un celular (Inicio y Pantalla de ingreso). Tocá **Guardar diseño** y tus clientes lo ven así al instante.

### Cómo validar un canje de puntos
**Fidelización** → **Validar código de canje** → escribí el código que muestra el cliente (PREMIO-XXXX) → **Validar**. Para ver qué puede canjear un cliente, buscalo por DNI.

### Cómo crear un cupón de descuento
**Cupones** → **Nuevo cupón** → código (ej: VERANO30), descripción, tipo (porcentaje o monto fijo), valor, canal, usos máximos y vencimiento → **Crear cupón**. En el Punto de Venta se aplica escribiendo el código en **Cupón o gift card**.

### Cómo trabajar con influencers
**Cupones** → **+ Agregar influencer** → nombre, Instagram, teléfono → crear un cupón nuevo o usar uno existente. Se ve cuánto se vendió con su cupón y su comisión; **Registrar pago** cuando se le paga. Con **+ Regalo** se le asigna un producto de regalo con código.

### Cómo crear una promoción automática
**Promociones** → **+ Nueva promoción** → nombre → tipo:
- descuento % / $;
- NxM (2x1, 3x2);
- cross-selling (llevando X, Y con descuento);
- por monto (gastando más de $X).
Después elegí a qué aplica (todos, categorías o productos), si es solo con un medio de pago, y las fechas desde y hasta. El Punto de Venta la aplica sola.

### Cómo mandar mensajes de postventa por WhatsApp
**Postventa WA** → **Nueva regla automática** → nombre, disparador (N días después de la compra, días sin actividad o cumpleaños), segmento y mensaje (con {nombre}) → **Crear regla**. Después **Generar mensajes según las reglas activas** y enviá cada uno con **Enviar WhatsApp**.

### Cómo crear y asignar una tarea
**Tareas** → **+ Nueva tarea** → título, descripción, urgencia y a quién → **Crear tarea**. La persona la ve en Pendientes y toca **Empezar** / **Finalizar**.

### Cómo configurar las comisiones
**Comisiones** → **Configuración** (jefe/admin) → activá **Comisiones para vendedores** → elegí el local, el tipo (metas de monto, % de ventas, % por tramos o % sobre el excedente) y el período (diaria, semanal o mensual) → probá con el simulador → **Guardar comisión**.

### Cuánta comisión conviene pagar
Si no sabés qué porcentaje poner, en **Comisiones → Configuración** tocá **💡 Calcular comisión saludable**. Lumiere mira las ventas y el margen reales del local en los últimos 90 días y propone dos opciones: un **% de las ventas** (que se lleva una parte chica de la ganancia de la mercadería, y te dice cuánto costaría por mes) y un **% sobre lo que supere la meta** (la meta es lo que el local ya vende en promedio: solo se paga si venden más de lo normal). Tocá **Usar esta**, revisala en el simulador y tocá **Guardar**. Hacen falta al menos 3 semanas de ventas y los costos de los productos cargados.

### Cómo pagar comisiones
**Comisiones** → pestaña **Comisiones** → tildá los días a pagar (o pagá un monto suelto) → **Pagar** → forma de pago (efectivo, transferencia o canje por productos con descuento de empleada) → confirmar. Queda registrado como egreso.

### Cómo entregar el premio de un desafío
**Comisiones** → **Desafíos** → elegí el mes → en el/la vendedor/a que llegó a la meta, entregá el premio eligiendo el producto (hasta el monto configurado). Se descuenta del stock.

### Cómo activar o desactivar comisiones y desafíos
**Comisiones** → **Configuración** → en "Qué usa este negocio" tocá el interruptor de **Comisiones para vendedores** o de **Desafíos de venta**. Se guarda al tocarlo.

### Cómo crear un usuario y darle permisos
**Negocio → Usuarios** → **+ Nuevo usuario** → nombre, email, contraseña inicial (mínimo 6 caracteres), rol (Jefe, Administrativo, Vendedor/a) y local → **Crear**. Después **Permisos**: están ordenados como el menú (Ventas, Stock, Caja, Clientes, Equipo, Finanzas, Negocio) y cada sección tiene su interruptor; si está apagado, esa persona no ve la sección. Además, dentro de algunas secciones se eligen las **acciones**: en Inventario, crear, editar y eliminar productos y ajustar stock sin autorización; en el Punto de Venta, hacer descuentos a mano; y en Caja, anular ventas, movimientos de caja y gift cards. **Plantilla vendedor/a** prende lo típico de quien atiende el local; también hay **Dar todo** y **Quitar todo** (en general o por grupo) → **Guardar permisos**. Los cambios se aplican la próxima vez que esa persona entra o recarga la página. El jefe ve todo siempre.

### Cómo desactivar o eliminar un usuario
En **Negocio → Usuarios**:
- **Desactivar**: esa persona no puede entrar (si estaba adentro, el sistema la saca). No se borra nada y se puede **Activar** de nuevo. Ideal para vacaciones o licencias.
- **Eliminar**: el usuario desaparece de la lista, no puede entrar más y se le quitan los permisos; su email queda libre para usarlo en otro usuario. Antes de eliminar aparece un aviso con lo que hizo. **Lo que hizo no se borra** (ventas, movimientos de caja, ajustes de stock, controles de inventario): queda en el historial con su nombre, para que los números del negocio no cambien. Sus tareas sin terminar quedan sin asignar.
- No se puede desactivar ni eliminar al único jefe, ni a uno mismo.

### Cómo explicar los faltantes de un control de inventario
Al tocar **Terminar control**, si hay diferencias aparece **«¿Por qué hay diferencias?»**: en cada producto que **falta** hay que elegir el **motivo** (Rotura, Vencido o dañado, Robo o hurto, Regalo o muestra, Uso interno, Venta sin registrar, Ingreso mal cargado, Se contó mal, Error de etiqueta, No sé qué pasó u Otro) y, si se quiere, escribir el detalle. Con **Otro** el detalle es obligatorio. Si son muchos, arriba se puede elegir **un mismo motivo para todos los que faltan explicar** y tocar **Aplicar**. No se puede terminar el control hasta explicar todos los faltantes (los sobrantes son opcionales). Queda registrado **quién lo explicó**. En un control ya terminado, cada diferencia muestra su explicación y se puede **Explicar** o **Cambiar** desde ahí.

### Cómo justificar los faltantes de un control que ya se terminó
En **Control de Inventario → Historial**, los controles con pendientes muestran **«✍️ N faltantes sin justificar»**. Abrí ese control y tocá **✍️ Justificar faltantes**: aparece la lista de todo lo que falta explicar. Elegís el motivo de cada producto (o un mismo motivo para todos con **Aplicar**), el detalle si querés, y **Guardar**. Se puede guardar una parte y completar el resto después. Queda registrado quién lo justificó. Sirve para los controles hechos antes de que existieran las explicaciones.

### Cómo sacar un informe de faltantes
- **De un control**: Control de Inventario → abrí el control en el Historial → **📄 Informe de faltantes**. Se abre una hoja para **imprimir o guardar en PDF** con cada faltante, su valor, la explicación, quién la dio y lugar para las firmas.
- **De un local en un período**: Control de Inventario → **📄 Informe de faltantes** (arriba). Elegís el **local** y el período (último mes, 3 meses, 6 meses o 1 año) y ves: cuánto faltó en total, **por qué faltó** (los motivos ordenados por plata), los **productos que faltan una y otra vez**, cuántos faltantes quedaron **sin explicar** y el detalle de **cada control**. Con **🖨 Imprimir / PDF** sale todo en una hoja.

### Cómo saber cuánta plata hay en faltantes
**Control de Inventario → 📄 Informe de faltantes**. Elegí el local (o **Los dos locales**) y el período. Arriba aparece **💰 Todo lo que falta (a costo)** y, más abajo, la lista **producto por producto** con las unidades que faltan, el costo de cada una, el valor y el motivo, con el **TOTAL** al final. Si un control no corrigió el stock y el siguiente encontró el mismo faltante, se cuenta una sola vez. Sale también en **🖨 Imprimir / PDF**.

### Cómo ver la historia de un producto (lo que llegó contra lo que se vendió)
**Control de Inventario → 🔎 Diagnóstico de stock → Seguir un producto**: escribí el nombre, la marca o el código y elegilo. (También está el botón **Ver historia** en cada producto con diferencia de un control y en el informe de faltantes.) Para cada local muestra: lo que **dice el sistema**, lo que **debería haber** y si **la cuenta da**; cuánto **llegó**, cuánto **se vendió**, devoluciones, traspasos, ajustes a mano y correcciones de controles; y la lista de **cada movimiento** con su fecha, quién lo hizo y cuánto quedaba. El "debería haber" se calcula desde el último control o ajuste (el **punto de partida**). Si la cuenta da pero en el local hay otra cantidad, la diferencia es física: se rompió, se llevó, o hay un movimiento que nadie cargó. Si la cuenta NO da, hay un cambio de stock sin registro: avisá a soporte.

### Cómo saber por qué el stock no coincide (Diagnóstico de stock)
**Control de Inventario → 🔎 Diagnóstico de stock**. Revisa los últimos 6 meses y muestra: **ventas cargadas en el otro local** (alguien que vendió en un local distinto al que tiene asignado: ese stock se descontó del otro local), productos que **faltan en un local y sobran en el otro**, **traspasos enviados que nadie recibió**, **facturas de proveedor sin controlar**, **ventas de productos que el sistema daba sin stock**, productos con **stock negativo** y **ajustes hechos a mano**. Cada parte dice si está bien o hay que revisar, y qué significa.

### Cómo descargar una copia de seguridad de mis datos
**Negocio → Configuración del Negocio → COPIA DE SEGURIDAD → ⬇ Descargar copia de seguridad**. Solo el dueño (rol jefe) puede hacerlo. Baja a tu compu un archivo (lumiere-copia-FECHA.json.gz) con **todos los datos del negocio**: productos, ventas, clientes, caja, compras y configuración. Conviene hacerla una vez por semana y antes de cambios grandes, y guardarla en un lugar seguro (pendrive o nube) porque tiene datos de tu negocio y de tus clientes. No hace falta abrir el archivo: si algún día hay que recuperar algo, se lo mandás a soporte (hola@sistemalumiere.com). Si tenés muchos datos puede tardar un rato: no cierres la pantalla mientras baja.

### Cómo elegir la moneda (y trabajar con dos monedas)
**Negocio → Configuración del Negocio → MONEDA**:
- **Moneda principal**: elegís la de tu país (peso argentino, uruguayo, chileno, colombiano, mexicano, dominicano, cubano, sol, boliviano, guaraní, real, quetzal, lempira, córdoba, colón, balboa, bolívar, dólar o euro). Se ve un ejemplo de cómo van a quedar los montos (por ejemplo **S/ 1,234,567.50** en Perú o **$ 1.234.568** sin centavos en Chile). Al guardar, todo el sistema muestra los montos así. Ojo: no convierte los precios cargados, solo cambia cómo se muestran.
- **Segunda moneda (opcional)**: por ejemplo dólares. Cargás la **cotización** (cuánto vale 1 de la segunda moneda en la principal) y elegís si querés **mostrar el total también en esa moneda** en el Punto de Venta y si **aceptás pagos en efectivo en esa moneda**. Cuando el cliente paga en esa moneda, escribís cuánto te dio en **"¿Paga en dólares?"**: el sistema lo convierte y calcula el vuelto en la moneda principal. La venta y la caja quedan registradas en la moneda principal. Actualizá la cotización cuando cambie.

### Cómo cambiar el nombre o los datos del negocio
**Configuración del Negocio** → **Datos generales** → nombre del negocio y logo → **Guardar**. Ahí también se elige si el ticket se imprime, se envía por WhatsApp o se pregunta cada vez.

### Cómo cambiar el nombre de un local
**Configuración del Negocio** → Locales → **Editar** → nombre y dirección → guardar. El nombre se usa en todo el sistema.

### Cómo agregar un medio de pago
**Configuración del Negocio** → Medios de pago → **+ Nuevo medio de pago** → nombre, tipo (efectivo, débito, crédito, transferencia, plataforma), cuotas y comisión % → guardar. La comisión se usa en Finanzas para calcular lo que se lleva cada medio.

### Cómo configurar la factura electrónica (ARCA)
**Configuración del Negocio** → **Datos fiscales para facturar con ARCA** → CUIT (sin guiones), punto de venta, certificado y clave → **Guardar datos fiscales**. Cada dato muestra si ya está configurado. Si no sabés cómo obtener el certificado, pedíselo a tu contador.

### Cómo personalizar el ticket
**Configuración → Ticket** → qué datos se muestran (fecha, número, cliente), logo del ticket, mensaje de agradecimiento y texto extra (redes, teléfono, dirección) → **Guardar**.

### Cómo cargar categorías de gastos y cuentas bancarias
**Configuración del Negocio** → Categorías → **+ Nueva categoría** (variable, fijo, administrativo/marketing o sueldo). Cuentas → **+ Nueva cuenta** (transferencia bancaria o billetera virtual, banco, titular, CBU/CVU, alias).

### Cómo ver quién anuló o modificó algo
**Configuración → Auditoría** → filtrá por tipo. Muestra fecha, tipo, referencia, usuario y detalle de cada anulación o modificación.

### Documentación para el contador
Comprobantes → elegir el período → **Excel para el contador**. Finanzas → Estado de resultados para el resultado del mes.

## Problemas frecuentes

### El ticket no se imprime
El navegador tiene que permitir ventanas emergentes de Lumiere: tocá el ícono de ventana bloqueada en la barra de direcciones y elegí "Permitir siempre". Revisá que la impresora térmica esté encendida y sea la predeterminada. En Configuración del Negocio se puede elegir enviar el ticket por WhatsApp en vez de imprimir.

### ARCA dio error al facturar
La venta queda registrada igual. Reintentá con **Reintentar facturación** o desde **Comprobantes** → **↻ Facturar**. Si el error sigue, revisá los datos fiscales en Configuración del Negocio o consultá a tu contador; el mensaje del error se ve en el detalle del comprobante.

### No me deja vender un producto sin stock
Si el producto no tiene stock y tampoco hay nada en camino, no se puede vender: cargá primero el ingreso o ajustá el stock si es un error. Si hay mercadería en camino, se puede vender escribiendo el motivo (queda en Inconsistencias).

### La cámara no escanea
El navegador tiene que tener permiso para usar la cámara (tocá el candado de la barra de direcciones → Cámara → Permitir). Acercá el código de barras con buena luz. Siempre se puede escribir el código a mano.

### No veo una sección del menú
Probá primero con el buscador de arriba del menú (Ctrl+K): puede estar en un grupo cerrado. Si no aparece, tu usuario no tiene ese permiso: pedíselo al jefe en Negocio → Usuarios → Permisos.

### Un producto figura sin stock pero hay
Revisá en qué local está el stock (el Punto de Venta muestra el del local elegido) y si hay un traspaso sin confirmar. Si es un error de carga, corregilo con **± Ajustar** en Inventario.

### Me equivoqué en una venta
Si todavía no la cobraste, sacá o cambiá los productos del carrito. Si ya la cobraste, anulala desde Cierre de Caja (jefe/administrativo) o hacé un cambio/devolución si el cliente ya se llevó el producto.

## Atajos del Punto de Venta
F2 buscar · F4 DNI · F8 poner en espera · F9 continuar/cobrar · Esc cerrar · ? ver todos los atajos.
