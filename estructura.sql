--
-- PostgreSQL database dump
--

\restrict moXZWblVrJqsgNqCsqtutiLEpJd8E0bkqEug9JeZqbs0mLHbfWTCh6hANLcSdVf

-- Dumped from database version 18.4 (Debian 18.4-1.pgdg13+1)
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ajustes_stock; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ajustes_stock (
    id integer NOT NULL,
    producto_id integer,
    stock_anterior integer,
    stock_nuevo integer,
    diferencia integer,
    motivo text,
    usuario_id integer,
    usuario_nombre text,
    local_id integer,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.ajustes_stock OWNER TO postgres;

--
-- Name: ajustes_stock_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ajustes_stock_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ajustes_stock_id_seq OWNER TO postgres;

--
-- Name: ajustes_stock_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ajustes_stock_id_seq OWNED BY public.ajustes_stock.id;


--
-- Name: anulaciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.anulaciones (
    id integer NOT NULL,
    tipo character varying(30) NOT NULL,
    referencia_id integer NOT NULL,
    referencia_codigo text,
    motivo text NOT NULL,
    usuario_id integer,
    usuario_nombre text,
    detalle_json jsonb,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.anulaciones OWNER TO postgres;

--
-- Name: anulaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.anulaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.anulaciones_id_seq OWNER TO postgres;

--
-- Name: anulaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.anulaciones_id_seq OWNED BY public.anulaciones.id;


--
-- Name: arca_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.arca_tokens (
    id integer NOT NULL,
    token text NOT NULL,
    sign text NOT NULL,
    expiracion timestamp without time zone NOT NULL,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.arca_tokens OWNER TO postgres;

--
-- Name: arca_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.arca_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.arca_tokens_id_seq OWNER TO postgres;

--
-- Name: arca_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.arca_tokens_id_seq OWNED BY public.arca_tokens.id;


--
-- Name: caja_respaldo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.caja_respaldo (
    id integer NOT NULL,
    tipo text NOT NULL,
    importe numeric NOT NULL,
    concepto text,
    cuenta_pago_id integer,
    usuario_id integer,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.caja_respaldo OWNER TO postgres;

--
-- Name: caja_respaldo_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.caja_respaldo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.caja_respaldo_id_seq OWNER TO postgres;

--
-- Name: caja_respaldo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.caja_respaldo_id_seq OWNED BY public.caja_respaldo.id;


--
-- Name: calculadoras_precio; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calculadoras_precio (
    id integer NOT NULL,
    nombre character varying(255) NOT NULL,
    descripcion text,
    tipo character varying(50) NOT NULL,
    margen numeric DEFAULT 1,
    iva numeric DEFAULT 0,
    extras jsonb DEFAULT '[]'::jsonb,
    activo boolean DEFAULT true,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.calculadoras_precio OWNER TO postgres;

--
-- Name: calculadoras_precio_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.calculadoras_precio_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.calculadoras_precio_id_seq OWNER TO postgres;

--
-- Name: calculadoras_precio_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.calculadoras_precio_id_seq OWNED BY public.calculadoras_precio.id;


--
-- Name: cambios_productos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cambios_productos (
    id integer NOT NULL,
    venta_origen_id integer,
    venta_origen_numero character varying(50),
    producto_devuelto_id integer,
    producto_devuelto_nombre character varying(200),
    cantidad_devuelta integer NOT NULL,
    valor_devuelto numeric NOT NULL,
    producto_nuevo_id integer,
    producto_nuevo_nombre character varying(200),
    cantidad_nueva integer NOT NULL,
    valor_nuevo numeric NOT NULL,
    diferencia numeric NOT NULL,
    resolucion_diferencia character varying(20),
    medio_pago character varying(50),
    gift_card_id integer,
    local_id integer DEFAULT 1,
    usuario_id integer,
    usuario_nombre character varying(100),
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.cambios_productos OWNER TO postgres;

--
-- Name: cambios_productos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cambios_productos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cambios_productos_id_seq OWNER TO postgres;

--
-- Name: cambios_productos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cambios_productos_id_seq OWNED BY public.cambios_productos.id;


--
-- Name: canjes_empleados; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.canjes_empleados (
    id integer NOT NULL,
    empleado_id integer,
    empleado_nombre text,
    producto_id integer NOT NULL,
    producto_nombre text,
    cantidad integer NOT NULL,
    valor_unitario numeric,
    valor_total numeric,
    local_id integer NOT NULL,
    usuario_id integer,
    usuario_nombre text,
    notas text,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.canjes_empleados OWNER TO postgres;

--
-- Name: canjes_empleados_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.canjes_empleados_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.canjes_empleados_id_seq OWNER TO postgres;

--
-- Name: canjes_empleados_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.canjes_empleados_id_seq OWNED BY public.canjes_empleados.id;


--
-- Name: canjes_premios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.canjes_premios (
    id integer NOT NULL,
    premio_id integer NOT NULL,
    cliente_id integer NOT NULL,
    codigo character varying(20) NOT NULL,
    puntos_usados integer NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying,
    creado_en timestamp without time zone DEFAULT now(),
    usado_en timestamp without time zone,
    usado_por text
);


ALTER TABLE public.canjes_premios OWNER TO postgres;

--
-- Name: canjes_premios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.canjes_premios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.canjes_premios_id_seq OWNER TO postgres;

--
-- Name: canjes_premios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.canjes_premios_id_seq OWNED BY public.canjes_premios.id;


--
-- Name: categorias_costo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categorias_costo (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    tipo character varying(50) NOT NULL,
    subtipo character varying(50)
);


ALTER TABLE public.categorias_costo OWNER TO postgres;

--
-- Name: categorias_costo_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categorias_costo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categorias_costo_id_seq OWNER TO postgres;

--
-- Name: categorias_costo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categorias_costo_id_seq OWNED BY public.categorias_costo.id;


--
-- Name: clientes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clientes (
    id integer NOT NULL,
    nombre character varying(150) NOT NULL,
    email character varying(100),
    cuit_dni character varying(30),
    telefono character varying(30),
    fecha_nacimiento date,
    puntos integer DEFAULT 0,
    nivel character varying(20) DEFAULT 'Bronze'::character varying,
    total_compras numeric(12,2) DEFAULT 0,
    creado_en timestamp without time zone DEFAULT now(),
    local_id integer DEFAULT 1,
    portal_email character varying(150),
    portal_registrado_en timestamp without time zone,
    password_hash text
);


ALTER TABLE public.clientes OWNER TO postgres;

--
-- Name: clientes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.clientes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clientes_id_seq OWNER TO postgres;

--
-- Name: clientes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.clientes_id_seq OWNED BY public.clientes.id;


--
-- Name: comisiones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comisiones (
    id integer NOT NULL,
    local_id integer,
    mes integer NOT NULL,
    anio integer NOT NULL,
    facturacion_mes numeric DEFAULT 0,
    comision_ganada numeric DEFAULT 0,
    pagada boolean DEFAULT false,
    creado_en timestamp without time zone DEFAULT now(),
    fecha date,
    pagada_en timestamp without time zone
);


ALTER TABLE public.comisiones OWNER TO postgres;

--
-- Name: comisiones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.comisiones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comisiones_id_seq OWNER TO postgres;

--
-- Name: comisiones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.comisiones_id_seq OWNED BY public.comisiones.id;


--
-- Name: config_control_inventario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.config_control_inventario (
    local_id integer NOT NULL,
    avisos_activos boolean DEFAULT true,
    dias_aviso integer DEFAULT 30,
    ultimo_control timestamp without time zone
);


ALTER TABLE public.config_control_inventario OWNER TO postgres;

--
-- Name: config_ticket; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.config_ticket (
    id integer DEFAULT 1 NOT NULL,
    mostrar_cliente boolean DEFAULT true,
    mostrar_numero boolean DEFAULT true,
    mostrar_fecha boolean DEFAULT true,
    mensaje_pie text DEFAULT 'Gracias por tu compra!'::text,
    texto_extra text DEFAULT ''::text,
    logo_ticket_url text,
    CONSTRAINT una_fila CHECK ((id = 1))
);


ALTER TABLE public.config_ticket OWNER TO postgres;

--
-- Name: configuracion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.configuracion (
    id integer NOT NULL,
    clave character varying(100) NOT NULL,
    valor text
);


ALTER TABLE public.configuracion OWNER TO postgres;

--
-- Name: configuracion_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.configuracion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.configuracion_id_seq OWNER TO postgres;

--
-- Name: configuracion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.configuracion_id_seq OWNED BY public.configuracion.id;


--
-- Name: configuracion_negocio; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.configuracion_negocio (
    id integer DEFAULT 1 NOT NULL,
    nombre_negocio character varying(150) DEFAULT 'Mi Negocio'::character varying,
    logo_url text,
    cuit character varying(20),
    punto_venta integer DEFAULT 1,
    arca_cert text,
    arca_key text,
    CONSTRAINT solo_una_fila CHECK ((id = 1))
);


ALTER TABLE public.configuracion_negocio OWNER TO postgres;

--
-- Name: controles_inventario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.controles_inventario (
    id integer NOT NULL,
    tipo character varying(20) NOT NULL,
    filtro_valor character varying(150),
    local_id integer DEFAULT 1 NOT NULL,
    usuario_id integer,
    usuario_nombre character varying(100),
    estado character varying(20) DEFAULT 'en_curso'::character varying NOT NULL,
    ajustar_stock boolean DEFAULT false,
    notas text,
    items_correctos integer DEFAULT 0,
    items_faltantes integer DEFAULT 0,
    items_sobrantes integer DEFAULT 0,
    creado_en timestamp without time zone DEFAULT now(),
    finalizado_en timestamp without time zone,
    periodo_desde timestamp without time zone
);


ALTER TABLE public.controles_inventario OWNER TO postgres;

--
-- Name: controles_inventario_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.controles_inventario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.controles_inventario_id_seq OWNER TO postgres;

--
-- Name: controles_inventario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.controles_inventario_id_seq OWNED BY public.controles_inventario.id;


--
-- Name: controles_inventario_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.controles_inventario_items (
    id integer NOT NULL,
    control_id integer,
    producto_id integer,
    producto_nombre character varying(200),
    producto_marca character varying(100),
    producto_categoria character varying(100),
    stock_sistema integer,
    stock_contado integer,
    diferencia integer,
    estado character varying(20) DEFAULT 'pendiente'::character varying,
    ingresado_periodo integer DEFAULT 0,
    vendido_periodo integer DEFAULT 0,
    costo_unitario numeric DEFAULT 0,
    producto_codigo character varying(50)
);


ALTER TABLE public.controles_inventario_items OWNER TO postgres;

--
-- Name: controles_inventario_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.controles_inventario_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.controles_inventario_items_id_seq OWNER TO postgres;

--
-- Name: controles_inventario_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.controles_inventario_items_id_seq OWNED BY public.controles_inventario_items.id;


--
-- Name: cuentas_pago; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cuentas_pago (
    id integer NOT NULL,
    nombre character varying(150) NOT NULL,
    tipo character varying(50) NOT NULL,
    titular character varying(150),
    banco character varying(100),
    cbu character varying(30),
    alias character varying(50),
    solo_acreditacion boolean DEFAULT false,
    activo boolean DEFAULT true
);


ALTER TABLE public.cuentas_pago OWNER TO postgres;

--
-- Name: cuentas_pago_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cuentas_pago_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cuentas_pago_id_seq OWNER TO postgres;

--
-- Name: cuentas_pago_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cuentas_pago_id_seq OWNED BY public.cuentas_pago.id;


--
-- Name: cupones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cupones (
    id integer NOT NULL,
    codigo character varying(50) NOT NULL,
    descripcion character varying(200),
    tipo character varying(10) DEFAULT '%'::character varying,
    valor numeric(10,2),
    canal character varying(50),
    usos integer DEFAULT 0,
    max_usos integer,
    activo boolean DEFAULT true,
    fecha_vencimiento date,
    creado_en timestamp without time zone DEFAULT now(),
    condicion_medio_pago character varying(100),
    valor_condicional numeric,
    regalo_producto_id integer,
    regalo_producto_nombre character varying(255),
    regalo_monto_minimo numeric,
    descuento_monto_minimo numeric
);


ALTER TABLE public.cupones OWNER TO postgres;

--
-- Name: cupones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cupones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cupones_id_seq OWNER TO postgres;

--
-- Name: cupones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cupones_id_seq OWNED BY public.cupones.id;


--
-- Name: empleados; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.empleados (
    id integer NOT NULL,
    nombre text NOT NULL,
    local_id integer NOT NULL,
    comision_pct numeric DEFAULT 0 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.empleados OWNER TO postgres;

--
-- Name: empleados_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.empleados_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.empleados_id_seq OWNER TO postgres;

--
-- Name: empleados_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.empleados_id_seq OWNED BY public.empleados.id;


--
-- Name: facturacion_externa; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.facturacion_externa (
    id integer NOT NULL,
    monto numeric NOT NULL,
    local_id integer,
    mes integer,
    anio integer,
    descripcion text DEFAULT 'Sistema anterior'::text,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.facturacion_externa OWNER TO postgres;

--
-- Name: facturacion_externa_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.facturacion_externa_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.facturacion_externa_id_seq OWNER TO postgres;

--
-- Name: facturacion_externa_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.facturacion_externa_id_seq OWNED BY public.facturacion_externa.id;


--
-- Name: gift_card_movimientos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gift_card_movimientos (
    id integer NOT NULL,
    gift_card_id integer NOT NULL,
    tipo text NOT NULL,
    importe numeric(12,2) NOT NULL,
    saldo_resultante numeric(12,2) NOT NULL,
    venta_id integer,
    usuario_id integer,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.gift_card_movimientos OWNER TO postgres;

--
-- Name: gift_card_movimientos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.gift_card_movimientos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gift_card_movimientos_id_seq OWNER TO postgres;

--
-- Name: gift_card_movimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.gift_card_movimientos_id_seq OWNED BY public.gift_card_movimientos.id;


--
-- Name: gift_cards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gift_cards (
    id integer NOT NULL,
    codigo text NOT NULL,
    monto_inicial numeric(12,2) NOT NULL,
    saldo numeric(12,2) NOT NULL,
    beneficiario_nombre text NOT NULL,
    beneficiario_telefono text,
    beneficiario_dni text,
    cliente_id integer,
    comprador_nombre text,
    estado text DEFAULT 'activa'::text,
    local_id integer DEFAULT 1,
    emitida_por integer,
    creado_en timestamp without time zone DEFAULT now(),
    anulada boolean DEFAULT false,
    anulada_en timestamp without time zone,
    anulada_por text,
    motivo_anulacion text,
    es_migracion boolean DEFAULT false,
    venta_origen_id integer,
    venta_origen_numero character varying(50)
);


ALTER TABLE public.gift_cards OWNER TO postgres;

--
-- Name: gift_cards_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.gift_cards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gift_cards_id_seq OWNER TO postgres;

--
-- Name: gift_cards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.gift_cards_id_seq OWNED BY public.gift_cards.id;


--
-- Name: inconsistencias_stock; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inconsistencias_stock (
    id integer NOT NULL,
    producto_id integer,
    producto_nombre character varying(255),
    local_id integer,
    cantidad_vendida integer,
    stock_disponible integer,
    justificacion text NOT NULL,
    venta_numero_factura character varying(50),
    usuario_id integer,
    usuario_nombre character varying(255),
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.inconsistencias_stock OWNER TO postgres;

--
-- Name: inconsistencias_stock_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inconsistencias_stock_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inconsistencias_stock_id_seq OWNER TO postgres;

--
-- Name: inconsistencias_stock_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inconsistencias_stock_id_seq OWNED BY public.inconsistencias_stock.id;


--
-- Name: influencer_pagos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.influencer_pagos (
    id integer NOT NULL,
    influencer_id integer NOT NULL,
    monto numeric NOT NULL,
    fecha date DEFAULT CURRENT_DATE,
    notas text,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.influencer_pagos OWNER TO postgres;

--
-- Name: influencer_pagos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.influencer_pagos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.influencer_pagos_id_seq OWNER TO postgres;

--
-- Name: influencer_pagos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.influencer_pagos_id_seq OWNED BY public.influencer_pagos.id;


--
-- Name: influencer_regalos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.influencer_regalos (
    id integer NOT NULL,
    influencer_id integer NOT NULL,
    producto_id integer,
    producto_nombre character varying(255),
    campana character varying(255),
    codigo character varying(30) NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    local_entrega_id integer,
    entregado_en timestamp without time zone,
    entregado_por character varying(255),
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.influencer_regalos OWNER TO postgres;

--
-- Name: influencer_regalos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.influencer_regalos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.influencer_regalos_id_seq OWNER TO postgres;

--
-- Name: influencer_regalos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.influencer_regalos_id_seq OWNED BY public.influencer_regalos.id;


--
-- Name: influencers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.influencers (
    id integer NOT NULL,
    nombre text NOT NULL,
    instagram text,
    telefono text,
    nivel text DEFAULT 'inicial'::text NOT NULL,
    comision_pct numeric DEFAULT 2 NOT NULL,
    cupon_id integer,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp without time zone DEFAULT now(),
    cliente_id integer
);


ALTER TABLE public.influencers OWNER TO postgres;

--
-- Name: influencers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.influencers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.influencers_id_seq OWNER TO postgres;

--
-- Name: influencers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.influencers_id_seq OWNED BY public.influencers.id;


--
-- Name: insumos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insumos (
    id integer NOT NULL,
    nombre text NOT NULL,
    categoria text,
    unidad text DEFAULT 'unidad'::text,
    proveedor_id integer,
    costo numeric DEFAULT 0,
    stock_rg integer DEFAULT 0,
    stock_ush integer DEFAULT 0,
    stock_minimo integer DEFAULT 5,
    es_bolsa boolean DEFAULT false,
    activo boolean DEFAULT true,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.insumos OWNER TO postgres;

--
-- Name: insumos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.insumos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.insumos_id_seq OWNER TO postgres;

--
-- Name: insumos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.insumos_id_seq OWNED BY public.insumos.id;


--
-- Name: kit_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kit_items (
    id integer NOT NULL,
    kit_id integer,
    producto_id integer,
    cantidad integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.kit_items OWNER TO postgres;

--
-- Name: kit_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.kit_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.kit_items_id_seq OWNER TO postgres;

--
-- Name: kit_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.kit_items_id_seq OWNED BY public.kit_items.id;


--
-- Name: kits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kits (
    id integer NOT NULL,
    nombre character varying(200) NOT NULL,
    descripcion text,
    precio numeric(12,2),
    activo boolean DEFAULT true,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.kits OWNER TO postgres;

--
-- Name: kits_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.kits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.kits_id_seq OWNER TO postgres;

--
-- Name: kits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.kits_id_seq OWNED BY public.kits.id;


--
-- Name: locales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.locales (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    direccion character varying(200),
    activo boolean DEFAULT true,
    creado_en timestamp without time zone DEFAULT now(),
    descuenta_insumos boolean DEFAULT false
);


ALTER TABLE public.locales OWNER TO postgres;

--
-- Name: locales_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.locales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.locales_id_seq OWNER TO postgres;

--
-- Name: locales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.locales_id_seq OWNED BY public.locales.id;


--
-- Name: medios_pago; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.medios_pago (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    tipo character varying(50) NOT NULL,
    cuotas integer DEFAULT 1,
    con_interes boolean DEFAULT false,
    coeficiente numeric(6,4) DEFAULT 1.0000,
    activo boolean DEFAULT true,
    comision numeric DEFAULT 0,
    disponible_online boolean DEFAULT true
);


ALTER TABLE public.medios_pago OWNER TO postgres;

--
-- Name: medios_pago_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.medios_pago_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.medios_pago_id_seq OWNER TO postgres;

--
-- Name: medios_pago_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.medios_pago_id_seq OWNED BY public.medios_pago.id;


--
-- Name: mensajes_enviados; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mensajes_enviados (
    id integer NOT NULL,
    regla_id integer,
    cliente_id integer,
    mensaje text,
    estado character varying(20) DEFAULT 'enviado'::character varying,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.mensajes_enviados OWNER TO postgres;

--
-- Name: mensajes_enviados_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.mensajes_enviados_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.mensajes_enviados_id_seq OWNER TO postgres;

--
-- Name: mensajes_enviados_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.mensajes_enviados_id_seq OWNED BY public.mensajes_enviados.id;


--
-- Name: migracion_puntos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.migracion_puntos (
    id integer NOT NULL,
    cliente_id integer,
    monto numeric NOT NULL,
    fecha_compra date,
    puntos integer NOT NULL,
    usuario_id integer,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.migracion_puntos OWNER TO postgres;

--
-- Name: migracion_puntos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.migracion_puntos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.migracion_puntos_id_seq OWNER TO postgres;

--
-- Name: migracion_puntos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.migracion_puntos_id_seq OWNED BY public.migracion_puntos.id;


--
-- Name: movimientos_caja; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.movimientos_caja (
    id integer NOT NULL,
    concepto character varying(200),
    tipo character varying(10),
    importe numeric(12,2),
    referencia character varying(50),
    creado_en timestamp without time zone DEFAULT now(),
    local_id integer DEFAULT 1,
    forma_pago character varying(50),
    cuenta_pago_id integer,
    categoria_id integer,
    anulado boolean DEFAULT false,
    anulado_en timestamp without time zone,
    anulado_por text,
    motivo_anulacion text,
    usuario_id integer
);


ALTER TABLE public.movimientos_caja OWNER TO postgres;

--
-- Name: movimientos_caja_efectivo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.movimientos_caja_efectivo (
    id integer NOT NULL,
    tipo character varying(10) NOT NULL,
    importe numeric(12,2) NOT NULL,
    concepto character varying(200) NOT NULL,
    destino_origen character varying(100),
    cuenta_destino_id integer,
    local_id integer DEFAULT 1,
    usuario_id integer,
    creado_en timestamp without time zone DEFAULT now(),
    anulado boolean DEFAULT false,
    anulado_en timestamp without time zone,
    anulado_por text,
    motivo_anulacion text
);


ALTER TABLE public.movimientos_caja_efectivo OWNER TO postgres;

--
-- Name: movimientos_caja_efectivo_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.movimientos_caja_efectivo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.movimientos_caja_efectivo_id_seq OWNER TO postgres;

--
-- Name: movimientos_caja_efectivo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.movimientos_caja_efectivo_id_seq OWNED BY public.movimientos_caja_efectivo.id;


--
-- Name: movimientos_caja_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.movimientos_caja_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.movimientos_caja_id_seq OWNER TO postgres;

--
-- Name: movimientos_caja_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.movimientos_caja_id_seq OWNED BY public.movimientos_caja.id;


--
-- Name: ordenes_ingreso; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ordenes_ingreso (
    id integer NOT NULL,
    proveedor_id integer,
    proveedor_nombre character varying(200),
    fecha_factura date NOT NULL,
    fecha_vencimiento date,
    numero_factura character varying(50),
    total numeric(12,2) NOT NULL,
    estado character varying(50) DEFAULT 'pendiente'::character varying,
    forma_pago character varying(50),
    cuenta_pago_id integer,
    fecha_pago date,
    notas text,
    creado_en timestamp without time zone DEFAULT now(),
    estado_transito character varying(20) DEFAULT 'en_transito'::character varying,
    stock_transito_usado integer DEFAULT 0
);


ALTER TABLE public.ordenes_ingreso OWNER TO postgres;

--
-- Name: ordenes_ingreso_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ordenes_ingreso_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ordenes_ingreso_id_seq OWNER TO postgres;

--
-- Name: ordenes_ingreso_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ordenes_ingreso_id_seq OWNED BY public.ordenes_ingreso.id;


--
-- Name: ordenes_ingreso_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ordenes_ingreso_items (
    id integer NOT NULL,
    orden_id integer,
    producto_id integer,
    producto_nombre character varying(200),
    cantidad_total integer NOT NULL,
    cantidad_rg integer DEFAULT 0,
    cantidad_ush integer DEFAULT 0,
    costo_unitario numeric(10,2),
    recibido_rg integer DEFAULT 0,
    recibido_ush integer DEFAULT 0,
    en_transito_ush integer DEFAULT 0,
    revisado_rg boolean DEFAULT false,
    revisado_ush boolean DEFAULT false,
    nota_inconsistencia text,
    es_extra boolean DEFAULT false,
    recibido_por_rg text,
    recibido_por_ush text,
    fecha_recepcion_rg timestamp without time zone,
    fecha_recepcion_ush timestamp without time zone
);


ALTER TABLE public.ordenes_ingreso_items OWNER TO postgres;

--
-- Name: ordenes_ingreso_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ordenes_ingreso_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ordenes_ingreso_items_id_seq OWNER TO postgres;

--
-- Name: ordenes_ingreso_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ordenes_ingreso_items_id_seq OWNED BY public.ordenes_ingreso_items.id;


--
-- Name: pagos_comision_manual; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pagos_comision_manual (
    id integer NOT NULL,
    local_id integer NOT NULL,
    monto numeric NOT NULL,
    forma_pago character varying(20) DEFAULT 'efectivo'::character varying NOT NULL,
    producto_canje_id integer,
    producto_canje_nombre character varying(200),
    notas text,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.pagos_comision_manual OWNER TO postgres;

--
-- Name: pagos_comision_manual_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pagos_comision_manual_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pagos_comision_manual_id_seq OWNER TO postgres;

--
-- Name: pagos_comision_manual_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pagos_comision_manual_id_seq OWNED BY public.pagos_comision_manual.id;


--
-- Name: pedidos_clientas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pedidos_clientas (
    id integer NOT NULL,
    cliente_id integer,
    producto_id integer,
    estado text DEFAULT 'esperando'::text,
    avisado boolean DEFAULT false,
    creado_en timestamp without time zone DEFAULT now(),
    avisado_en timestamp without time zone,
    producto_texto text,
    nombre_manual character varying(150),
    telefono_manual character varying(30),
    local_id integer DEFAULT 1
);


ALTER TABLE public.pedidos_clientas OWNER TO postgres;

--
-- Name: pedidos_clientas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pedidos_clientas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pedidos_clientas_id_seq OWNER TO postgres;

--
-- Name: pedidos_clientas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pedidos_clientas_id_seq OWNED BY public.pedidos_clientas.id;


--
-- Name: permisos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permisos (
    id integer NOT NULL,
    rol_id integer,
    modulo character varying(50) NOT NULL,
    puede_ver boolean DEFAULT true,
    puede_modificar boolean DEFAULT false
);


ALTER TABLE public.permisos OWNER TO postgres;

--
-- Name: permisos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.permisos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.permisos_id_seq OWNER TO postgres;

--
-- Name: permisos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.permisos_id_seq OWNED BY public.permisos.id;


--
-- Name: permisos_usuario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permisos_usuario (
    id integer NOT NULL,
    usuario_id integer,
    permiso character varying(100) NOT NULL,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.permisos_usuario OWNER TO postgres;

--
-- Name: permisos_usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.permisos_usuario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.permisos_usuario_id_seq OWNER TO postgres;

--
-- Name: permisos_usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.permisos_usuario_id_seq OWNED BY public.permisos_usuario.id;


--
-- Name: pos_insumos_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pos_insumos_config (
    id integer NOT NULL,
    local_id integer NOT NULL,
    insumo_id integer NOT NULL,
    activo boolean DEFAULT true,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.pos_insumos_config OWNER TO postgres;

--
-- Name: pos_insumos_config_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pos_insumos_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pos_insumos_config_id_seq OWNER TO postgres;

--
-- Name: pos_insumos_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pos_insumos_config_id_seq OWNED BY public.pos_insumos_config.id;


--
-- Name: premios_fidelizacion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.premios_fidelizacion (
    id integer NOT NULL,
    nombre character varying(150) NOT NULL,
    descripcion text,
    puntos_requeridos integer NOT NULL,
    imagen_url text,
    stock_total integer,
    stock_usado integer DEFAULT 0,
    solo_mes_cumpleanos boolean DEFAULT false,
    activo boolean DEFAULT true,
    creado_en timestamp without time zone DEFAULT now(),
    nivel_minimo text DEFAULT 'Bronze'::text
);


ALTER TABLE public.premios_fidelizacion OWNER TO postgres;

--
-- Name: premios_fidelizacion_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.premios_fidelizacion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.premios_fidelizacion_id_seq OWNER TO postgres;

--
-- Name: premios_fidelizacion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.premios_fidelizacion_id_seq OWNED BY public.premios_fidelizacion.id;


--
-- Name: productos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.productos (
    id integer NOT NULL,
    nombre character varying(150) NOT NULL,
    marca character varying(100),
    precio numeric(10,2) NOT NULL,
    costo numeric(10,2),
    stock integer DEFAULT 0,
    stock_minimo integer DEFAULT 5,
    lead_time_dias integer DEFAULT 7,
    categoria character varying(100),
    codigo_barras character varying(50),
    activo boolean DEFAULT true,
    creado_en timestamp without time zone DEFAULT now(),
    local_id integer DEFAULT 1,
    stock_transito_rg integer DEFAULT 0,
    stock_transito_ush integer DEFAULT 0,
    reservado_rg integer DEFAULT 0,
    reservado_ush integer DEFAULT 0,
    stock_rg integer DEFAULT 0,
    stock_ush integer DEFAULT 0,
    proveedor_id integer
);


ALTER TABLE public.productos OWNER TO postgres;

--
-- Name: productos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.productos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.productos_id_seq OWNER TO postgres;

--
-- Name: productos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.productos_id_seq OWNED BY public.productos.id;


--
-- Name: promociones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.promociones (
    id integer NOT NULL,
    nombre text NOT NULL,
    tipo text NOT NULL,
    valor numeric DEFAULT 0,
    aplica_a text DEFAULT 'todo'::text,
    productos_ids integer[] DEFAULT '{}'::integer[],
    categorias text[] DEFAULT '{}'::text[],
    nx integer,
    ny integer,
    mismo_producto boolean DEFAULT true,
    producto_descuento_id integer,
    cross_producto_id integer,
    cross_producto_regalo_id integer,
    monto_minimo numeric,
    medio_pago_tipo text,
    combinable boolean DEFAULT false,
    fecha_inicio date,
    fecha_fin date,
    activo boolean DEFAULT true,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.promociones OWNER TO postgres;

--
-- Name: promociones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.promociones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.promociones_id_seq OWNER TO postgres;

--
-- Name: promociones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.promociones_id_seq OWNED BY public.promociones.id;


--
-- Name: proveedor_producto_alias; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.proveedor_producto_alias (
    id integer NOT NULL,
    proveedor_id integer NOT NULL,
    nombre_factura character varying(255) NOT NULL,
    producto_id integer NOT NULL,
    creado_en timestamp without time zone DEFAULT now(),
    codigo_factura character varying(100)
);


ALTER TABLE public.proveedor_producto_alias OWNER TO postgres;

--
-- Name: proveedor_producto_alias_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.proveedor_producto_alias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.proveedor_producto_alias_id_seq OWNER TO postgres;

--
-- Name: proveedor_producto_alias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.proveedor_producto_alias_id_seq OWNED BY public.proveedor_producto_alias.id;


--
-- Name: proveedores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.proveedores (
    id integer NOT NULL,
    nombre character varying(200) NOT NULL,
    cuit character varying(20),
    email character varying(200),
    telefono character varying(50),
    whatsapp character varying(50),
    dias_pago integer DEFAULT 30,
    forma_pago character varying(50) DEFAULT 'transferencia'::character varying,
    banco character varying(100),
    cbu character varying(30),
    alias character varying(50),
    titular_cuenta character varying(200),
    cuit_banco character varying(20),
    categoria character varying(50) DEFAULT 'mercaderia'::character varying,
    notas text,
    activo boolean DEFAULT true,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.proveedores OWNER TO postgres;

--
-- Name: proveedores_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.proveedores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.proveedores_id_seq OWNER TO postgres;

--
-- Name: proveedores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.proveedores_id_seq OWNED BY public.proveedores.id;


--
-- Name: reglas_comision; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reglas_comision (
    id integer NOT NULL,
    local_id integer,
    umbral_1 numeric NOT NULL,
    comision_1 numeric NOT NULL,
    umbral_2 numeric NOT NULL,
    comision_2 numeric NOT NULL,
    umbral_3 numeric,
    comision_3 numeric
);


ALTER TABLE public.reglas_comision OWNER TO postgres;

--
-- Name: reglas_comision_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reglas_comision_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reglas_comision_id_seq OWNER TO postgres;

--
-- Name: reglas_comision_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reglas_comision_id_seq OWNED BY public.reglas_comision.id;


--
-- Name: reglas_postventa; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reglas_postventa (
    id integer NOT NULL,
    nombre character varying(150),
    disparador character varying(100),
    dias integer,
    segmento character varying(100),
    mensaje text,
    activo boolean DEFAULT true,
    creado_en timestamp without time zone DEFAULT now(),
    local_id integer DEFAULT 1
);


ALTER TABLE public.reglas_postventa OWNER TO postgres;

--
-- Name: reglas_postventa_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reglas_postventa_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reglas_postventa_id_seq OWNER TO postgres;

--
-- Name: reglas_postventa_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reglas_postventa_id_seq OWNED BY public.reglas_postventa.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    nombre character varying(50) NOT NULL
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: solicitudes_puntos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.solicitudes_puntos (
    id integer NOT NULL,
    cliente_id integer NOT NULL,
    monto numeric NOT NULL,
    local_id integer,
    fecha_compra date,
    estado text DEFAULT 'pendiente'::text,
    puntos_calculados integer,
    aprobado_por text,
    creado_en timestamp without time zone DEFAULT now(),
    resuelto_en timestamp without time zone
);


ALTER TABLE public.solicitudes_puntos OWNER TO postgres;

--
-- Name: solicitudes_puntos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.solicitudes_puntos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.solicitudes_puntos_id_seq OWNER TO postgres;

--
-- Name: solicitudes_puntos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.solicitudes_puntos_id_seq OWNED BY public.solicitudes_puntos.id;


--
-- Name: tareas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tareas (
    id integer NOT NULL,
    titulo character varying(200) NOT NULL,
    descripcion text,
    urgencia character varying(20) DEFAULT 'media'::character varying NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    asignado_a integer,
    asignado_nombre character varying(100),
    creado_por integer,
    creado_por_nombre character varying(100),
    local_id integer DEFAULT 1,
    creado_en timestamp without time zone DEFAULT now(),
    iniciada_en timestamp without time zone,
    finalizada_en timestamp without time zone,
    nota_error text
);


ALTER TABLE public.tareas OWNER TO postgres;

--
-- Name: tareas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tareas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tareas_id_seq OWNER TO postgres;

--
-- Name: tareas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tareas_id_seq OWNED BY public.tareas.id;


--
-- Name: tiendanube_pedidos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tiendanube_pedidos (
    id integer NOT NULL,
    tn_order_id bigint,
    numero text,
    estado character varying(30) DEFAULT 'pendiente'::character varying,
    cliente_nombre text,
    cliente_email text,
    total numeric(12,2),
    productos jsonb,
    stock_descontado boolean DEFAULT false,
    autorizado_por text,
    autorizado_en timestamp without time zone,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.tiendanube_pedidos OWNER TO postgres;

--
-- Name: tiendanube_pedidos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tiendanube_pedidos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tiendanube_pedidos_id_seq OWNER TO postgres;

--
-- Name: tiendanube_pedidos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tiendanube_pedidos_id_seq OWNED BY public.tiendanube_pedidos.id;


--
-- Name: tiendanube_vinculos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tiendanube_vinculos (
    id integer NOT NULL,
    producto_id integer,
    tn_product_id character varying(50) NOT NULL,
    tn_variant_id_rg character varying(50),
    tn_variant_id_ush character varying(50),
    activo boolean DEFAULT true,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.tiendanube_vinculos OWNER TO postgres;

--
-- Name: tiendanube_vinculos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tiendanube_vinculos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tiendanube_vinculos_id_seq OWNER TO postgres;

--
-- Name: tiendanube_vinculos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tiendanube_vinculos_id_seq OWNED BY public.tiendanube_vinculos.id;


--
-- Name: traspasos_stock; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traspasos_stock (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    producto_nombre text,
    cantidad integer NOT NULL,
    local_origen integer NOT NULL,
    local_destino integer NOT NULL,
    usuario_id integer,
    usuario_nombre text,
    notas text,
    creado_en timestamp without time zone DEFAULT now(),
    estado text DEFAULT 'en_transito'::text NOT NULL,
    cantidad_recibida integer,
    nota_inconsistencia text,
    recibido_por text,
    recibido_en timestamp without time zone
);


ALTER TABLE public.traspasos_stock OWNER TO postgres;

--
-- Name: traspasos_stock_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.traspasos_stock_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.traspasos_stock_id_seq OWNER TO postgres;

--
-- Name: traspasos_stock_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.traspasos_stock_id_seq OWNED BY public.traspasos_stock.id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    password character varying(255) NOT NULL,
    rol character varying(20) DEFAULT 'admin'::character varying,
    creado_en timestamp without time zone DEFAULT now(),
    local_id integer DEFAULT 1,
    rol_id integer DEFAULT 2
);


ALTER TABLE public.usuarios OWNER TO postgres;

--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuarios_id_seq OWNER TO postgres;

--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: venta_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.venta_items (
    id integer NOT NULL,
    venta_id integer,
    producto_id integer,
    cantidad integer NOT NULL,
    precio_unitario numeric(10,2),
    subtotal numeric(12,2)
);


ALTER TABLE public.venta_items OWNER TO postgres;

--
-- Name: venta_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.venta_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.venta_items_id_seq OWNER TO postgres;

--
-- Name: venta_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.venta_items_id_seq OWNED BY public.venta_items.id;


--
-- Name: venta_pagos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.venta_pagos (
    id integer NOT NULL,
    venta_id integer,
    medio_pago_id integer,
    medio_pago_nombre text,
    importe numeric NOT NULL,
    gift_card_id integer,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.venta_pagos OWNER TO postgres;

--
-- Name: venta_pagos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.venta_pagos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.venta_pagos_id_seq OWNER TO postgres;

--
-- Name: venta_pagos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.venta_pagos_id_seq OWNED BY public.venta_pagos.id;


--
-- Name: ventas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ventas (
    id integer NOT NULL,
    numero_factura character varying(20),
    cliente_id integer,
    tipo_factura character varying(10) DEFAULT 'B'::character varying,
    subtotal numeric(12,2),
    descuento numeric(12,2) DEFAULT 0,
    total numeric(12,2),
    canal character varying(20) DEFAULT 'presencial'::character varying,
    cae character varying(50),
    estado character varying(20) DEFAULT 'emitida'::character varying,
    creado_en timestamp without time zone DEFAULT now(),
    local_id integer DEFAULT 1,
    es_preventa boolean DEFAULT false,
    nombre_preventa character varying(200),
    orden_ingreso_id integer,
    monto_senia numeric(12,2) DEFAULT 0,
    estado_pago character varying(20) DEFAULT 'pagado'::character varying,
    medio_pago_id integer,
    medio_pago text,
    usuario_id integer,
    inicio_venta timestamp without time zone,
    duracion_segundos integer,
    monto_gift_card numeric(12,2) DEFAULT 0,
    nro_comprobante integer,
    cae_vto text,
    punto_venta integer,
    preventa_local integer,
    anulada boolean DEFAULT false,
    anulada_en timestamp without time zone,
    anulada_por text,
    motivo_anulacion text,
    bolsa_insumo_id integer,
    referencia text,
    cupon_id integer,
    estado_facturacion character varying(20) DEFAULT 'pendiente'::character varying,
    intentos_facturacion integer DEFAULT 0,
    ultimo_error_facturacion text,
    monto_sena numeric DEFAULT 0,
    sena_medio_pago_id integer,
    sena_medio_pago_nombre text,
    sena_referencia text
);


ALTER TABLE public.ventas OWNER TO postgres;

--
-- Name: ventas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ventas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ventas_id_seq OWNER TO postgres;

--
-- Name: ventas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ventas_id_seq OWNED BY public.ventas.id;


--
-- Name: ajustes_stock id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ajustes_stock ALTER COLUMN id SET DEFAULT nextval('public.ajustes_stock_id_seq'::regclass);


--
-- Name: anulaciones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anulaciones ALTER COLUMN id SET DEFAULT nextval('public.anulaciones_id_seq'::regclass);


--
-- Name: arca_tokens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.arca_tokens ALTER COLUMN id SET DEFAULT nextval('public.arca_tokens_id_seq'::regclass);


--
-- Name: caja_respaldo id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.caja_respaldo ALTER COLUMN id SET DEFAULT nextval('public.caja_respaldo_id_seq'::regclass);


--
-- Name: calculadoras_precio id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calculadoras_precio ALTER COLUMN id SET DEFAULT nextval('public.calculadoras_precio_id_seq'::regclass);


--
-- Name: cambios_productos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cambios_productos ALTER COLUMN id SET DEFAULT nextval('public.cambios_productos_id_seq'::regclass);


--
-- Name: canjes_empleados id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.canjes_empleados ALTER COLUMN id SET DEFAULT nextval('public.canjes_empleados_id_seq'::regclass);


--
-- Name: canjes_premios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.canjes_premios ALTER COLUMN id SET DEFAULT nextval('public.canjes_premios_id_seq'::regclass);


--
-- Name: categorias_costo id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias_costo ALTER COLUMN id SET DEFAULT nextval('public.categorias_costo_id_seq'::regclass);


--
-- Name: clientes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes ALTER COLUMN id SET DEFAULT nextval('public.clientes_id_seq'::regclass);


--
-- Name: comisiones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comisiones ALTER COLUMN id SET DEFAULT nextval('public.comisiones_id_seq'::regclass);


--
-- Name: configuracion id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion ALTER COLUMN id SET DEFAULT nextval('public.configuracion_id_seq'::regclass);


--
-- Name: controles_inventario id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.controles_inventario ALTER COLUMN id SET DEFAULT nextval('public.controles_inventario_id_seq'::regclass);


--
-- Name: controles_inventario_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.controles_inventario_items ALTER COLUMN id SET DEFAULT nextval('public.controles_inventario_items_id_seq'::regclass);


--
-- Name: cuentas_pago id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuentas_pago ALTER COLUMN id SET DEFAULT nextval('public.cuentas_pago_id_seq'::regclass);


--
-- Name: cupones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cupones ALTER COLUMN id SET DEFAULT nextval('public.cupones_id_seq'::regclass);


--
-- Name: empleados id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empleados ALTER COLUMN id SET DEFAULT nextval('public.empleados_id_seq'::regclass);


--
-- Name: facturacion_externa id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.facturacion_externa ALTER COLUMN id SET DEFAULT nextval('public.facturacion_externa_id_seq'::regclass);


--
-- Name: gift_card_movimientos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gift_card_movimientos ALTER COLUMN id SET DEFAULT nextval('public.gift_card_movimientos_id_seq'::regclass);


--
-- Name: gift_cards id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gift_cards ALTER COLUMN id SET DEFAULT nextval('public.gift_cards_id_seq'::regclass);


--
-- Name: inconsistencias_stock id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inconsistencias_stock ALTER COLUMN id SET DEFAULT nextval('public.inconsistencias_stock_id_seq'::regclass);


--
-- Name: influencer_pagos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.influencer_pagos ALTER COLUMN id SET DEFAULT nextval('public.influencer_pagos_id_seq'::regclass);


--
-- Name: influencer_regalos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.influencer_regalos ALTER COLUMN id SET DEFAULT nextval('public.influencer_regalos_id_seq'::regclass);


--
-- Name: influencers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.influencers ALTER COLUMN id SET DEFAULT nextval('public.influencers_id_seq'::regclass);


--
-- Name: insumos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insumos ALTER COLUMN id SET DEFAULT nextval('public.insumos_id_seq'::regclass);


--
-- Name: kit_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kit_items ALTER COLUMN id SET DEFAULT nextval('public.kit_items_id_seq'::regclass);


--
-- Name: kits id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kits ALTER COLUMN id SET DEFAULT nextval('public.kits_id_seq'::regclass);


--
-- Name: locales id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locales ALTER COLUMN id SET DEFAULT nextval('public.locales_id_seq'::regclass);


--
-- Name: medios_pago id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medios_pago ALTER COLUMN id SET DEFAULT nextval('public.medios_pago_id_seq'::regclass);


--
-- Name: mensajes_enviados id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mensajes_enviados ALTER COLUMN id SET DEFAULT nextval('public.mensajes_enviados_id_seq'::regclass);


--
-- Name: migracion_puntos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migracion_puntos ALTER COLUMN id SET DEFAULT nextval('public.migracion_puntos_id_seq'::regclass);


--
-- Name: movimientos_caja id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_caja ALTER COLUMN id SET DEFAULT nextval('public.movimientos_caja_id_seq'::regclass);


--
-- Name: movimientos_caja_efectivo id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_caja_efectivo ALTER COLUMN id SET DEFAULT nextval('public.movimientos_caja_efectivo_id_seq'::regclass);


--
-- Name: ordenes_ingreso id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ordenes_ingreso ALTER COLUMN id SET DEFAULT nextval('public.ordenes_ingreso_id_seq'::regclass);


--
-- Name: ordenes_ingreso_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ordenes_ingreso_items ALTER COLUMN id SET DEFAULT nextval('public.ordenes_ingreso_items_id_seq'::regclass);


--
-- Name: pagos_comision_manual id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos_comision_manual ALTER COLUMN id SET DEFAULT nextval('public.pagos_comision_manual_id_seq'::regclass);


--
-- Name: pedidos_clientas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedidos_clientas ALTER COLUMN id SET DEFAULT nextval('public.pedidos_clientas_id_seq'::regclass);


--
-- Name: permisos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos ALTER COLUMN id SET DEFAULT nextval('public.permisos_id_seq'::regclass);


--
-- Name: permisos_usuario id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos_usuario ALTER COLUMN id SET DEFAULT nextval('public.permisos_usuario_id_seq'::regclass);


--
-- Name: pos_insumos_config id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pos_insumos_config ALTER COLUMN id SET DEFAULT nextval('public.pos_insumos_config_id_seq'::regclass);


--
-- Name: premios_fidelizacion id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.premios_fidelizacion ALTER COLUMN id SET DEFAULT nextval('public.premios_fidelizacion_id_seq'::regclass);


--
-- Name: productos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.productos ALTER COLUMN id SET DEFAULT nextval('public.productos_id_seq'::regclass);


--
-- Name: promociones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promociones ALTER COLUMN id SET DEFAULT nextval('public.promociones_id_seq'::regclass);


--
-- Name: proveedor_producto_alias id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proveedor_producto_alias ALTER COLUMN id SET DEFAULT nextval('public.proveedor_producto_alias_id_seq'::regclass);


--
-- Name: proveedores id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proveedores ALTER COLUMN id SET DEFAULT nextval('public.proveedores_id_seq'::regclass);


--
-- Name: reglas_comision id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reglas_comision ALTER COLUMN id SET DEFAULT nextval('public.reglas_comision_id_seq'::regclass);


--
-- Name: reglas_postventa id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reglas_postventa ALTER COLUMN id SET DEFAULT nextval('public.reglas_postventa_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: solicitudes_puntos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitudes_puntos ALTER COLUMN id SET DEFAULT nextval('public.solicitudes_puntos_id_seq'::regclass);


--
-- Name: tareas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tareas ALTER COLUMN id SET DEFAULT nextval('public.tareas_id_seq'::regclass);


--
-- Name: tiendanube_pedidos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tiendanube_pedidos ALTER COLUMN id SET DEFAULT nextval('public.tiendanube_pedidos_id_seq'::regclass);


--
-- Name: tiendanube_vinculos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tiendanube_vinculos ALTER COLUMN id SET DEFAULT nextval('public.tiendanube_vinculos_id_seq'::regclass);


--
-- Name: traspasos_stock id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traspasos_stock ALTER COLUMN id SET DEFAULT nextval('public.traspasos_stock_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Name: venta_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venta_items ALTER COLUMN id SET DEFAULT nextval('public.venta_items_id_seq'::regclass);


--
-- Name: venta_pagos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venta_pagos ALTER COLUMN id SET DEFAULT nextval('public.venta_pagos_id_seq'::regclass);


--
-- Name: ventas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ventas ALTER COLUMN id SET DEFAULT nextval('public.ventas_id_seq'::regclass);


--
-- Name: ajustes_stock ajustes_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ajustes_stock
    ADD CONSTRAINT ajustes_stock_pkey PRIMARY KEY (id);


--
-- Name: anulaciones anulaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anulaciones
    ADD CONSTRAINT anulaciones_pkey PRIMARY KEY (id);


--
-- Name: arca_tokens arca_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.arca_tokens
    ADD CONSTRAINT arca_tokens_pkey PRIMARY KEY (id);


--
-- Name: caja_respaldo caja_respaldo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.caja_respaldo
    ADD CONSTRAINT caja_respaldo_pkey PRIMARY KEY (id);


--
-- Name: calculadoras_precio calculadoras_precio_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calculadoras_precio
    ADD CONSTRAINT calculadoras_precio_pkey PRIMARY KEY (id);


--
-- Name: cambios_productos cambios_productos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cambios_productos
    ADD CONSTRAINT cambios_productos_pkey PRIMARY KEY (id);


--
-- Name: canjes_empleados canjes_empleados_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.canjes_empleados
    ADD CONSTRAINT canjes_empleados_pkey PRIMARY KEY (id);


--
-- Name: canjes_premios canjes_premios_codigo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.canjes_premios
    ADD CONSTRAINT canjes_premios_codigo_key UNIQUE (codigo);


--
-- Name: canjes_premios canjes_premios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.canjes_premios
    ADD CONSTRAINT canjes_premios_pkey PRIMARY KEY (id);


--
-- Name: categorias_costo categorias_costo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias_costo
    ADD CONSTRAINT categorias_costo_pkey PRIMARY KEY (id);


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);


--
-- Name: comisiones comisiones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comisiones
    ADD CONSTRAINT comisiones_pkey PRIMARY KEY (id);


--
-- Name: config_control_inventario config_control_inventario_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.config_control_inventario
    ADD CONSTRAINT config_control_inventario_pkey PRIMARY KEY (local_id);


--
-- Name: config_ticket config_ticket_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.config_ticket
    ADD CONSTRAINT config_ticket_pkey PRIMARY KEY (id);


--
-- Name: configuracion configuracion_clave_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_clave_key UNIQUE (clave);


--
-- Name: configuracion_negocio configuracion_negocio_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion_negocio
    ADD CONSTRAINT configuracion_negocio_pkey PRIMARY KEY (id);


--
-- Name: configuracion configuracion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_pkey PRIMARY KEY (id);


--
-- Name: controles_inventario_items controles_inventario_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.controles_inventario_items
    ADD CONSTRAINT controles_inventario_items_pkey PRIMARY KEY (id);


--
-- Name: controles_inventario controles_inventario_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.controles_inventario
    ADD CONSTRAINT controles_inventario_pkey PRIMARY KEY (id);


--
-- Name: cuentas_pago cuentas_pago_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuentas_pago
    ADD CONSTRAINT cuentas_pago_pkey PRIMARY KEY (id);


--
-- Name: cupones cupones_codigo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cupones
    ADD CONSTRAINT cupones_codigo_key UNIQUE (codigo);


--
-- Name: cupones cupones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cupones
    ADD CONSTRAINT cupones_pkey PRIMARY KEY (id);


--
-- Name: empleados empleados_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empleados
    ADD CONSTRAINT empleados_pkey PRIMARY KEY (id);


--
-- Name: facturacion_externa facturacion_externa_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.facturacion_externa
    ADD CONSTRAINT facturacion_externa_pkey PRIMARY KEY (id);


--
-- Name: gift_card_movimientos gift_card_movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gift_card_movimientos
    ADD CONSTRAINT gift_card_movimientos_pkey PRIMARY KEY (id);


--
-- Name: gift_cards gift_cards_codigo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_codigo_key UNIQUE (codigo);


--
-- Name: gift_cards gift_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_pkey PRIMARY KEY (id);


--
-- Name: inconsistencias_stock inconsistencias_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inconsistencias_stock
    ADD CONSTRAINT inconsistencias_stock_pkey PRIMARY KEY (id);


--
-- Name: influencer_pagos influencer_pagos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.influencer_pagos
    ADD CONSTRAINT influencer_pagos_pkey PRIMARY KEY (id);


--
-- Name: influencer_regalos influencer_regalos_codigo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.influencer_regalos
    ADD CONSTRAINT influencer_regalos_codigo_key UNIQUE (codigo);


--
-- Name: influencer_regalos influencer_regalos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.influencer_regalos
    ADD CONSTRAINT influencer_regalos_pkey PRIMARY KEY (id);


--
-- Name: influencers influencers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.influencers
    ADD CONSTRAINT influencers_pkey PRIMARY KEY (id);


--
-- Name: insumos insumos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insumos
    ADD CONSTRAINT insumos_pkey PRIMARY KEY (id);


--
-- Name: kit_items kit_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kit_items
    ADD CONSTRAINT kit_items_pkey PRIMARY KEY (id);


--
-- Name: kits kits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kits
    ADD CONSTRAINT kits_pkey PRIMARY KEY (id);


--
-- Name: locales locales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locales
    ADD CONSTRAINT locales_pkey PRIMARY KEY (id);


--
-- Name: medios_pago medios_pago_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medios_pago
    ADD CONSTRAINT medios_pago_pkey PRIMARY KEY (id);


--
-- Name: mensajes_enviados mensajes_enviados_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mensajes_enviados
    ADD CONSTRAINT mensajes_enviados_pkey PRIMARY KEY (id);


--
-- Name: migracion_puntos migracion_puntos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migracion_puntos
    ADD CONSTRAINT migracion_puntos_pkey PRIMARY KEY (id);


--
-- Name: movimientos_caja_efectivo movimientos_caja_efectivo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_caja_efectivo
    ADD CONSTRAINT movimientos_caja_efectivo_pkey PRIMARY KEY (id);


--
-- Name: movimientos_caja movimientos_caja_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_pkey PRIMARY KEY (id);


--
-- Name: ordenes_ingreso_items ordenes_ingreso_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ordenes_ingreso_items
    ADD CONSTRAINT ordenes_ingreso_items_pkey PRIMARY KEY (id);


--
-- Name: ordenes_ingreso ordenes_ingreso_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ordenes_ingreso
    ADD CONSTRAINT ordenes_ingreso_pkey PRIMARY KEY (id);


--
-- Name: pagos_comision_manual pagos_comision_manual_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos_comision_manual
    ADD CONSTRAINT pagos_comision_manual_pkey PRIMARY KEY (id);


--
-- Name: pedidos_clientas pedidos_clientas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedidos_clientas
    ADD CONSTRAINT pedidos_clientas_pkey PRIMARY KEY (id);


--
-- Name: permisos permisos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_pkey PRIMARY KEY (id);


--
-- Name: permisos_usuario permisos_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos_usuario
    ADD CONSTRAINT permisos_usuario_pkey PRIMARY KEY (id);


--
-- Name: permisos_usuario permisos_usuario_usuario_id_permiso_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos_usuario
    ADD CONSTRAINT permisos_usuario_usuario_id_permiso_key UNIQUE (usuario_id, permiso);


--
-- Name: pos_insumos_config pos_insumos_config_local_id_insumo_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pos_insumos_config
    ADD CONSTRAINT pos_insumos_config_local_id_insumo_id_key UNIQUE (local_id, insumo_id);


--
-- Name: pos_insumos_config pos_insumos_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pos_insumos_config
    ADD CONSTRAINT pos_insumos_config_pkey PRIMARY KEY (id);


--
-- Name: premios_fidelizacion premios_fidelizacion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.premios_fidelizacion
    ADD CONSTRAINT premios_fidelizacion_pkey PRIMARY KEY (id);


--
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id);


--
-- Name: promociones promociones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promociones
    ADD CONSTRAINT promociones_pkey PRIMARY KEY (id);


--
-- Name: proveedor_producto_alias proveedor_producto_alias_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proveedor_producto_alias
    ADD CONSTRAINT proveedor_producto_alias_pkey PRIMARY KEY (id);


--
-- Name: proveedores proveedores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT proveedores_pkey PRIMARY KEY (id);


--
-- Name: reglas_comision reglas_comision_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reglas_comision
    ADD CONSTRAINT reglas_comision_pkey PRIMARY KEY (id);


--
-- Name: reglas_postventa reglas_postventa_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reglas_postventa
    ADD CONSTRAINT reglas_postventa_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: solicitudes_puntos solicitudes_puntos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitudes_puntos
    ADD CONSTRAINT solicitudes_puntos_pkey PRIMARY KEY (id);


--
-- Name: tareas tareas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tareas
    ADD CONSTRAINT tareas_pkey PRIMARY KEY (id);


--
-- Name: tiendanube_pedidos tiendanube_pedidos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tiendanube_pedidos
    ADD CONSTRAINT tiendanube_pedidos_pkey PRIMARY KEY (id);


--
-- Name: tiendanube_pedidos tiendanube_pedidos_tn_order_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tiendanube_pedidos
    ADD CONSTRAINT tiendanube_pedidos_tn_order_id_key UNIQUE (tn_order_id);


--
-- Name: tiendanube_vinculos tiendanube_vinculos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tiendanube_vinculos
    ADD CONSTRAINT tiendanube_vinculos_pkey PRIMARY KEY (id);


--
-- Name: traspasos_stock traspasos_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traspasos_stock
    ADD CONSTRAINT traspasos_stock_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: venta_items venta_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venta_items
    ADD CONSTRAINT venta_items_pkey PRIMARY KEY (id);


--
-- Name: venta_pagos venta_pagos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venta_pagos
    ADD CONSTRAINT venta_pagos_pkey PRIMARY KEY (id);


--
-- Name: ventas ventas_numero_factura_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_numero_factura_key UNIQUE (numero_factura);


--
-- Name: ventas ventas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_pkey PRIMARY KEY (id);


--
-- Name: idx_alias_proveedor_codigo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_alias_proveedor_codigo ON public.proveedor_producto_alias USING btree (proveedor_id, codigo_factura) WHERE (codigo_factura IS NOT NULL);


--
-- Name: idx_alias_proveedor_nombre_sin_codigo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_alias_proveedor_nombre_sin_codigo ON public.proveedor_producto_alias USING btree (proveedor_id, nombre_factura) WHERE (codigo_factura IS NULL);


--
-- Name: idx_gc_mov_giftcard; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gc_mov_giftcard ON public.gift_card_movimientos USING btree (gift_card_id);


--
-- Name: idx_gift_cards_codigo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gift_cards_codigo ON public.gift_cards USING btree (codigo);


--
-- Name: ajustes_stock ajustes_stock_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ajustes_stock
    ADD CONSTRAINT ajustes_stock_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: cambios_productos cambios_productos_gift_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cambios_productos
    ADD CONSTRAINT cambios_productos_gift_card_id_fkey FOREIGN KEY (gift_card_id) REFERENCES public.gift_cards(id);


--
-- Name: cambios_productos cambios_productos_producto_devuelto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cambios_productos
    ADD CONSTRAINT cambios_productos_producto_devuelto_id_fkey FOREIGN KEY (producto_devuelto_id) REFERENCES public.productos(id);


--
-- Name: cambios_productos cambios_productos_producto_nuevo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cambios_productos
    ADD CONSTRAINT cambios_productos_producto_nuevo_id_fkey FOREIGN KEY (producto_nuevo_id) REFERENCES public.productos(id);


--
-- Name: cambios_productos cambios_productos_venta_origen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cambios_productos
    ADD CONSTRAINT cambios_productos_venta_origen_id_fkey FOREIGN KEY (venta_origen_id) REFERENCES public.ventas(id);


--
-- Name: canjes_empleados canjes_empleados_empleado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.canjes_empleados
    ADD CONSTRAINT canjes_empleados_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id);


--
-- Name: canjes_empleados canjes_empleados_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.canjes_empleados
    ADD CONSTRAINT canjes_empleados_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: canjes_premios canjes_premios_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.canjes_premios
    ADD CONSTRAINT canjes_premios_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: canjes_premios canjes_premios_premio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.canjes_premios
    ADD CONSTRAINT canjes_premios_premio_id_fkey FOREIGN KEY (premio_id) REFERENCES public.premios_fidelizacion(id);


--
-- Name: clientes clientes_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locales(id);


--
-- Name: comisiones comisiones_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comisiones
    ADD CONSTRAINT comisiones_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locales(id);


--
-- Name: controles_inventario_items controles_inventario_items_control_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.controles_inventario_items
    ADD CONSTRAINT controles_inventario_items_control_id_fkey FOREIGN KEY (control_id) REFERENCES public.controles_inventario(id) ON DELETE CASCADE;


--
-- Name: controles_inventario_items controles_inventario_items_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.controles_inventario_items
    ADD CONSTRAINT controles_inventario_items_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: cupones cupones_regalo_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cupones
    ADD CONSTRAINT cupones_regalo_producto_id_fkey FOREIGN KEY (regalo_producto_id) REFERENCES public.productos(id);


--
-- Name: empleados empleados_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empleados
    ADD CONSTRAINT empleados_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locales(id);


--
-- Name: gift_cards gift_cards_venta_origen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_venta_origen_id_fkey FOREIGN KEY (venta_origen_id) REFERENCES public.ventas(id);


--
-- Name: inconsistencias_stock inconsistencias_stock_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inconsistencias_stock
    ADD CONSTRAINT inconsistencias_stock_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: influencer_pagos influencer_pagos_influencer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.influencer_pagos
    ADD CONSTRAINT influencer_pagos_influencer_id_fkey FOREIGN KEY (influencer_id) REFERENCES public.influencers(id) ON DELETE CASCADE;


--
-- Name: influencer_regalos influencer_regalos_influencer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.influencer_regalos
    ADD CONSTRAINT influencer_regalos_influencer_id_fkey FOREIGN KEY (influencer_id) REFERENCES public.influencers(id);


--
-- Name: influencer_regalos influencer_regalos_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.influencer_regalos
    ADD CONSTRAINT influencer_regalos_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: influencers influencers_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.influencers
    ADD CONSTRAINT influencers_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: influencers influencers_cupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.influencers
    ADD CONSTRAINT influencers_cupon_id_fkey FOREIGN KEY (cupon_id) REFERENCES public.cupones(id);


--
-- Name: insumos insumos_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insumos
    ADD CONSTRAINT insumos_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id) ON DELETE SET NULL;


--
-- Name: kit_items kit_items_kit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kit_items
    ADD CONSTRAINT kit_items_kit_id_fkey FOREIGN KEY (kit_id) REFERENCES public.kits(id) ON DELETE CASCADE;


--
-- Name: kit_items kit_items_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kit_items
    ADD CONSTRAINT kit_items_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: mensajes_enviados mensajes_enviados_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mensajes_enviados
    ADD CONSTRAINT mensajes_enviados_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: mensajes_enviados mensajes_enviados_regla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mensajes_enviados
    ADD CONSTRAINT mensajes_enviados_regla_id_fkey FOREIGN KEY (regla_id) REFERENCES public.reglas_postventa(id);


--
-- Name: migracion_puntos migracion_puntos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migracion_puntos
    ADD CONSTRAINT migracion_puntos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: movimientos_caja movimientos_caja_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias_costo(id);


--
-- Name: movimientos_caja movimientos_caja_cuenta_pago_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_cuenta_pago_id_fkey FOREIGN KEY (cuenta_pago_id) REFERENCES public.cuentas_pago(id);


--
-- Name: movimientos_caja_efectivo movimientos_caja_efectivo_cuenta_destino_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_caja_efectivo
    ADD CONSTRAINT movimientos_caja_efectivo_cuenta_destino_id_fkey FOREIGN KEY (cuenta_destino_id) REFERENCES public.cuentas_pago(id);


--
-- Name: movimientos_caja movimientos_caja_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locales(id);


--
-- Name: movimientos_caja movimientos_caja_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: ordenes_ingreso ordenes_ingreso_cuenta_pago_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ordenes_ingreso
    ADD CONSTRAINT ordenes_ingreso_cuenta_pago_id_fkey FOREIGN KEY (cuenta_pago_id) REFERENCES public.cuentas_pago(id);


--
-- Name: ordenes_ingreso_items ordenes_ingreso_items_orden_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ordenes_ingreso_items
    ADD CONSTRAINT ordenes_ingreso_items_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES public.ordenes_ingreso(id);


--
-- Name: ordenes_ingreso_items ordenes_ingreso_items_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ordenes_ingreso_items
    ADD CONSTRAINT ordenes_ingreso_items_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: ordenes_ingreso ordenes_ingreso_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ordenes_ingreso
    ADD CONSTRAINT ordenes_ingreso_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);


--
-- Name: pagos_comision_manual pagos_comision_manual_producto_canje_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos_comision_manual
    ADD CONSTRAINT pagos_comision_manual_producto_canje_id_fkey FOREIGN KEY (producto_canje_id) REFERENCES public.productos(id);


--
-- Name: pedidos_clientas pedidos_clientas_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedidos_clientas
    ADD CONSTRAINT pedidos_clientas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: pedidos_clientas pedidos_clientas_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pedidos_clientas
    ADD CONSTRAINT pedidos_clientas_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: permisos permisos_rol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.roles(id);


--
-- Name: permisos_usuario permisos_usuario_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permisos_usuario
    ADD CONSTRAINT permisos_usuario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: pos_insumos_config pos_insumos_config_insumo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pos_insumos_config
    ADD CONSTRAINT pos_insumos_config_insumo_id_fkey FOREIGN KEY (insumo_id) REFERENCES public.insumos(id) ON DELETE CASCADE;


--
-- Name: productos productos_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locales(id);


--
-- Name: productos productos_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);


--
-- Name: proveedor_producto_alias proveedor_producto_alias_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proveedor_producto_alias
    ADD CONSTRAINT proveedor_producto_alias_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: proveedor_producto_alias proveedor_producto_alias_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proveedor_producto_alias
    ADD CONSTRAINT proveedor_producto_alias_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);


--
-- Name: reglas_comision reglas_comision_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reglas_comision
    ADD CONSTRAINT reglas_comision_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locales(id);


--
-- Name: reglas_postventa reglas_postventa_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reglas_postventa
    ADD CONSTRAINT reglas_postventa_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locales(id);


--
-- Name: solicitudes_puntos solicitudes_puntos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitudes_puntos
    ADD CONSTRAINT solicitudes_puntos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: tiendanube_vinculos tiendanube_vinculos_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tiendanube_vinculos
    ADD CONSTRAINT tiendanube_vinculos_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: traspasos_stock traspasos_stock_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traspasos_stock
    ADD CONSTRAINT traspasos_stock_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: usuarios usuarios_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locales(id);


--
-- Name: usuarios usuarios_rol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.roles(id);


--
-- Name: venta_items venta_items_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venta_items
    ADD CONSTRAINT venta_items_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: venta_items venta_items_venta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venta_items
    ADD CONSTRAINT venta_items_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id);


--
-- Name: venta_pagos venta_pagos_venta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venta_pagos
    ADD CONSTRAINT venta_pagos_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id);


--
-- Name: ventas ventas_bolsa_insumo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_bolsa_insumo_id_fkey FOREIGN KEY (bolsa_insumo_id) REFERENCES public.insumos(id) ON DELETE SET NULL;


--
-- Name: ventas ventas_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: ventas ventas_cupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_cupon_id_fkey FOREIGN KEY (cupon_id) REFERENCES public.cupones(id);


--
-- Name: ventas ventas_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_local_id_fkey FOREIGN KEY (local_id) REFERENCES public.locales(id);


--
-- Name: ventas ventas_orden_ingreso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_orden_ingreso_id_fkey FOREIGN KEY (orden_ingreso_id) REFERENCES public.ordenes_ingreso(id);


--
-- PostgreSQL database dump complete
--

\unrestrict moXZWblVrJqsgNqCsqtutiLEpJd8E0bkqEug9JeZqbs0mLHbfWTCh6hANLcSdVf

