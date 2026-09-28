# Manual de Lumiere

Lumiere es un sistema de gestión para comercios minoristas con uno o dos locales: punto de venta con factura electrónica de ARCA, stock por local, caja, clientes, compras a proveedores, finanzas y equipo. Los nombres de los locales, el logo y los datos del negocio se configuran en cada negocio (en este manual se dice "local 1" y "local 2").

## Roles y permisos
- **Jefe**: ve y configura todo.
- **Admin / Administrativo**: casi todo; algunas configuraciones son solo del jefe.
- **Vendedora/vendedor**: ve lo que el jefe le habilite en **Configuración → Usuarios** (permisos por sección). Si alguien no ve una sección del menú, es porque no tiene ese permiso: tiene que pedírselo al jefe.

## Menú (secciones)

### VENTAS
- **Dashboard**: resumen del mes por local o consolidado: ventas, resultado neto, margen, ticket promedio, clientes, stock bajo, facturación diaria, medios de pago, ventas por vendedora y alertas.
- **Punto de Venta**: donde se vende y se factura. Ver "Cómo vender".
- **Ventas Online**: registrar ventas hechas por otros canales (Tienda Nube, Instagram, Mercado Libre, etc.) que ya se facturaron por otro lado. No vuelven a facturarse en ARCA; sí descuentan stock y suman a las ventas.
- **Buscar Precio**: buscar un producto (escribiendo o escaneando con la cámara del celular) para ver precio, stock de cada local y promos. Tiene botones para copiar el precio o compartir un mensaje prolijo por WhatsApp o Instagram. El mensaje se puede editar ("Editar mensaje"): solo para ese envío, o como plantilla para todos los productos (jefe/admin).
- **Cambio / Devolución**: buscar la venta original (por número de ticket, factura, DNI o nombre) y hacer el cambio: qué vuelve, qué se lleva, si vuelve al stock, y cómo se resuelve la diferencia (se cobra, se devuelve en efectivo o queda como crédito en gift card).

### STOCK
- **Inventario**: productos, precios, costos, stock por local, variantes (talles/colores), fotos, categorías, activar/desactivar. Tiene "Recalcular stock mínimo", que usa las ventas reales.
- **Ingresos**: órdenes de mercadería que llega de proveedores (se puede cargar desde la foto/PDF de la factura). Quedan "en camino" hasta que se reciben. Al recibir, se cuenta lo que llegó en cada local; si llegó menos o con problemas, se anota y aparece para reclamar al proveedor.
- **Inconsistencias**: diferencias al recibir mercadería y ventas hechas sin stock (con el motivo que puso la vendedora).
- **Kits**: combos de productos que descuentan el stock de cada componente.
- **Insumos**: stock de uso interno (bolsas, cajas, papel de regalo...).
- **Control de Inventario**: conteo físico contra el stock del sistema, con ajuste de diferencias.

### CAJA
- **Caja**: movimientos de efectivo (ingresos y egresos) y saldo.
- **Caja de Respaldo**: plata guardada aparte, a favor.
- **Cierre de Caja**: resumen del día: total vendido (grande, en verde), ventas por medio de pago, movimientos de efectivo y **arqueo**: fondo de cambio + ventas en efectivo + otros ingresos − egresos = lo que debería haber. Se cuenta por billetes o el total, se ve si cuadra, sobra o falta, y se toca **Cerrar caja**. Tiene historial de cierres y se puede descargar como imagen.
- **Gift Cards**: emisión y seguimiento de saldo.

### CLIENTES
- **Clientes**: datos, historial de compras y puntos.
- **Pedidos**: productos que un cliente está esperando. Cuando llega stock aparecen en "Listos para avisar" con botón de WhatsApp; los avisados quedan en historial y se ve si después compró ("ventas recuperadas"). Los pedidos se pueden editar.
- **Fidelización**: puntos, niveles y canjes.

### EQUIPO
- **Tareas**: tareas para el equipo.

### FINANZAS
- **Finanzas**: arriba siempre Ingresos, Egresos, Resultado neto y Margen neto del mes (elegís local y mes con las flechas). Pestañas:
  - *Resumen*: en qué se fue la plata, margen de lo vendido (CMV), comisiones de medios de pago e IIBB estimado (el % se puede cambiar), y el formulario **Registrar egreso**.
  - *Movimientos*: ver, buscar, editar o borrar egresos cargados. Los que genera el sistema (ventas, gift cards, cambios, pagos de comisiones) dicen "automático" y no se editan desde acá.
  - *Estado de resultados*: ingresos menos cada tipo de costo, con % sobre ingresos.
  - *Análisis*: calificación de la salud financiera del mes.
  - *Comparar*: dos períodos (atajos: este mes vs mes pasado, vs mismo mes del año pasado, últimos 7 días).
  - *Costos por local* y *Punto de equilibrio* (cuánto hay que vender para cubrir los costos fijos, cuánto falta y cuánto vender por día).
- **Comprobantes**: facturas emitidas en ARCA, ventas que quedaron sin facturar (con botón "↻ Facturar" para reintentar) y anuladas. Búsqueda, filtros, reimpresión con CAE y botón **Excel para el contador**.
- **Comisiones**: comisiones de vendedores y desafíos de venta. En *Configuración* (jefe/admin) se activa o desactiva cada cosa y se elige el tipo de comisión: por metas de monto, % de ventas, % por tramos o % sobre el excedente; diaria, semanal o mensual. Tiene simulador.
- **Compras y proveedores**: pestañas *Qué pedir*, *Proveedores*, *Ventas por proveedor*, *Compras por período* y *Reclamos*. Ver "Cómo pedir mercadería".
- **Calculadoras**: fórmulas de precio por tipo de producto.
- **Productividad**: métricas por vendedora.

### MARKETING
- **Cupones**: códigos de descuento, influencers, campañas.
- **Promociones**: descuentos y promos automáticas que el Punto de Venta aplica solo.

### POSTVENTA
- **Postventa WA**: mensajes de WhatsApp de seguimiento y reactivación.

### NEGOCIO y CONFIGURACIÓN
- **Configuración del Negocio** (jefe): nombre, logo, locales (nombres), medios de pago (con su % de comisión), categorías, datos fiscales para ARCA (CUIT, punto de venta, certificado), cómo se entrega el ticket (imprimir o enviar), etc.
- **Usuarios**: crear usuarios, rol, local y permisos.
- **Insumos en POS**: qué insumos se ofrecen al vender.
- **Ticket**: qué se imprime en el ticket.
- **Auditoría**: anulaciones y modificaciones hechas por el equipo.

## Cómo hacer las tareas más comunes

### Cómo vender (Punto de Venta)
Hay 4 modos de vista arriba: **Clásico**, **Catálogo** (con fotos, ideal para cafeterías), **Celular** y **Táctil**.
1. Escaneá o buscá los productos (F2 va al buscador). Si el producto tiene variantes, elegí la variante. Para cambiar la cantidad usá − / +, o tocá el número para escribirla. El 🏷 de cada producto permite descuento (5/10/15/20% u otro) o cambiar el precio.
2. Si hace falta, **📦 Agregar insumo** (bolsa, caja...) desde el carrito.
3. En Clásico tocá **Continuar →** (F9). En Catálogo/Táctil/Celular tocá **Cobrar →**.
4. Cargá el **DNI** del cliente (F4). Si no está registrado se puede dar de alta ahí mismo, o elegir **Consumidor final**. Con cliente cargado se puede ver su **Ficha** (compras, ticket promedio, ideas para venderle).
5. Descuento general, cupón o gift card en **Descuentos**.
6. Elegí el **medio de pago** (Efectivo, Débito, Transferencia, Crédito...). En efectivo podés poner con cuánto paga y ves el vuelto. **Dividir pago** para pagar con varios medios.
7. Elegí el comprobante (Factura B, Factura A o Remito) y tocá **Cobrar** (F9). Se factura en ARCA y se imprime o envía el ticket.
- **Poner en espera** (F8): guarda la venta para retomarla después (por ejemplo si el cliente se fue a probar algo). Se retoma desde la fila "EN ESPERA".
- **Modo prueba** (jefe/admin): para practicar; no registra la venta, no descuenta stock ni factura.
- **Preventa / Seña**: para vender algo que todavía no llegó (reserva sobre lo que está en camino).
- Si ARCA falla, la venta queda registrada y se reintenta con "Reintentar facturación" o desde Comprobantes.

### Desafíos de venta
Si están activados (Comisiones → Configuración), al identificar a un cliente que tiene al menos 2 compras anteriores se compara el carrito con su ticket promedio: si lo supera, el desafío queda **superado**. Se mide una sola vez por venta, en el momento de cargar el DNI: agregar productos después no cuenta; sacar productos sí descuenta. Al juntar la cantidad de desafíos del mes configurada, la vendedora gana un producto de regalo (se entrega desde Comisiones → Desafíos).

### Cómo hacer un cambio o devolución
Cambio / Devolución → buscar la venta → marcar qué vuelve (y si vuelve al stock) → agregar lo que se lleva → resolver la diferencia (cobrar, devolver efectivo o crédito en gift card) → confirmar.

### Cómo anular una venta
Desde **Cierre de Caja** → "Ventas del día" → **Anular** (pide motivo; jefe/administrativo). El stock vuelve al local. Si la venta ya tenía CAE, ante ARCA hay que emitir la nota de crédito (desde el portal de ARCA o el contador); Comprobantes avisa cuáles faltan.

### Cómo cerrar la caja
Cierre de Caja → revisá el total y los medios de pago → en **Arqueo de efectivo** poné el fondo de cambio, contá la plata por billetes (o el total) → si hay diferencia, anotá el motivo → **🔒 Cerrar caja**. Se puede corregir después con "Corregir".

### Cómo cargar un gasto (egreso)
Finanzas → Resumen → **Registrar egreso**: categoría, concepto, importe, fecha del gasto, local (local 1, local 2 o **Compartido**, con el % que le toca a cada uno) y cómo se pagó → **Registrar egreso**. Si un egreso quedó sin categoría, en Finanzas aparece un aviso con "Categorizar".

### Cómo pedir mercadería (Qué pedir)
Compras y proveedores → **Qué pedir** → elegí el proveedor, para qué local y para cuántos días querés que alcance. El sistema calcula con las ventas reales de cada producto:
- **Stock mínimo** = venta diaria × días de colchón (7 por defecto).
- **Punto de pedido** = venta diaria × días que demora el proveedor + stock mínimo.
- **A pedir** = lo que se va a vender en la demora + los días a cubrir + stock mínimo − (stock + en camino − reservado).
Las cantidades se pueden editar. Si un local tiene de sobra, sugiere traspasar. Después: **Copiar pedido**, **Enviar por WhatsApp** al proveedor, o **Registrar como mercadería en camino** (crea la orden que después se recibe en Ingresos). En "Ajustar cálculo" se cambia la demora del proveedor y los días de colchón.

### Cómo recibir mercadería
Ingresos → la orden "por recibir" → **Recibir** → contá lo que llegó en cada local. Si llegó menos o con problemas, anotalo: aparece en Compras y proveedores → Reclamos → "Llegó distinto en Ingresos".

### Cómo reclamar a un proveedor
Compras y proveedores → **Reclamos**. Lo que llegó distinto en Ingresos aparece arriba: **Reclamar** (sale armado con producto, factura y cantidad) o **Reclamar las N** de una factura juntas con un solo WhatsApp; **No reclamar** para descartar. Para otros casos, **+ Nuevo reclamo**. Después: Marcar enviado → Cerrar reclamo (resuelto o rechazado).

### ¿Llego a pagarle al proveedor?
Compras y proveedores → **Ventas por proveedor**: por proveedor, lo que le debés contra lo vendido de sus productos desde la compra, la proyección al vencimiento y, si no llega, cuánto hay que vender por día y qué productos suyos conviene empujar con promociones.

### Cómo pagar a un proveedor
Compras y proveedores → Proveedores → **Cuentas a pagar** → **Pagar** (fecha, forma y cuenta). En la tarjeta del proveedor están el alias y CBU con botón Copiar. Marcar pagada no crea un egreso en Finanzas: si querés que figure, cargalo como egreso.

### Cómo avisarle a un cliente que llegó lo que esperaba
Pedidos → **Listos para avisar** → botón de WhatsApp (se abre el mensaje listo) → queda en "Avisados". Si después compra, se marca solo (o con "Compró").

### Documentación para el contador
Comprobantes → elegir el período → **Excel para el contador**. Finanzas → Estado de resultados para el resultado del mes.

## Atajos del Punto de Venta
F2 buscar · F4 DNI · F8 poner en espera · F9 continuar/cobrar · Esc cerrar · ? ver todos los atajos.
