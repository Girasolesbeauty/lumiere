const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Calcular comision del mes para un local
router.get('/:local_id', async (req, res) => {
  try {
    const { local_id } = req.params;
    const mes = new Date().getMonth() + 1;
    const anio = new Date().getFullYear();

    // Facturacion del mes en el local (solo presencial, no tiendanube)
    const facturacion = await pool.query(
      `SELECT COALESCE(SUM(total), 0) AS total
       FROM ventas
       WHERE local_id = $1
       AND canal = 'presencial'
       AND DATE_TRUNC('month', creado_en) = DATE_TRUNC('month', CURRENT_DATE)`,
      [local_id]
    );

    const total = parseFloat(facturacion.rows[0].total);

    // Reglas de comision del local
    const reglas = await pool.query(
      'SELECT * FROM reglas_comision WHERE local_id = $1',
      [local_id]
    );

    if (reglas.rows.length === 0) {
      return res.json({ facturacion: total, comision: 0, nivel: 0, mensaje: "Sin reglas configuradas" });
    }

    const r = reglas.rows[0];
    let comision = 0;
    let nivel = 0;
    let mensaje = "";
    let falta_nivel1 = 0;
    let falta_nivel2 = 0;

    if (total >= r.umbral_2) {
      comision = r.comision_1 + r.comision_2;
      nivel = 2;
      mensaje = `Meta maxima alcanzada! Comision: $${comision.toLocaleString()}`;
    } else if (total >= r.umbral_1) {
      comision = r.comision_1;
      nivel = 1;
      falta_nivel2 = r.umbral_2 - total;
      mensaje = `Meta 1 alcanzada! Te faltan $${falta_nivel2.toLocaleString()} para el bonus extra`;
    } else {
      comision = 0;
      nivel = 0;
      falta_nivel1 = r.umbral_1 - total;
      mensaje = `Te faltan $${falta_nivel1.toLocaleString()} para ganar la comision`;
    }

    // Guardar o actualizar comision del mes
    const existe = await pool.query(
      'SELECT id FROM comisiones WHERE local_id = $1 AND mes = $2 AND anio = $3',
      [local_id, mes, anio]
    );

    if (existe.rows.length > 0) {
      await pool.query(
        'UPDATE comisiones SET facturacion_mes = $1, comision_ganada = $2 WHERE local_id = $3 AND mes = $4 AND anio = $5',
        [total, comision, local_id, mes, anio]
      );
    } else {
      await pool.query(
        'INSERT INTO comisiones (local_id, mes, anio, facturacion_mes, comision_ganada) VALUES ($1, $2, $3, $4, $5)',
        [local_id, mes, anio, total, comision]
      );
    }

    // Si hay comision, registrarla en costos variables automaticamente
    if (comision > 0) {
      const yaRegistrada = await pool.query(
        `SELECT id FROM movimientos_caja 
         WHERE local_id = $1 
         AND referencia = $2
         AND tipo = 'E'`,
        [local_id, `COMISION-${mes}-${anio}`]
      );

      if (yaRegistrada.rows.length === 0) {
        await pool.query(
          `INSERT INTO movimientos_caja (concepto, tipo, importe, referencia, local_id)
           VALUES ($1, 'E', $2, $3, $4)`,
          [`Comision vendedora ${mes}/${anio}`, comision, `COMISION-${mes}-${anio}`, local_id]
        );
      } else {
        await pool.query(
          `UPDATE movimientos_caja SET importe = $1 
           WHERE local_id = $2 AND referencia = $3`,
          [comision, local_id, `COMISION-${mes}-${anio}`]
        );
      }
    }

    res.json({
      facturacion: total,
      comision,
      nivel,
      mensaje,
      falta_nivel1: falta_nivel1 > 0 ? falta_nivel1 : 0,
      falta_nivel2: falta_nivel2 > 0 ? falta_nivel2 : 0,
      umbral_1: r.umbral_1,
      umbral_2: r.umbral_2,
      comision_1: r.comision_1,
      comision_2: r.comision_2,
      pct_nivel1: Math.min(Math.round((total / r.umbral_1) * 100), 100),
      pct_nivel2: Math.min(Math.round((total / r.umbral_2) * 100), 100),
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calcular comision' });
  }
});

// Historial de comisiones
router.get('/:local_id/historial', async (req, res) => {
  try {
    const { local_id } = req.params;
    const result = await pool.query(
      `SELECT * FROM comisiones WHERE local_id = $1 ORDER BY anio DESC, mes DESC LIMIT 12`,
      [local_id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// Marcar comision como pagada
router.put('/:local_id/pagar', async (req, res) => {
  try {
    const { local_id } = req.params;
    const mes = new Date().getMonth() + 1;
    const anio = new Date().getFullYear();
    await pool.query(
      'UPDATE comisiones SET pagada = TRUE WHERE local_id = $1 AND mes = $2 AND anio = $3',
      [local_id, mes, anio]
    );
    res.json({ mensaje: 'Comision marcada como pagada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al marcar como pagada' });
  }
});

module.exports = router;