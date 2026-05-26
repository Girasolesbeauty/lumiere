const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1', [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const usuario = result.rows[0];
    const passwordValido = await bcrypt.compare(password, usuario.password);

    if (!passwordValido) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Obtener permisos del rol
    const permisosResult = await pool.query(
      'SELECT modulo, puede_ver, puede_modificar FROM permisos WHERE rol_id = $1',
      [usuario.rol_id || 1]
    );

    const permisos = {};
    permisosResult.rows.forEach(p => {
      permisos[p.modulo] = {
        ver: p.puede_ver,
        modificar: p.puede_modificar
      };
    });

    // Obtener local del usuario
    let local = null;
    if (usuario.local_id) {
      const localResult = await pool.query(
        'SELECT * FROM locales WHERE id = $1', [usuario.local_id]
      );
      if (localResult.rows.length > 0) local = localResult.rows[0];
    }

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, rol: usuario.rol, local_id: usuario.local_id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        local_id: usuario.local_id,
        permisos,
        local
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al iniciar sesion' });
  }
});

// Registrar usuario
router.post('/register', async (req, res) => {
  try {
    const { nombre, email, password, rol, rol_id, local_id } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO usuarios (nombre, email, password, rol, rol_id, local_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nombre, email, rol`,
      [nombre, email, hashedPassword, rol || 'vendedora', rol_id || 3, local_id || 1]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// Obtener todos los usuarios
router.get('/usuarios', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.nombre, u.email, u.rol, u.local_id, l.nombre AS local_nombre
       FROM usuarios u
       LEFT JOIN locales l ON u.local_id = l.id
       ORDER BY u.id ASC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// Cambiar contraseña
router.put('/usuarios/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('UPDATE usuarios SET password = $1 WHERE id = $2', [hashedPassword, id]);
    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

// Actualizar usuario
router.put('/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, rol, rol_id, local_id } = req.body;
    const result = await pool.query(
      `UPDATE usuarios SET nombre=$1, email=$2, rol=$3, rol_id=$4, local_id=$5
       WHERE id=$6 RETURNING id, nombre, email, rol, local_id`,
      [nombre, email, rol, rol_id, local_id, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

module.exports = router;